#!/usr/bin/env python3
# 全員ぶんのデータ（data/*.json＝各ツール本体の出口から集めたもの）の読み取り係。
# build2.py の td_rows / max_rows / gbl_of / rkt_best と同じ形で返す＝ページを組む側（build4.py）は見本のときと同じ書き方で使える。
import json, os, re, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
J = lambda *p: json.load(open(os.path.join(*p), encoding='utf-8'))
L = lambda f: J(HERE, 'data', f)
GO, PVP = J(ROOT, 'godata.json'), J(ROOT, 'pvp_data.json')
norm = lambda s: s.replace('(', '（').replace(')', '）')

ROSTER, GM = L('roster.json'), L('gm.json')
TD, BULK, MX, RK, GYMEVAL = L('typedps.json')['types'], L('bulk.json'), L('maxtype.json'), L('rocket.json'), L('gym.json')['gymeval']
GBLF = {c: L('gbl_%s.json' % c) for c in ('1500', '2500', '0')}
TYPE_ORDER = ['NORMAL', 'GRASS', 'FIRE', 'WATER', 'ELECTRIC', 'ICE', 'ROCK', 'FLYING', 'BUG', 'PSYCHIC',
              'GHOST', 'FIGHTING', 'GROUND', 'POISON', 'DRAGON', 'STEEL', 'DARK', 'FAIRY']
RAID_TOP, MAX_TOP, BULK_TOP = 40, 10, 100

GO_BY_NAME = {}
for _k, _g in GO['pokemon'].items():
    GO_BY_NAME.setdefault(norm(_g['n']), _k)

def _gks(names):
    return {GO_BY_NAME[norm(n)] for n in names if norm(n) in GO_BY_NAME}

# ---------- タイプ別火力 ----------
_TDI = {t: {w: {(r['k'], bool(r['sh'])): r for r in e[w]} for w in ('base', 'all')} for t, e in TD.items()}

def _mvname(gk, mid, special):
    m = GO['moves'].get(mid) or {}
    return (m.get('n') or mid) + ('*' if special else '')

def _combo(r):
    g = GO['pokemon'].get(r['k'], {})
    return _mvname(r['k'], r['f'], r['f'] in g.get('eq', []) and r['f'] not in g.get('q', [])) + '＋' + \
        _mvname(r['k'], r['c'], r['c'] in g.get('ec', []) and r['c'] not in g.get('c', []))

def td_rows(names):
    gks, out = _gks(names), []
    for t in TYPE_ORDER[1:]:
        ix = _TDI.get(t)
        if not ix:
            continue
        for sh in (False, True):
            for gk in gks:
                base = ix['base'].get((gk, sh)) if not sh else None
                both = ix['all'].get((gk, sh))
                if base and base['rank'] > RAID_TOP:
                    base = None
                if both and both['rank'] > RAID_TOP:
                    both = None
                if base:
                    out.append(dict(t=t, sh=sh, rank=base['rank'], rank_all=both['rank'] if both else None, mv=_combo(base), dps=float(base['dps']), only_all=False))
                elif both:
                    out.append(dict(t=t, sh=sh, rank=both['rank'], rank_all=None, mv=_combo(both), dps=float(both['dps']), only_all=True))
    return out

def td_top(r):
    e = TD[r['t']]
    return float((e['all'] if (r['sh'] or r['only_all']) else e['base'])[0]['dps'])

# ---------- 耐久指数 ----------
_BULKI = {r['k']: r['rank'] for r in BULK['base'] if not r['sh']}
def bulk_rank(names):
    rk = [_BULKI[g] for g in _gks(names) if g in _BULKI and _BULKI[g] <= BULK_TOP]
    return min(rk) if rk else None

# ---------- マックスバトル タイプ別 ----------
CAT_JA = {'G': 'キョダイマックス', 'D': 'ダイマックス'}
def max_rows(names):
    ns, out = {norm(n) for n in names}, []
    for kind, key in (('maxatk', 'atk'), ('maxtank', 'tank')):
        for t in TYPE_ORDER:
            for r in MX.get(t.lower(), {}).get(key, []):
                if r['rank'] <= MAX_TOP and norm(r['n']) in ns:
                    out.append(dict(kind=kind, t=t, rank=r['rank'], form=(CAT_JA.get(r['cat'], '特別') if key == 'atk' else ''), pt=str(r['pts'])))
    return out

# ---------- GBL ----------
_src = open(os.path.join(ROOT, 'assets', 'meta_lists.js'), encoding='utf-8').read()
def _js_obj(name):
    m = re.search(r'window\.' + name + r'\s*=\s*', _src)
    return json.JSONDecoder().raw_decode(_src, m.end())[0] if m else {}
_LISTS, _EXT = _js_obj('META_LISTS'), _js_obj('META_EXT')
META100 = {c: [(m['k'], bool(m.get('s'))) for m in (_LISTS.get(c, []) + _EXT.get(c, []))] for c in ('1500', '2500', '0')}

def _pkname(key):
    k, _, s = key.partition('|')
    n = PVP['pokemon'].get(k, {}).get('n', k)
    return ('シャドウ' + n) if s else n

def _gbl_one(c, k, shadow):
    e = (GBLF[c]['data'].get(k) or {}).get('s' if shadow else 'n')
    if not e or e.get('score') is None or e.get('err'):
        return None
    meta = GBLF[c]['meta']
    mr = next((i + 1 for i, x in enumerate(META100[c]) if x == (k, shadow)), None)
    w, l = e.get('w', ''), e.get('l', '')
    win = [_pkname(meta[i]) for i, d in enumerate(w) if d == '3']
    lose = [_pkname(meta[i]) for i, d in enumerate(l) if d == '3']
    mvs = [(PVP['moves'].get(m) or PVP.get('plusMoves', {}).get(m) or {}).get('n') if m else None for m in e.get('mv', [])]
    return dict(score=float(e['score']), metaRank=mr, moves=mvs, r1=dict(ivs=e['ivs'], level=e['lv']), over=e.get('over'),
                win3=win[:5], lose3=lose[:5], nWin3=len(win), nLose3=len(lose), n=len(meta))

def gbl_of(k, shadow=False):
    out = {}
    for c in ('1500', '2500', '0'):
        o = _gbl_one(c, k, shadow)
        if o:
            out[c] = o
    return out

# ---------- ロケット団 ----------
def rkt_best(k):
    rows = []
    for f in RK['foes']:
        for r in f['rows']:
            if r['k'] != k:
                continue
            fast = (PVP['moves'].get(r['fast']) or {}).get('n', r['fast'])
            rows.append(dict(who=f['who'], foe=PVP['pokemon'][f['k']]['n'], rank=r['rank'], dps=float(r['dps']),
                             win=bool(r.get('win')) and not r.get('loseTo'), fast=fast, sh=bool(r.get('s'))))
    seen, out = set(), []
    for r in sorted(rows, key=lambda x: x['rank']):
        key = (r['foe'], r['sh'])
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out
