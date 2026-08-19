# -*- coding: utf-8 -*-
"""ジム防衛オススメツール データ生成スクリプト
gym-attack/data/gym_data.json と iv-checker の伝説フラグを元に
防衛スコアを事前計算し data/defense_data.js を出力する。
ポケモンのデータは毎朝の自動更新に乗っているので、新ポケモンは自動でランキングに入る。
手で更新するものは無い（2026-08-14に攻撃側の集計リストを廃止した。下のコメント参照）。
"""
import json, re, os, math

BASE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(BASE)

gd = json.load(open(os.path.join(REPO, 'gym-attack/data/gym_data.json')))
T = gd['types_jp']; CH = gd['chart']; MV = gd['moves']; CPM50 = gd['cpm']['50']
ti = {n: i for i, n in enumerate(T)}

# ── ジム配置不可の判定(3層) ──
# 1) iv-checkerの伝説(l)・幻(m)フラグ
html = open(os.path.join(REPO, 'iv-checker/index.html'), encoding='utf-8').read()
POKE = json.loads(re.search(r'const POKE = (\[.*?\]);', html, re.S).group(1))
LM_DEX = {p['d'] for p in POKE if p.get('l') or p.get('m')}

# 2) Game MasterのisDeployable=False種族(l/mフラグ漏れの補完)
#    出典: PokeMiners latest.json の pokemonSettings.isDeployable (2026-07-19時点)
#    更新方法: GMを取得し「全フォームでisDeployableがTrueでない図鑑番号」を再抽出
GM_NON_DEPLOYABLE_DEX = {
    489,   # フィオネ
    490,   # マナフィ
    493,   # アルセウス
    772,   # タイプ：ヌル
    773,   # シルヴァディ
    789,   # コスモッグ
    790,   # コスモウム
    801,   # マギアナ
    896,   # ブリザポス
    897,   # レイスポス
    898,   # バドレックス
    1001,  # チオンジェン
    1002,  # パオジアン
    1003,  # ディンルー
    1004,  # イーユイ
    1007,  # コライドン
    1008,  # ミライドン
}
LM_DEX |= GM_NON_DEPLOYABLE_DEX

# 3) GM上は配置可(isDeployable=True)だが実際のゲームでは配置不可のポケモン
#    (ポケモンWiki確認済み: 伝説・幻・メガ・ゲンシ+モルペコ・ギルガルド。
#     ミミッキュも現状配置不可。ウッウは実装予定だが同系(フォルムチェンジ)のため
#     先行して配置不可扱い。メルタン・メルメタルは幻だが例外的に配置可能なので除外しない)
MANUAL_EXCLUDE_PREFIX = ('ギルガルド', 'モルペコ', 'ミミッキュ', 'ウッウ')  # イオルブは実装済みと確認済み

# 元データの姿名を公式名称に修正するテーブル(2026年公式命名対応)
# パンプジン・バケッチャは種族値照合で対応確認済み(1ふん=Small…4ふん=Super)
NAME_FIX = {
    'バケッチャ(1ふん)': 'バケッチャ(こだましゅ)',
    'バケッチャ(2ふん)': 'バケッチャ(ちゅうだましゅ)',
    'バケッチャ(3ふん)': 'バケッチャ(おおだましゅ)',
    'バケッチャ(4ふん)': 'バケッチャ(ギガだましゅ)',
    'パンプジン(1ふん)': 'パンプジン(こだましゅ)',
    'パンプジン(2ふん)': 'パンプジン(ちゅうだましゅ)',
    'パンプジン(3ふん)': 'パンプジン(おおだましゅ)',
    'パンプジン(4ふん)': 'パンプジン(ギガだましゅ)',
}

