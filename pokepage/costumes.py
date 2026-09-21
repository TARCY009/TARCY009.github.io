#!/usr/bin/env python3
# ゲーム内公開データのフォルム一覧から、コスチュームの印（isCostume）が付いたものを抜き出す。
# 出力: data/costumes.json（キー＝pokemonId → [{form, suf, ja}]）
# 日本語名は costume_names.json（手書き・語尾 → 日本語名）。**推測で付けない**——表に無い語尾は ja:null のままにして UNKNOWN に積む
# ⚠ ゲームデータに載るのは「フォルムとして実装されたコスチューム」だけ。古い帽子などは載っていない（costume_extra.json で手で足す）
import json, os, collections
from gm_extract import GM, HERE

NAMES_F = os.path.join(HERE, 'costume_names.json')
EXTRA_F = os.path.join(HERE, 'costume_extra.json')
NAMES = json.load(open(NAMES_F, encoding='utf-8')) if os.path.exists(NAMES_F) else {}
EXTRA = json.load(open(EXTRA_F, encoding='utf-8')) if os.path.exists(EXTRA_F) else {}

out, unknown = collections.OrderedDict(), collections.Counter()
for x in GM:
    fs = x.get('data', {}).get('formSettings')
    if not fs:
        continue
    pid = fs.get('pokemon')
    for f in fs.get('forms', []):
        if not f.get('isCostume'):
            continue
        form = f['form']
        suf = form[len(pid) + 1:] if form.startswith(pid + '_') else form
        ja = NAMES.get(form) or NAMES.get(suf)      # フォルム名そのもの（個別）→ 語尾（共通）の順で引く
        if not ja:
            unknown[suf] += 1
        out.setdefault(pid, []).append({'form': form, 'suf': suf, 'ja': ja})

for pid, lst in EXTRA.items():                       # 手で足すぶん（ゲームデータに載らないコスチューム）
    if pid.startswith('_'):
        continue
    for ja in lst:
        out.setdefault(pid, []).append({'form': None, 'suf': None, 'ja': ja})

os.makedirs(os.path.join(HERE, 'data'), exist_ok=True)
json.dump(out, open(os.path.join(HERE, 'data', 'costumes.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
n = sum(len(v) for v in out.values())
print('コスチュームのあるポケモン', len(out), '／総数', n, '／日本語名あり', sum(1 for v in out.values() for c in v if c['ja']))
if unknown:
    print('\n== 日本語名がまだ無い語尾（costume_names.json に足す）', len(unknown))
    for s, c in sorted(unknown.items()):
        print(f'  {c:3d} {s}')
