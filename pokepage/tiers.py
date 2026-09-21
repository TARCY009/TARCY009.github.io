#!/usr/bin/env python3
# 全ページの「強い場面の数」を数えて、段階公開の組み分けと、検索エンジンに載せない（noindex）候補を出す。
# 強い場面の基準は build3.py のタイルの点灯と同じ:
#   レイド＝タイプ別火力40位以内／ジム＝挑戦S・Aクラス か 防衛総合50位以内（二重弱点なし・伝説幻は防衛なし）／
#   マックスバトル＝タイプ別10位以内／GBL＝環境上位50匹に入る か 環境勝率40%以上／ロケット団＝対策30位以内＋どのわざでも先に倒されない
# 出力: data/tiers.json ＝ {pk: {strong:[場面], n, tier, noindex}}
import json, os, re, collections, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__))
L = lambda f: json.load(open(os.path.join(HERE, 'data', f), encoding='utf-8'))
norm = lambda s: unicodedata.normalize('NFKC', s).replace(' ', '')

ROSTER, GMJ = L('roster.json'), L('gm.json')
TD, GYM, GDEF, MX, RK = L('typedps.json'), L('gym.json'), L('gymdef.json'), L('maxtype.json'), L('rocket.json')
GBL = [L('gbl_%s.json' % c) for c in ('1500', '2500', '0')]
NOTES = json.load(open(os.path.join(HERE, 'notes.json'), encoding='utf-8'))

raid = {}
for t, d in TD['types'].items():
    for r in d['all']:
        if r['rank'] <= 40:
            raid[r['k']] = min(raid.get(r['k'], 999), r['rank'])
gym_cls = {norm(r['name']): r['cls'] for r in GYM['gymeval']['rows']}
gdef = {norm(r['n']): r for r in GDEF['total']}
mx = {}
for t, d in MX.items():
    for kind in ('atk', 'tank'):
        for r in d[kind]:
            if r['rank'] <= 10:
                mx[norm(r['n'])] = min(mx.get(norm(r['n']), 99), r['rank'])
rkt = set()
for f in RK['foes']:
    for r in f['rows']:
        if r['rank'] <= 30 and r.get('checked') and r.get('win') and not r.get('loseTo'):
            rkt.add(r['k'])

LEG = ('POKEMON_CLASS_LEGENDARY', 'POKEMON_CLASS_MYTHIC', 'POKEMON_CLASS_ULTRA_BEAST')
out, dist = {}, collections.Counter()
for pg in ROSTER:
    k, names = pg['pk'], [norm(n) for n in pg['names']]
    cls = (GMJ.get(pg['gm']) or GMJ.get(pg['pid']) or {}).get('pokemonClass')
    legend = cls in LEG
    S = []
    if pg['gk'] and pg['gk'] in raid:
        S.append('raid')
    dr = next((gdef[n] for n in names if n in gdef), None)
    if any(gym_cls.get(n) in ('S', 'A') for n in names) or (dr and not legend and dr.get('rank') and dr['rank'] <= 50 and not dr['dw']):
        S.append('gym')
    if any(n in mx for n in names):
        S.append('max')
    for g in GBL:
        e = g['data'].get(k)
        if e and k != 'ditto' and any((k in g['meta']) or float(v['score']) >= 40 for v in e.values() if v.get('score') is not None):
            S.append('gbl')
            break
    if k in rkt:
        S.append('rocket')
    final = not any(kj == '進化' for kj, _ in pg['related'])
    special = bool(NOTES.get(k, {}).get('ok')) or bool((GMJ.get(pg['gm']) or {}).get('formChange'))
    n = len(S)
    # 段階（2026-09-21の方式）: ①最終進化・メガ・伝説で強い場面が2つ以上 ②進化前で進化先が①（人気の進化前の代わりの機械的な目安） ③残り
    tier = 1 if (n >= 2 and (final or legend or pg['kind'] in ('mega', 'primal'))) else 3
    out[k] = dict(name=pg.get('title') or pg['names'][0], strong=S, n=n, final=final, legend=legend, special=special, tier=tier)
for pg in ROSTER:
    o = out[pg['pk']]
    if o['tier'] == 3 and any(kj == '進化' and out[c]['tier'] == 1 for kj, c in pg['related']):
        o['tier'] = 2
for o in out.values():
    # 載せない候補: 強い場面が1つも無く、進化先にも①が無く、そのポケモンだけの仕様も無い
    o['noindex'] = (o['n'] == 0 and o['tier'] == 3 and not o['special'])
    dist[(o['tier'], o['n'])] += 1

json.dump(out, open(os.path.join(HERE, 'data', 'tiers.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('全ページ', len(out))
print('強い場面の数ごと', dict(sorted(collections.Counter(o['n'] for o in out.values()).items())))
print('場面ごと', dict(collections.Counter(s for o in out.values() for s in o['strong'])))
for t in (1, 2, 3):
    print('段階%d' % t, sum(1 for o in out.values() if o['tier'] == t))
print('載せない候補（noindex）', sum(1 for o in out.values() if o['noindex']))
print('\n段階1の例', [o['name'] for o in out.values() if o['tier'] == 1][:40])
print('\n載せない候補の例', [o['name'] for o in out.values() if o['noindex']][:40])
print('\n段階3で載せるものの例', [(o['name'], o['strong']) for o in out.values() if o['tier'] == 3 and not o['noindex']][:25])