# ══════════════════════════════════════════════════════════════════
# ポイントの決め方（2026-08-14・タダシさん指示で全面的に作り直した）
#
#   合計(総合) = 耐久P ＋ タイプP ＋ やる気P
#   迎撃Pは合計に足さない（2026-08-19タダシさん指示で「基本／迎撃込み」の切り替えを廃止。
#   迎撃は専用タブ `si` で見る）
#
#   優先度は 耐久 ＞ タイプ ＞ やる気 ＞ 迎撃 の順で、その順に振れ幅を大きくしてある:
#     耐久P   0〜約82   … いちばん効く
#     タイプP -14〜+8   … 格闘に対する相性だけを見る
#     やる気P 0〜10
#     迎撃P   0〜8      … いちばん効かない
#
#   旧版は「攻撃側の使用ポケモン32匹の集計(アンケート)」を持ち、その顔ぶれへの相性で
#   細かく加点していた（炎で迎撃できると高い、など）。環境が変わるたびにアンケートを
#   取り直す必要があり維持できないため、**攻撃側リストごと廃止**した。
#   格闘だけを見るのは、ジムを攻撃しに来る顔ぶれが変わっても
#   「格闘が最大勢力」という性質だけは動かないため。
# ══════════════════════════════════════════════════════════════════
K_BULK = 1.2328          # 耐久P = K_BULK × HP×防御/1000 (PL50, 個体値15)。旧版から据え置き
# タイプP: 格闘に対する倍率だけで決める（他のタイプは見ない）
FIGHT_SCORE = [
    (0.4, 8),    # 二重耐性(×0.39以下)
    (0.63, 4),   # 耐性(×0.625)
    (1.6, 0),    # 等倍
    (2.56, -8),  # 弱点(×1.6)
    (99, -14),   # 二重弱点(×2.56)
]
# ── 迎撃P（2026-08-19・タダシさんの前提訂正を受けて作り直した）──────────────
#   【前提の訂正】防衛側のゲージは**常に満タンではない**。挑戦者の火力が高い・人数が多い・
#   防衛側の防御が低い、といった条件がそろって初めて満タンに近い状態になることがある、が正しい。
#   （2026-08-14版はこれを「ほぼ常に満タン」と受け取り、ゲージ分割の減点を入れていなかった）
#
#   そこで、ツールが確実に言えるぶんだけで測る:
#     迎撃の生値 = 攻撃実数値 ×（ノーマルのDPS ＋ SP_WEIGHT × SPのDPS × 速さ）
#       ・ノーマルのDPS = 1発の威力 ÷（わざの長さ ＋ 硬直2秒）
#         …防衛側は1発ごとに約2秒の硬直が入る（タダシさん提供の仕様）
#       ・SPのDPS = 1発の威力 ÷ 消費ゲージ × ノーマルのゲージ獲得速度
#         …**自分のノーマルアタックでためるぶん**だけで撃つ頻度を出す。
#           被弾でたまるぶんは相手次第なので入れない（入れると挑戦者を仮定することになる）
#       ・ノーマルとSPの組み合わせは総当たりで、合計がいちばん高い1組を採る
#     これで1ゲージの大技（デカハンマー=威力300・100消費）が正しく割り引かれ、
#     上位の団子（1位と2位の差2.8%）が解消する（差10.1%）。
#
#   頭打ちもやめた。旧版は生値21000で満点=8点だったため**10匹が同点1位**になっていた
#   （タダシさん指摘）。いまは最大値を8点として比例配分するので同点1位は出ない。
SP_WEIGHT = 0.45         # SPの比重。発動判定が1/2で運任せなぶんノーマルより軽く見る
SP_DUR_REF = 2.5         # 速さ補正の基準(秒)。これより速ければ加点・遅ければ減点
SP_DUR_ALPHA = 0.5       # 速さの効き具合 (2.5秒/発生秒)^α → 1.2秒で1.44倍・4.7秒で0.73倍
DEF_STALL = 2.0          # 防衛側が1発ごとに固まる時間(秒)
INT_MAX = 8.0            # 迎撃Pの幅(4つの中ではいちばん小さいまま。総合の配点バランスは変えない)

