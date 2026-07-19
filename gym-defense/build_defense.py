# -*- coding: utf-8 -*-
"""ジム防衛オススメツール データ生成スクリプト
gym-attack/data/gym_data.json と iv-checker の伝説フラグを元に
防衛スコアを事前計算し data/defense_data.js を出力する。
メタ分布(META_RAW)を更新して再実行すれば全順位が再計算される。
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

# ── メタ分布データ(攻撃側の使用ポケモン集計。ここを更新して再実行) ──
# (名前, 主要攻撃技タイプ, 集計数)
META_RAW = [
    ('カイリキー', 'かくとう', 122), ('メタグロス', 'はがね', 66),
    ('ルカリオ', 'かくとう', 42), ('ミュウツー', 'エスパー', 42),
    ('マンムー', 'こおり', 38), ('ローブシン', 'かくとう', 28),
    ('ゼクロム', 'でんき', 24), ('カイオーガ', 'みず', 24),
    ('ダークライ', 'あく', 22), ('ギラティナ(オリジン)', 'ゴースト', 16),
    ('メルメタル', 'はがね', 16), ('ライコウ', 'でんき', 15),
    ('バンギラス', 'あく', 14), ('ディアルガ', 'はがね', 12),
    ('ガブリアス', 'じめん', 12), ('レシラム', 'ほのお', 11),
    ('サーナイト', 'フェアリー', 10), ('カイリュー', 'ドラゴン', 8),
    ('ヒードラン', 'ほのお', 8), ('ドサイドン', 'いわ', 7),
    ('グレイシア', 'こおり', 7), ('ゲンガー', 'ゴースト', 6),
    ('エレキブル', 'でんき', 5), ('レックウザ', 'ドラゴン', 4),
    ('フシギバナ', 'くさ', 3), ('トゲキッス', 'フェアリー', 3),
    ('リザードン', 'ほのお', 3), ('ヒヒダルマ(ガラル)', 'こおり', 3),
    ('シャンデラ', 'ゴースト', 3), ('ラグラージ', 'みず', 3),
    ('ドリュウズ', 'じめん', 3), ('ロズレイド', 'くさ', 3),
]

# ── キャリブレーション定数(分析メモとの最小二乗フィット結果) ──
K_BULK = 1.2328          # 耐久P = K_BULK × HP×防御/1000 (PL50, 個体値15)
# タイプP = チェックリスト方式: 格闘耐性+3/二重+6/弱点-6、岩弱点-3(格闘弱点時は無し)を
# メモの明示ルールとして固定し、鋼・氷・電気・悪・ゴーストの耐性/弱点係数はメモ実測値への
# 制約付きリッジ回帰でフィット(calib_type.jsonに保存)
C_INT, D_INT = None, None      # 迎撃P = max(0, C + D×迎撃生値) ※calib_int.jsonから読込
SP_WEIGHT = 0.15         # スペシャル技の比重(発動が確率依存のため低め)
INT_WEIGHT = 1.9         # 迎撃ポイント全体の重み(火力の影響度。シャンデラが込み20位以内に入る調整)
# ゲージ分割係数: 発動判定が1/2のため早め放出が有利。2分割が最良、
# 1ゲージは溜め切り不発リスクで大幅減点、3分割は1発が軽く効率減
BAR_FACTOR = {2: 1.0, 3: 0.85, 1: 0.5}
DUR_ALPHA = 0.25         # 発生時間補正: 速い技ほど有利 (2.5秒/発生秒)^α
SECOND_MOVE_RATIO = 0.80 # ベスト技スコアの80%以上なら2番手技も併記

name2mon = {}
for p in gd['pokemon']:
    name2mon.setdefault(p['name'], p)

meta = []
tw = sum(c for _, _, c in META_RAW)
for nm, mtype, cnt in META_RAW:
    p = name2mon.get(nm)
    if not p:
        print('WARN meta not found:', nm); continue
    meta.append({'name': nm, 'mt': ti[mtype], 'dt': p['types'], 'w': cnt / tw})

def incoming_eff(types):
    s = 0.0
    for a in meta:
        m = 1.0
        for dt in types: m *= CH[a['mt']][dt]
        s += a['w'] * m
    return s

def outgoing_eff(move_type):
    s = 0.0
    for a in meta:
        m = 1.0
        for dt in a['dt']: m *= CH[move_type][dt]
        s += a['w'] * m
    return s

OUT_CACHE = {t: outgoing_eff(t) for t in range(18)}

_ci = json.load(open(os.path.join(BASE, 'calib_int.json')))
C_INT, D_INT = _ci['c'], _ci['d']
_ct = json.load(open(os.path.join(BASE, 'calib_type.json')))

def type_score(types):
    def m(atk):
        v = 1.0
        for dt in types: v *= CH[ti[atk]][dt]
        return v
    s = _ct['intercept']
    f = m('かくとう')
    if f <= 0.4: s += 6
    elif f <= 0.63: s += 3
    elif f >= 1.6: s += _ct.get('fight_weak_pen', -6)  # 格闘弱点(ユーザー調整で-8)
    if m('いわ') >= 1.6 and f < 1.6: s -= 3
    for t in _ct['fit_core']:
        mu = m(t); c = _ct['coef'][t]
        if mu <= 0.63: s += c['res']
        if mu <= 0.4: s += c['dbl']
        if mu >= 1.6: s += c['weak']
    # 耐性の多さボーナス: 全18タイプ中の耐性数×係数(メタグロス等の複合耐性を評価)
    n_res = sum(1 for t in range(18) if all_mult(t, types) <= 0.63)
    s += _ct.get('resist_count_coef', 0) * n_res
    return s

def all_mult(atk_i, types):
    v = 1.0
    for dt in types: v *= CH[atk_i][dt]
    return v

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
    eff = incoming_eff(p['types'])
    atk50 = (p['atk'] + 15) * CPM50   # 攻撃実数値(PL50, 個体値15)
    # ノーマルアタック: DPH最大を選択
    best_na = None
    for f in p.get('fast', []):
        fm = MV.get(f)
        if not fm: continue
        na = fm['power'] * (1.2 if fm['type'] in p['types'] else 1.0) * OUT_CACHE[fm['type']]
        if best_na is None or na > best_na[0]:
            best_na = (na, fm['jp'])
    # スペシャル: ゲージ分割係数×発生時間補正込みで全技採点し上位2つを併記候補に
    sps = []
    for c in p.get('charged', []):
        cm = MV.get(c)
        if not cm: continue
        sp = cm['power'] * (1.2 if cm['type'] in p['types'] else 1.0) * OUT_CACHE[cm['type']]
        sp *= BAR_FACTOR.get(cm.get('bars'), 1.0)   # 2分割最良・1ゲージ減点・3分割やや減
        dur = (cm.get('dur') or 2500) / 1000.0
        sp *= (2.5 / dur) ** DUR_ALPHA              # 発生の速い技をわずかに優遇
        sps.append((sp, cm['jp']))
    if not best_na or not sps: continue
    sps.sort(key=lambda x: -x[0])
    best = (atk50 * (best_na[0] + SP_WEIGHT * sps[0][0]), best_na[1], sps[0][1])
    cm2 = sps[1][1] if len(sps) > 1 and sps[1][0] >= sps[0][0] * SECOND_MOVE_RATIO else None
    p_bulk = K_BULK * bulk
    p_type = type_score(p['types'])
    p_int = INT_WEIGHT * max(0.0, C_INT + D_INT * best[0])
    p_yar = yaruki(cp)
    entries.append({
        'n': NAME_FIX.get(p['name'], p['name']), 't': p['types'], 'cp': cp,
        'pb': round(p_bulk, 1), 'pt': round(p_type, 1),
        'pi': round(p_int, 1), 'py': p_yar,
        'total': round(p_bulk + p_type + p_int + p_yar, 1),
        'fm': best[1], 'cm': best[2], 'cm2': cm2, 'dw': 1 if double_weak(p['types']) else 0,
    })

entries.sort(key=lambda x: -x['total'])
out = {
    'generated': True,
    'types_jp': T,
    'meta': [{'name': m['name'], 'type': T[m['mt']], 'w': round(m['w'], 4)} for m in meta],
    'entries': entries,
}
os.makedirs(os.path.join(BASE, 'data'), exist_ok=True)
js = 'const DEFENSE_DATA = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(os.path.join(BASE, 'data', 'defense_data.js'), 'w', encoding='utf-8').write(js)
json.dump(out, open(os.path.join(BASE, 'data', 'defense_data.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('entries:', len(entries))
print('top5:', [e['n'] for e in entries[:5]])
