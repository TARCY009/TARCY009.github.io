#!/usr/bin/env python3
# 全ポケモンの「ページの単位の一覧」を作る（build2.py の PAGES の全員版）。
# 出力: data/roster.json ＝ [{pk, gk, gm, names, title?, kind, related:[[種類, 対戦データのキー]], merged:[...]}]
# 決まり（2026-09-21タダシさん決定）:
#   - メガシンカ・ゲンシカイキも1ページずつ作る（元のポケモンと互いにリンク）
#   - コスチューム違いでページを作らない／見た目だけ違うすがた（種族値・タイプ・わざが同じ）は1ページにまとめる
#   - 実装済みだけ（未実装・バトル中だけの内部フォルムは作らない）
import json, os, re, collections, unicodedata
from gm_extract import SET, HERE, ROOT

PVP = json.load(open(os.path.join(ROOT, 'pvp_data.json'), encoding='utf-8'))
GO = json.load(open(os.path.join(ROOT, 'godata.json'), encoding='utf-8'))
GMJ = json.load(open(os.path.join(HERE, 'data', 'gm.json'), encoding='utf-8'))
P, G = PVP['pokemon'], GO['pokemon']

def norm(s):
    return unicodedata.normalize('NFKC', s).replace(' ', '')

def plain(n):          # 括弧の中（フォルム名）を落とした名前
    return re.sub(r'[（(].*?[）)]', '', norm(n))

COSTUME_KEYS = {k for k in P if re.match(r'^pikachu_', k)}      # 対戦データに入っているコスチューム（ページを作らない）

# 図鑑番号 → ゲームデータの pokemonId
DEX2PID = {}
for t, s in SET.items():
    m = re.match(r'^V(\d{4})_POKEMON_', t)
    if m:
        DEX2PID.setdefault(int(m.group(1)), s.get('pokemonId'))

GO_BY_NAME = {}
for k, g in G.items():
    GO_BY_NAME.setdefault(norm(g['n']), k)

FORCE = {'ditto'}      # 情報元が未実装扱いのままだが実装済みのもの（メタモン）
rel = {k: p for k, p in P.items() if (p.get('r') or k in FORCE) and not p.get('hid') and k not in COSTUME_KEYS}

# 見た目だけ違うすがたをまとめる
sig_of = lambda p: (p['dex'], p.get('a'), p.get('d'), p.get('h'), tuple(p.get('ty', [])),
                    tuple(sorted(p.get('q', []) + p.get('eq', []))), tuple(sorted(p.get('c', []) + p.get('ec', []))))
groups = collections.OrderedDict()
for k, p in rel.items():
    groups.setdefault(sig_of(p), []).append(k)

by_dex = collections.defaultdict(list)       # 図鑑番号 → ページの代表キー
pages = collections.OrderedDict()
for ks in groups.values():
    k = ks[0]
    p = P[k]
    names = [P[x]['n'] for x in ks]
    title = None
    if len(ks) > 1:
        title = plain(p['n'])
        names = [title] + names
    gk = GO_BY_NAME.get(norm(p['n'])) or GO_BY_NAME.get(plain(p['n']))
    if gk and plain(G[gk]['n']) == norm(G[gk]['n']) and norm(G[gk]['n']) != norm(p['n']):
        names = [G[gk]['n']] + [n for n in names if n != G[gk]['n']]      # ジム・レイド側は括弧なしの名前（例: ギルガルド）
        title = title or G[gk]['n']
    pid = DEX2PID.get(p['dex'])
    suffix = k[len(pid or ''):].upper() if pid and k.startswith((pid or '').lower()) else ''
    gm = pid
    for cand in ((pid or '') + suffix, (pid or '') + suffix.replace('_ALOLAN', '_ALOLA').replace('_PALDEAN', '_PALDEA'), (pid or '') + suffix.replace('_HISUIAN', '_HISUI').replace('_GALARIAN', '_GALAR')):
        if cand in GMJ and cand != pid:
            gm = cand
            break
    kind = 'primal' if k.endswith('_primal') else 'mega' if p.get('mega') or '_mega' in k else 'form' if suffix else 'base'
    pages[k] = dict(pk=k, gk=gk, gm=gm, pid=pid, names=names, kind=kind, related=[], merged=ks[1:])
    if title:
        pages[k]['title'] = title
    by_dex[p['dex']].append(k)