# ══════════════════════════════════════════════════════════════════
# 並べ替えタブ用のスコア（2026-08-19・タダシさん指示。合計＝総合の計算は一切変えない）
#
#   タイプ相性タブ = (耐性の数 − 弱点の数) ＋ かくとう相性 ＋ 耐久指数
#   やる気タブ     = (やる気 ＋ 0.25×かくとう相性P) × 耐久の割合 × 10
#     …やる気が下がりにくくても、1発で溶けるポケモンはジムに残らない。
#       そこで「やる気の点数を硬さの割合で実質化する」形にした（2026-08-19・タダシさん指示で
#       マリルリが上位に入るよう調整。足し算では、やる気10で柔らかいポケモンを追い抜けなかった）
#
#   重みは実測で決めた（上位20を「主役が守られているか／実戦で置く硬さか／最終進化か／
#   総合ランキングと別物になっているか／重みを±30%動かしたときの入れ替わり」で測った）:
#     ・かくとうの重み=耐性1つぶん が最良。0だとフェアリー/はがねだけの並びになり
#       かくとうを見ていない状態、3まで上げると耐性の数の話が消えてゴースト系に寄る。
#       1のときだけ上位20が「耐性−弱点が高い」で20/20埋まり、最終進化16/20・総合との重複3/20
#     ・耐久指数=耐性4つぶん。0〜12まで振っても上位20の顔ぶれは1匹も入れ替わらなかったので、
#       安定している範囲の真ん中を取った（タイプ相性の並びは耐久の混ぜ具合でほぼ動かない）
#     ・やる気のかくとう補正 0.25 は、0.4以上にすると かくとう弱点のラッキーが1位から落ち、
#       0.5では二重耐性の柔らかい組が伸びてマリルリがまた下がる。安定範囲(0.2〜0.3)の真ん中を取った
#       （かくとうを無視するとマリルリ14位・0.25で6位）
# ══════════════════════════════════════════════════════════════════
#   迎撃タブ（`si`）は「迎撃力 × 硬さ ＋ かくとう相性」。総合の迎撃P（純粋な迎撃力）とは別。
#     …殴れても1発で溶けるポケモンは撃つ前に倒される、という理屈（2026-08-19・タダシさん指示で
#       「ヒヒダルマが2位は違和感」→ 耐久とかくとう耐性を足した）。実測で ヒヒダルマ2位→13位
INT_TAB_FLOOR = 0.5      # 硬さの下限。柔らかくても迎撃力の半分は残す
INT_TAB_FIGHT = 15.0     # かくとう相性の重み（二重耐性+15 / 耐性+7.5 / 弱点-15 / 二重弱点-26）
TYPE_FIGHT_W = 1.0       # かくとう相性の重み（タイプPを4で割った段階＝二重耐性2/耐性1/弱点-2/二重弱点-3.5）
TYPE_BULK_W = 4.0        # 耐久指数の重み（いちばん硬いポケモンで耐性4つぶん）
YARUKI_FIGHT_W = 0.25    # やる気タブでかくとう相性Pをどれだけ効かせるか（やる気の点数に足してから硬さを掛ける）

# ══════════════════════════════════════════════════════════════════
# 画面に出す「おすすめのわざ構成」の選び方（2026-08-14・タダシさん指示）
#   ポイント計算とは別の考え方で選ぶ。狙いは次の3つ:
#     ① 攻撃側の最大勢力である かくとう に刺さるわざを優先する
#     ② 発生の速いわざを優先する
#     ③ 威力も大切にする
#   そのうえで「はかいこうせん・ソーラービームのような重すぎるわざ」は選ばせない。
#   重いわざ＝1ゲージ技は、防衛側が撃つまでに時間がかかるので REC_BARS で強く割り引く。
#
#   スコア ＝ 威力 × タイプ一致1.2 × かくとう補正 × ゲージ補正 × 速さ補正
#
#   検証(2026-08-14): この係数だと 1ゲージ技が選ばれるのは延べ1匹だけになる（旧版は156匹）。
#   ハピナスは指定どおり「マジカルシャイン or サイコキネシス」。旧版との一致は 558/949。
# ══════════════════════════════════════════════════════════════════
REC_FIGHT_SE = 1.15      # かくとうの弱点を突けるタイプ(ひこう・エスパー・フェアリー)
REC_FIGHT_NVE = 0.9      # かくとうに半減されるタイプ(いわ・むし・あく)
REC_BARS = {1: 0.4, 2: 1.0, 3: 0.85}   # 1ゲージ技は溜めるのに時間がかかるぶん割り引く
# 時間の罰則は「基準を超えたぶんだけ」効かせる。全部のわざに一律で掛けると、
# 速いわざ同士の並びまで動いてしまい、ハピナスの「マジカルシャイン or サイコキネシス」が崩れる。
REC_DUR_REF, REC_DUR_POW = 3.5, 3    # 全体の長さ: 3.5秒を超えたぶんだけ罰する
REC_DW_REF, REC_DW_POW = 2.6, 4      # ダメージが出るまで: 2.6秒より遅いぶんだけ罰する
#   じしん (全体3.5 / 発生2.6) は罰則ゼロ＝採用ライン。
#   はかいこうせん (4.0 / 3.5)・ソーラービーム (5.0 / 2.8)・オーバーヒート (4.0 / 2.6) は
#   ここで落ちる。実測でこの3つは1匹も選ばれない
SECOND_MOVE_RATIO = 0.80 # ベスト技スコアの80%以上なら2番手技も併記

name2mon = {}
for p in gd['pokemon']:
    name2mon.setdefault(p['name'], p)

FIGHT = ti['かくとう']

