# -*- coding: utf-8 -*-
"""ジム挑戦ツール データ同期スクリプト
=====================================
火力チェッカーの godata.json（build_data.py が最新Game Masterから生成）を元に
data/gym_data.json / data/gym_data.js を更新する。

gym_data.json はもともと手作業更新で、新実装ポケモン（新メガ等）が
取り残される問題があったため、2026-08-09 にこの同期スクリプトを作成した。
以後は  python3 build_data.py → python3 gym-attack/build_gym.py  の順で実行すれば
ジム挑戦（と、これを元にする ジム防衛・マックスバトル）にも新ポケモンが反映される。

同期のルール（既存データの表示名・並びを壊さないための安全設計）:
  1) 既存エントリと godata を「名前の正規化一致」で突き合わせ、
     一致したものは 種族値・タイプ・わざ・シャドウ可否 を godata の値で更新する
  2) 名前で一致しないが「種族値+タイプ」が既存のどれかと同じものは追加しない
     （コスチューム違い等の重複を作らないため）
  3) どちらでも一致しないもの（=新実装）を末尾に追加する
  4) gym_data だけにある既存エントリはそのまま残す
  5) moves は参照される全わざを godata から変換して再構築
     （PvE値: fast=エネルギー正 / charged=バーは -100→1本, -50→2本, -33→3本）
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
GOD = os.path.join(REPO, 'godata.json')
OUT_JSON = os.path.join(HERE, 'data', 'gym_data.json')
OUT_JS = os.path.join(HERE, 'data', 'gym_data.js')

god = json.load(open(GOD, encoding='utf-8'))
gym = json.load(open(OUT_JSON, encoding='utf-8'))

TYPES = god['types']            # 英語タイプ順 = types_jp と同じ並び
ti = {t: i for i, t in enumerate(TYPES)}
REGION = ['ガラル', 'アローラ', 'ヒスイ', 'パルデア']


def norm(name):
    """表記ゆれを吸収した比較用の名前。全角括弧→半角、地方プレフィックス→(地方)サフィックス"""
    s = name.replace('（', '(').replace('）', ')')
    for r in REGION:
        if s.startswith(r):
            base = s[len(r):]
            s = base + f'({r})'
            break
    return s


def sig(atk, df, h, ty):
    return (atk, df, h, tuple(sorted(ty)))


# ---- 既存エントリの索引 ----
by_name = {}
by_sig = set()
for p in gym['pokemon']:
    by_name.setdefault(norm(p['name']), p)
    by_sig.add(sig(p['atk'], p['def'], p['sta'], p['types']))
    # 「ヒヒダルマ(通常)」のような (通常) 付きは素の名前でも引けるようにする
    n = norm(p['name'])
    if n.endswith('(通常)'):
        by_name.setdefault(n[:-4], p)

# 図鑑番号の推定用: iv-checker の POKE(日本語名→図鑑番号)
dex_by_name = {}
try:
    html = open(os.path.join(REPO, 'iv-checker', 'index.html'), encoding='utf-8').read()
    for p in json.loads(re.search(r'const POKE = (\[.*?\]);', html, re.S).group(1)):
        dex_by_name.setdefault(norm(p['n']), p['d'])
except Exception as e:
    print('注意: iv-checkerから図鑑番号を読めませんでした →', e)


# iv-checkerにも載っていない名前の図鑑番号(手動補完)
DEX_FIX = {'メテノ': 774, 'ウーラオス': 892}


def guess_dex(n):
    if n in DEX_FIX:
        return DEX_FIX[n]
    if n in dex_by_name:
        return dex_by_name[n]
    # メガ○○X → ○○ の図鑑番号を継承（メガニウム等の紛れは by_name 一致が先に付くので安全）
    m = re.match(r'^(メガ|ゲンシ)(.+?)(X|Y)?$', n)
    if m:
        base = by_name.get(m.group(2)) or by_name.get(norm(m.group(2)))
        if base:
            return base['dex']
    return 0


# ---- godata から更新・追加 ----
# メガの追加SPアタック「＋わざ」は、ジムに配置されたポケモンとのジムバトルでは使えない(公式)。
# godata側は plus フィールドに印を持っているので、それを集めて除外する(自動で追随する)
PLUS_MOVES = {v['plus'] for v in god['pokemon'].values() if v.get('plus')}
if PLUS_MOVES:
    print(f'ジムバトルで使えない＋わざを除外: {len(PLUS_MOVES)}本')
added, updated = [], []
for k, v in god['pokemon'].items():
    ty = [ti[t] for t in v['ty']]
    fast = v['q'] + v['eq']
    charged = [m for m in (v['c'] + v['ec']) if m not in PLUS_MOVES]
    if not fast or not charged:
        continue   # 技が欠けるものはジム計算に使えない
    n = norm(v['n'])
    hit = by_name.get(n)
    if hit is not None:
        # 実質的な変化があるときだけ書き換える（わざは集合で比較し、並びだけの差分を作らない）
        same = (hit['atk'], hit['def'], hit['sta']) == (v['a'], v['df'], v['h']) \
            and sorted(hit['types']) == sorted(ty) \
            and set(hit['fast']) == set(fast) and set(hit['charged']) == set(charged) \
            and hit['shadow'] == bool(v.get('shadow')) \
            and bool(hit.get('mega')) == bool(v.get('mega'))
        if not same:
            hit.update({'atk': v['a'], 'def': v['df'], 'sta': v['h'], 'types': ty,
                        'fast': fast, 'charged': charged, 'shadow': bool(v.get('shadow'))})
            if v.get('mega'):
                hit['mega'] = True
            updated.append(hit['name'])
        continue
    if sig(v['a'], v['df'], v['h'], ty) in by_sig:
        continue   # 名前は違うが中身が同じ(コスチューム等)は追加しない
    entry = {'name': n, 'dex': guess_dex(n), 'types': ty, 'atk': v['a'], 'def': v['df'], 'sta': v['h'],
             'fast': fast, 'charged': charged, 'shadow': bool(v.get('shadow'))}
    if v.get('mega'):
        entry['mega'] = True
    if not entry['dex']:
        print('注意: 図鑑番号が分からないまま追加 →', n)
    gym['pokemon'].append(entry)
    by_sig.add(sig(v['a'], v['df'], v['h'], ty))
    added.append(n)

# ---- moves を再構築（参照される全わざ + 既存の温存） ----
used = set()
for p in gym['pokemon']:
    used.update(p['fast'])
    used.update(p['charged'])
moves = dict(gym['moves'])   # godataに無い既存エントリは温存
missing = []
for mid in sorted(used):
    gm = god['moves'].get(mid)
    if not gm:
        if mid not in moves:
            missing.append(mid)
        continue
    e = gm['e']
    moves[mid] = {'jp': gm['n'], 'type': ti[gm['t']], 'power': gm['p'],
                  'energy': e, 'dur': int(round(gm['d'] * 1000)),
                  # dw = ダメージが出るまでの時間 / dwe = ダメージ判定が終わる時間(ミリ秒)。
                  #      全体の長さ(dur)とは別物。例: じしんは dur=3500 だが dw=2600 で先にダメージが出る
                  'dw': int(round(gm.get('w', 0) * 1000)) or None,
                  'dwe': int(round(gm.get('we', 0) * 1000)) or None,
                  'fast': e > 0,
                  'bars': None if e > 0 else (1 if e <= -100 else 2 if e <= -50 else 3)}
gym['moves'] = moves
if missing:
    print('警告: godataに無いわざ →', missing)

out = json.dumps(gym, ensure_ascii=False, separators=(',', ':'))
open(OUT_JSON, 'w', encoding='utf-8').write(out)
open(OUT_JS, 'w', encoding='utf-8').write('window.GYM_DATA=' + out + ';\n')
print(f'完了: ポケモン{len(gym["pokemon"])}種 / わざ{len(moves)}種')
print(f'追加 {len(added)}件: {"、".join(added[:20])}{" …" if len(added) > 20 else ""}')
print(f'更新 {len(updated)}件: {"、".join(updated[:10])}{" …" if len(updated) > 10 else ""}')