# 進化のつながり（ゲームデータの evolutionBranch をたどる）
OWN_GM = set()
def page_owner(fk):
    return fk in OWN_GM      # そのすがたが自分のページを持っているか（地方のすがたなど）
def evo_targets(gm_key, seen=None):
    seen = seen if seen is not None else set()
    out = []
    brs = [x for x in (GMJ.get(gm_key) or {}).get('evolutionBranch', []) if x.get('evolution')]
    if not brs and 'form' not in (GMJ.get(gm_key) or {'form': 1}):      # 見た目だけ違うすがたにしか進化が書かれていないとき（シキジカ）
        for fk, fg in GMJ.items():
            if fg.get('pokemonId') == gm_key and 'form' in fg and not page_owner(fk):
                brs = [x for x in fg.get('evolutionBranch', []) if x.get('evolution')]
                if brs:
                    break
    for br in brs:
        ev = br.get('evolution')
        if not ev or ev in seen:
            continue
        seen.add(ev)
        form = br.get('form')
        out.append((ev, form))
        nxt = form if form in GMJ else ev
        out += evo_targets(nxt, seen)
    return out

PID2DEX = {v: k for k, v in DEX2PID.items()}
def page_for(pid, form):
    cands = by_dex.get(PID2DEX.get(pid), [])
    if form:
        suf = form[len(pid):].lower().replace('_normal', '')
        for c in cands:
            if c == pid.lower() + suf or c in {pid.lower() + suf.replace(a, z) for a, z in (('_alola', '_alolan'), ('_paldea', '_paldean'), ('_galar', '_galarian'), ('_hisui', '_hisuian'))}:
                return c
    base = [c for c in cands if pages[c]['kind'] in ('base', 'form')]
    return base[0] if base else None

KIND_JA = {'mega': 'メガシンカ', 'primal': 'ゲンシカイキ'}
OWN_GM |= {pg['gm'] for pg in pages.values() if pg['gm'] != pg['pid']}
for k, pg in pages.items():
    relk = []
    if pg['kind'] in ('mega', 'primal'):
        base = [c for c in by_dex[P[k]['dex']] if pages[c]['kind'] == 'base'] or [c for c in by_dex[P[k]['dex']] if pages[c]['kind'] == 'form']
        relk += [('メガシンカ前' if pg['kind'] == 'mega' else 'ゲンシカイキ前', c) for c in base[:1]]
        relk += [(KIND_JA[pages[c]['kind']], c) for c in by_dex[P[k]['dex']] if c != k and pages[c]['kind'] in KIND_JA]
    else:
        for ev, form in evo_targets(pg['gm'] if pg['gm'] in GMJ else pg['pid']):
            c = page_for(ev, form)
            if c and c != k and ('進化', c) not in relk:
                relk.append(('進化', c))
                relk += [(KIND_JA[pages[m]['kind']], m) for m in by_dex[P[c]['dex']] if pages[m]['kind'] in KIND_JA and (KIND_JA[pages[m]['kind']], m) not in relk]
        # 合体・フォルムチェンジの行き先（ゲームデータの formChange）
        fcj = {}
        for fc in (GMJ.get(pg['gm']) or {}).get('formChange', []) + (GMJ.get(pg['pid']) or {}).get('formChange', []):
            fuse = (fc.get('componentPokemonSettings') or {}).get('formChangeType') == 'FUSE'
            for f in fc.get('availableForm', []):
                fcj[f.lower()] = '合体' if fuse else 'フォルムチェンジ'
        for c in by_dex[P[k]['dex']]:
            if c == k:
                continue
            kj = KIND_JA.get(pages[c]['kind']) or fcj.get(c) or 'ほかのすがた'
            if (kj, c) not in relk:
                relk.append((kj, c))
    pg['related'] = relk

out = list(pages.values())
json.dump(out, open(os.path.join(HERE, 'data', 'roster.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
cnt = collections.Counter(pg['kind'] for pg in out)
print('ページ数', len(out), dict(cnt))
print('ジム・レイド側のキーなし', [(pg['pk'], pg['names'][0]) for pg in out if not pg['gk']])
print('ゲームデータのキーなし', [(pg['pk']) for pg in out if not pg['gm'] or pg['gm'] not in GMJ])
print('まとめたすがた', [(pg['pk'], pg['merged']) for pg in out if pg['merged']])
