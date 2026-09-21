#!/usr/bin/env python3
# ゲーム内公開データ（max-battle/latest.json）から、全ポケモンぶんの「育成の情報」を抜き出す（gm_extract.py の全員版）。
# 出力: data/gm.json（キー＝pokemonId、フォルムで条件が違うものは form 名でも持つ）
# あわせて、進化の条件にどんな項目が出てくるかを数えて表示する（日本語の対応表を作るための下調べ）
import json, os, re, collections
from gm_extract import SET, slim, HERE

out, keys, vals = {}, collections.Counter(), collections.defaultdict(collections.Counter)
by_id = collections.defaultdict(list)
for t, p in SET.items():
    by_id[p.get('pokemonId')].append((t, p))

for pid, lst in by_id.items():
    base = next((p for t, p in lst if 'form' not in p), None) or lst[0][1]
    out[pid] = slim(base)
    for t, p in lst:
        if 'form' not in p:
            continue
        s = slim(p)
        if s.get('formChange') != out[pid].get('formChange') or s.get('evolutionBranch') != out[pid].get('evolutionBranch') \
                or s.get('tempEvoOverrides') != out[pid].get('tempEvoOverrides'):
            out[p['form']] = s

for k, p in out.items():
    for e in p.get('evolutionBranch', []):
        for a, b in e.items():
            keys[a] += 1
            if a not in ('evolution', 'form', 'candyCost', 'candyCostPurified', 'temporaryEvolution', 'temporaryEvolutionEnergyCost',
                         'temporaryEvolutionEnergyCostSubsequent', 'questDisplay', 'obPurificationEvolutionCandyCost'):
                vals[a][json.dumps(b, ensure_ascii=False)[:80]] += 1
    for fc in p.get('formChange', []):
        for a, b in fc.items():
            keys['FC.' + a] += 1
            if a in ('item',):
                vals['FC.' + a][str(b)] += 1
        c = fc.get('componentPokemonSettings') or {}
        if c.get('formChangeType'):
            vals['FC.type'][c['formChangeType']] += 1

os.makedirs(os.path.join(HERE, 'data'), exist_ok=True)
json.dump(out, open(os.path.join(HERE, 'data', 'gm.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('件数', len(out), '／進化あり', sum(1 for p in out.values() if p.get('evolutionBranch')), '／フォルムチェンジあり', sum(1 for p in out.values() if p.get('formChange')))
print('\n== 進化・フォルムチェンジに出てくる項目')
for a, n in keys.most_common():
    print(f'  {a}: {n}')
print('\n== 条件の値')
for a, c in vals.items():
    print(' ', a)
    for v, n in c.most_common(40):
        print(f'     {n:4d}  {v}')