def type_score(types):
    """タイプP: 格闘に対する相性だけで決める。
    ジムを攻撃しに来る顔ぶれは入れ替わるが、格闘が最大勢力という性質は変わらないため、
    そこだけを見る（他のタイプまで細かく見ると、攻撃側の集計が要る＝維持できない）。"""
    m = 1.0
    for dt in types: m *= CH[FIGHT][dt]
    for lim, pt in FIGHT_SCORE:
        if m < lim: return pt
    return FIGHT_SCORE[-1][1]

def res_weak(types):
    """18タイプから受けたときの「耐性の数」と「弱点の数」（二重かどうかは数えない）。
    並べ替えタブの『タイプ相性』で使う。総合ポイントの計算には使わない。"""
    r = w = 0
    for t in range(18):
        m = 1.0
        for dt in types: m *= CH[t][dt]
        if m < 1: r += 1
        elif m > 1: w += 1
    return r, w


def all_mult(atk_i, types):
    v = 1.0
    for dt in types: v *= CH[atk_i][dt]
    return v

def fight_bonus(mv_type):
    """そのタイプのわざが、かくとうタイプの相手にどれだけ刺さるか"""
    m = CH[mv_type][FIGHT]
    return REC_FIGHT_SE if m > 1 else (REC_FIGHT_NVE if m < 1 else 1.0)

def recommend_moves(p):
    """画面に出すおすすめのわざ構成を選ぶ（ポイント計算とは別のルール）"""
    best_f = None
    for f in p.get('fast', []):
        fm = MV.get(f)
        if not fm: continue
        # ノーマルアタックは「1発の威力」で選ぶ（速さは見ない）
        v = fm['power'] * (1.2 if fm['type'] in p['types'] else 1.0) * fight_bonus(fm['type'])
        if best_f is None or v > best_f[0]: best_f = (v, fm['jp'])
    sps = []
    for c in p.get('charged', []):
        cm = MV.get(c)
        if not cm: continue
        v = cm['power'] * (1.2 if cm['type'] in p['types'] else 1.0) * fight_bonus(cm['type'])
        v *= REC_BARS.get(cm.get('bars'), 1.0)
        dur = (cm.get('dur') or 2500) / 1000.0
        dw = (cm.get('dw') or cm.get('dur') or 2500) / 1000.0   # ダメージが出るまでの時間
        v *= min(1.0, REC_DUR_REF / dur) ** REC_DUR_POW
        v *= min(1.0, REC_DW_REF / dw) ** REC_DW_POW
        sps.append((v, cm['jp']))
    if not best_f or not sps: return None
    sps.sort(key=lambda x: -x[0])
    cm2 = sps[1][1] if len(sps) > 1 and sps[1][0] >= sps[0][0] * SECOND_MOVE_RATIO else None
    return (best_f[1], sps[0][1], cm2)

def yaruki(cp):
    if cp < 1500: return 10
    if cp < 2000: return 7
    if cp < 2500: return 5
    if cp < 3000: return 2
    return 0

def double_weak(types):
    for t in range(18):
        m = 1.0
        for dt in types: m *= CH[t][dt]
        if m > 2.0: return True
    return False

entries = []
seen = set()
for p in gd['pokemon']:
    if p['name'] in seen: continue
    seen.add(p['name'])
    if p.get('mega'): continue
    if p['dex'] in LM_DEX: continue
    if p['name'].startswith(MANUAL_EXCLUDE_PREFIX): continue
    hp = int((p['sta'] + 15) * CPM50)
    df = (p['def'] + 15) * CPM50
    cp = max(10, int((p['atk'] + 15) * math.sqrt(p['def'] + 15) * math.sqrt(p['sta'] + 15) * CPM50 ** 2 / 10))
    bulk = hp * df / 1000.0
    atk50 = (p['atk'] + 15) * CPM50   # 攻撃実数値(PL50, 個体値15)
    # 迎撃: ノーマルとSPの組み合わせを総当たりして、いちばん強い1組を採る。
    #   ノーマルは「威力 ÷ (長さ + 硬直2秒)」、SPは「威力 ÷ 消費ゲージ × ノーマルのゲージ獲得速度」。
    #   ゲージは自分のノーマルアタックでためるぶんだけを見る（被弾ぶんは挑戦者次第なので入れない）。
    best_int = None
    for f in p.get('fast', []):
        fm = MV.get(f)
        if not fm: continue
        na_dmg = fm['power'] * (1.2 if fm['type'] in p['types'] else 1.0)
        cyc = (fm.get('dur') or 500) / 1000.0 + DEF_STALL   # 1発にかかる時間(硬直込み)
        na_dps = na_dmg / cyc
        eg = (fm.get('energy') or 0) / cyc                  # 1秒あたりにたまるゲージ
        for c in p.get('charged', []):
            cm = MV.get(c)
            if not cm: continue
            sp_dmg = cm['power'] * (1.2 if cm['type'] in p['types'] else 1.0)
            cost = abs(cm.get('energy') or 100)             # 消費ゲージ(1ゲージ技=100)
            dur = (cm.get('dur') or 2500) / 1000.0
            sp_dps = sp_dmg / cost * eg * (SP_DUR_REF / dur) ** SP_DUR_ALPHA
            v = atk50 * (na_dps + SP_WEIGHT * sp_dps)
            if best_int is None or v > best_int[0]:
                best_int = (v, fm['jp'], cm['jp'])
    if best_int is None: continue
    # 画面に出すおすすめ構成は、ポイント計算とは別のルールで選ぶ（重いわざを避ける）
    rec = recommend_moves(p)
    if not rec: continue
    p_bulk = K_BULK * bulk
    p_type = type_score(p['types'])
    p_yar = yaruki(cp)
    rs, ws = res_weak(p['types'])
    entries.append({
        'n': NAME_FIX.get(p['name'], p['name']), 't': p['types'], 'cp': cp,
        'pb': round(p_bulk, 1), 'pt': round(p_type, 1), 'py': p_yar,
        'rs': rs, 'ws': ws, 'bk': round(bulk * 1000),   # 耐性の数・弱点の数・耐久指数(HP×防御)
        'iv': best_int[0], 'im': best_int[1] + '＋' + best_int[2],  # 迎撃の生値と、その元になったわざ
        'fm': rec[0], 'cm': rec[1], 'cm2': rec[2], 'dw': 1 if double_weak(p['types']) else 0,
    })

# 迎撃Pと、並べ替えタブ用のスコア（耐久・タイプ・やる気の配点は変えない）
BK_MAX = max(e['bk'] for e in entries)
IV_MAX = max(e['iv'] for e in entries)
for e in entries:
    # 迎撃は頭打ちにせず、いちばん強いポケモンを8点として比例配分する（同点1位を作らないため）
    e['pi'] = round(INT_MAX * e['iv'] / IV_MAX, 1)
    # 迎撃タブ用: 迎撃力 × 硬さ ＋ かくとう相性（あとで最大が100になるようそろえる）
    e['si'] = (100.0 * e['iv'] / IV_MAX) * (INT_TAB_FLOOR + (1 - INT_TAB_FLOOR) * e['bk'] / BK_MAX) \
        + INT_TAB_FIGHT * (e['pt'] / 8.0)
    e['total'] = round(e['pb'] + e['pt'] + e['py'], 1)   # 迎撃は足さない（専用タブで見る）
    # 小数第1位で丸めてから引き伸ばす（丸めをあとにすると同点が割れて順位が動くため）
    e['st'] = round((e['rs'] - e['ws']) + TYPE_FIGHT_W * (e['pt'] / 4.0)
                    + TYPE_BULK_W * e['bk'] / BK_MAX, 1)
    e['sy'] = round((e['py'] + YARUKI_FIGHT_W * e['pt']) * e['bk'] / BK_MAX * 10, 1)
    del e['iv']
SI_MAX = max(e['si'] for e in entries)
# タイプは素の値が -7〜11 と小さく、他のタブと桁がそろわないので 0〜100 に引き伸ばす
# （最小を0・最大を100にするだけの一次変換なので、並び順は変わらない）
ST_MIN, ST_MAX = min(e['st'] for e in entries), max(e['st'] for e in entries)
SY_MAX = max(e['sy'] for e in entries)
for e in entries:
    e['si'] = round(100.0 * e['si'] / SI_MAX, 1)
    e['st'] = round(100.0 * (e['st'] - ST_MIN) / (ST_MAX - ST_MIN), 1)
    e['sy'] = round(100.0 * e['sy'] / SY_MAX, 1)

entries.sort(key=lambda x: -x['total'])
out = {
    'generated': True,
    'types_jp': T,
    # 攻撃側リストは廃止したので出力しない（画面でも使っていない）
    'entries': entries,
}
os.makedirs(os.path.join(BASE, 'data'), exist_ok=True)
js = 'const DEFENSE_DATA = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(os.path.join(BASE, 'data', 'defense_data.js'), 'w', encoding='utf-8').write(js)
json.dump(out, open(os.path.join(BASE, 'data', 'defense_data.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('entries:', len(entries))
print('top5:', [e['n'] for e in entries[:5]])
