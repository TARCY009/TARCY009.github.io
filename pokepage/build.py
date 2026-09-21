#!/usr/bin/env python3
# 「1ポケモン1ページ」（/pokedex/<キー>/）を組む。ふだんは run.py から呼ばれる。
# データは data/（各ツール本体の出口から集めたもの・読み取りは full.py）、ページの一覧は data/roster.json。
# python3 build.py [キー…]      … 確認用に pokepage/out/ へ（全部 noindex・一覧は out.html）
# python3 build.py --publish    … 本番の置き場所へ（/pokedex/<キー>/・assets/pokepage.css・pokedex/pages.json・sitemap-pokemon.xml）
# 方針: 枠を減らして余白と字の大小で見せる／名前とタイプ色を主役に／数字は大きく・説明は短く／
#       コストや条件は文章にせずアイコン付きの札で見せる。
import json, os, re, sys, html, datetime, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as b   # 名前の変換・タイプ相性などの共通の部品
import full as F     # 全員ぶんのデータの読み取り（見本のときと同じ形で返す）
import gm_ja         # 進化の条件の日本語の札
b.PAGES = F.ROSTER
b.GM = F.GM
b.td_rows, b.max_rows, b.gbl_of, b.rkt_best = F.td_rows, F.max_rows, F.gbl_of, F.rkt_best
b.ITEM_JA = gm_ja.ITEM_JA
_d = datetime.date.today()
b.DATE_JA = '%d年%d月%d日' % (_d.year, _d.month, _d.day)
OUT = 'out'
# --publish のときは本番の置き場所（/pokedex/<キー>/）へ書く。省略時は確認用に pokepage/out/ へ（検索エンジンには全部見せない）
PUBLISH = '--publish' in sys.argv
SITE = 'https://gonavi.jp'
STAGE = 1   # サイトマップに載せる段階（①最終進化・メガ・伝説で強い場面が2つ以上 → ②人気の進化前 → ③残り の順に増やす）
TIERS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'tiers.json'), encoding='utf-8'))

HERE, ROOT, GO, PVP, GM, JA = b.HERE, b.ROOT, b.GO, b.PVP, b.GM, b.JA
esc, ty, max_cp, norm = b.esc, b.ty, b.max_cp, b.norm
CSS = open(os.path.join(HERE, 'page.css'), encoding='utf-8').read()
CSS += '.arrow small.cd{display:block;max-width:9.5em;margin:3px auto 12px;padding:2px 7px;border-radius:8px;background:rgba(255,255,255,.07);font-size:.66rem;line-height:1.35;white-space:normal;text-align:center}:root.light .arrow small.cd{background:rgba(20,30,70,.07)}.flow+.flow{margin-top:10px}'
_mx = open(os.path.join(ROOT, 'max-battle', 'data', 'max_data.js'), encoding='utf-8').read()
_roster = json.loads(_mx[_mx.index('{'):_mx.rindex('}') + 1])['roster']
MAXNAMES = {norm(x['n']) for x in _roster}
MAXDEX = {x['dex'] for x in _roster}
TARGET = 1500   # 本文の文字数の目標（薄いページにしないための下限）

MV_TYPE = {}
for src in (GO['moves'], PVP['moves'], PVP.get('plusMoves', {})):
    for m in src.values():
        MV_TYPE.setdefault(m['n'], m['t'])

def mv(name, size=15):
    n = name.strip()
    sp = n.endswith('*')
    key = n.rstrip('*')
    t = MV_TYPE.get(key)
    cls = ' class="spc"' if sp else ''
    return '<span class="mvn">' + (ty(t, size) if t else '') + '<i' + cls + '>' + esc(n) + '</i></span>'

def mv_combo(s):
    return '<span class="plus">＋</span>'.join(mv(x) for x in s.split('＋'))

# ---- アイコン（1色の線画・文字色に追従） ----
def ico(name):
    P = {
        'raid': '<path d="M12 2l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 15.4 6.7 18.4l1.2-6L3.4 8.3l6-.7z"/>',
        'gym': '<path d="M5 21V10l7-6 7 6v11M9 21v-6h6v6M3 21h18"/>',
        'max': '<path d="M12 2l8.5 5v10L12 22 3.5 17V7z"/><path d="M12 8v8M8.5 10l7 4M15.5 10l-7 4"/>',
        'gbl': '<path d="M4 4l7 7M4 4v4M4 4h4M20 4l-7 7M20 4v4M20 4h-4M7 14l-3 3 3 3 3-3M17 14l3 3-3 3-3-3"/>',
        'rocket': '<path d="M7 20V4h6a4.5 4.5 0 010 9H7M12 13l5 7"/>',
        'candy': '<circle cx="12" cy="12" r="4.5"/><path d="M8 9L3.5 6.5v5zM16 15l4.5 2.5v-5z"/>',
        'energy': '<path d="M13 2L5 13.5h6L10 22l9-12.5h-6z"/>',
        'dust': '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
        'walk': '<path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0113 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.3"/>',
        'move': '<path d="M4 12h12M12 6l6 6-6 6"/>',
        'shadow': '<path d="M12 2c.6 3.8 2 6 3.7 8.3 2 2.7 3.3 4.7 3.3 7.2 0 3-2.8 4.5-7 4.5s-7-1.5-7-4.5c0-2.7 1.6-5 3.2-6.4 0 1.7.4 2.9 1.1 3.7C9.6 11.5 10 7 12 2z"/>',
    }
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + P[name] + '</svg>'

def pill(icon, val, label='', cls=''):
    return '<span class="pill ' + cls + '">' + ico(icon) + '<b>' + str(val) + '</b>' + ('<small>' + esc(label) + '</small>' if label else '') + '</span>'

def section(anchor, en, title, body, lead=''):
    return ('<section id="' + anchor + '"><header class="sh"><span class="eb">' + en + '</span><h2>' + title + '</h2>'
            + ('<p>' + lead + '</p>' if lead else '') + '</header>' + body + '</section>')

TOOLS = {  # キー: (アイコンのフォルダ, ツール名, ツールの色)
    'dps': ('karyoku', 'レイド火力チェッカー', '#ff7a5c'), 'type-dps': ('type-dps', 'タイプ別火力ランキング', '#a68bff'),
    'gym-attack': ('gym-attack', 'ジム挑戦オススメツール', '#ffcc33'), 'gym-defense': ('gym-defense', 'ジム防衛オススメツール', '#7ee787'),
    'max-type': ('max-type', 'マックスバトル タイプ別', '#ff7a9c'), 'gbl': ('gbl', 'GBLシミュレーター', '#6ea1ff'),
    'rocket': ('rocket', 'GOロケット団対策シミュレーター', '#ff6b6b'), 'pokedex': ('pokedex', 'ステータス図鑑', '#bd93ff'),
    'bulk': ('bulk', '耐久指数ランキング', '#8ec9ff'),
}
def link(href, label):
    key = next((k for k in sorted(TOOLS, key=len, reverse=True) if href.startswith('/' + k + '/')), None)
    if not key:
        return '<a class="go" href="' + href + '">' + esc(label) + '<span>→</span></a>'
    d, name, col = TOOLS[key]
    return ('<a class="cta" style="--tc:' + col + '" href="' + href + '"><img src="/assets/icons/' + d + '/icon-192.png" alt="" width="44" height="44">'
            '<span class="ct"><small>' + esc(label) + '</small><b>' + esc(name) + '</b></span><span class="ca"><i></i></span></a>')

def ctas(*links):
    return '<div class="ctas">' + ''.join(links) + '</div>'

def cannot_defend(pg):
    return GM.get(pg['gm'], {}).get('pokemonClass') in ('POKEMON_CLASS_LEGENDARY', 'POKEMON_CLASS_MYTHIC', 'POKEMON_CLASS_ULTRA_BEAST')

DEFD = json.load(open(os.path.join(ROOT, 'gym-defense', 'data', 'defense_data.json'), encoding='utf-8'))['entries']
def def_ranks(names):
    ns = [norm(n) for n in names]
    me = next((e for e in DEFD if norm(e['n']) in ns), None)
    if not me:
        return None
    # 順位はジム防衛ツールの出口（data/gymdef.json）の値そのもの。二重弱点のあるポケモンは既定の一覧に出ないので、
    # ツールで「二重弱点も」を押したときの順位（rankAll）を使う（二重弱点を除いた中で数え直すと、ツールのどこにも無い数字になる）
    dw = bool(me.get('dw'))
    out = {}
    for lab, key in (('総合', 'total'), ('耐久', 'pb'), ('タイプ', 'pt'), ('やる気', 'py'), ('迎撃', 'pi')):
        r = _GDEF[key][norm(me['n'])]
        out[lab] = (r['rankAll'] if dw else r['rank'], float(r['v']))
    n = len(_GDEF['total']) if dw else sum(1 for r in _GDEF['total'].values() if not r['dw'])
    return dict(ranks=out, n=n, dw=dw, fm=me.get('fm'), cm=me.get('cm'), cm2=me.get('cm2'), cp=me.get('cp'))

_GDEF = {k: {norm(r['n']): r for r in v} for k, v in json.load(open(os.path.join(HERE, 'data', 'gymdef.json'), encoding='utf-8')).items()}

GYMEVAL = F.GYMEVAL
_GE = {}
for _r in GYMEVAL['rows']:
    _GE.setdefault(norm(_r['name']), _r)
def gym_eval(names):
    for n in names:
        if norm(n) in _GE:
            return _GE[norm(n)]
    return None

NAME2TY = {}
for _k, _v in PVP['pokemon'].items():
    NAME2TY.setdefault(norm(_v['n']), _v['ty'])
PAGE_OF = {}
for _pg in b.PAGES:
    for _n in _pg['names']:
        PAGE_OF[norm(_n)] = _pg['pk']
def pk_name(name, size=15, icons=True):
    """ポケモン名（タイプアイコンつき）。見本にページがあるポケモンはリンクにする"""
    base = norm(name)
    plain = base[4:] if base.startswith('シャドウ') else base
    tys = NAME2TY.get(plain)
    inner = (''.join(ty(t, size) for t in tys) if (icons and tys) else '') + '<i>' + esc(name) + '</i>'
    if plain in PAGE_OF:
        return '<a class="pkn" href="../' + PAGE_OF[plain] + '/">' + inner + '</a>'
    return '<span class="pkn">' + inner + '</span>'

def meter(pct):
    return '<span class="mt"><u style="width:' + str(max(3, min(100, round(pct)))) + '%"></u></span>'

def max_state(pg, p):
    if b.max_rows(pg['names']):
        return 'rank'
    fam = {PVP['pokemon'][k]['dex'] for _, k in pg['related']} | {p['dex']}
    if any(norm(n) in MAXNAMES for n in pg['names']):
        return 'in'
    if p['dex'] in MAXDEX:
        return 'family'
    if fam & MAXDEX:
        return 'family'
    return 'none'

# ---------- 5つの場面のタイル ----------
def tiles(pg, p):
    k, names = pg['pk'], pg['names']
    T = []
    td = b.td_rows(names)
    if td:
        r = min(td, key=lambda r: r['rank'])
        T.append(('raid', 'レイド', str(r['rank']), '位', JA[r['t']] + 'タイプの火力' + ('・シャドウ' if r['sh'] else ''), True))
    else:
        T.append(('raid', 'レイド', '—', '', 'タイプ別火力 上位40位の外', False))
    ge = gym_eval(names)
    dr = None if cannot_defend(pg) else def_ranks(names)
    drk = dr['ranks']['総合'][0] if dr else None
    gym_ok = bool((ge and ge['cls'] in ('S', 'A')) or (drk and drk <= 50 and not dr['dw']))
    atk = ('<em><small>挑戦</small><b>' + ge['cls'] + '</b><i>クラス</i><u>' + str(ge['rank']) + '位</u></em>') if ge else '<em><small>挑戦</small><b>—</b></em>'
    dfn = ('<em><small>防衛</small><b>' + str(drk) + '</b><i>位</i><u>総合</u></em>') if drk else '<em><small>防衛</small><b>—</b><u>' + ('置けません' if cannot_defend(pg) else '対象外') + '</u></em>'
    T.append(('gym', 'ジム', None, atk + dfn, ('ジム挑戦 ' + ge['cls'] + 'クラス' if ge else '') + ('・ジム防衛 総合%d位' % drk if drk else ''), gym_ok))
    mx = b.max_rows(names)
    ms = max_state(pg, p)
    if mx:
        r = min(mx, key=lambda r: r['rank'])
        T.append(('max', 'マックスバトル', str(r['rank']), '位', JA[r['t']] + ('を受けるタンク' if r['kind'] == 'maxtank' else 'のアタッカー'), True))
    else:
        T.append(('max', 'マックスバトル', '—', '', {'none': '未実装', 'family': ('進化先が活躍' if any(k == '進化' for k, _ in pg['related']) else 'ほかのすがたが活躍'), 'in': '10位以内なし'}[ms], False))
    g = b.gbl_of(k)
    if g and k != 'ditto':
        c, o = max(g.items(), key=lambda kv: kv[1]['score'])
        ok = bool(o.get('metaRank')) or o['score'] >= 40
        T.append(('gbl', 'GBL', '%.1f' % o['score'], '%', b.LG[c] + 'リーグの環境勝率', ok))
    else:
        T.append(('gbl', 'GBL', '—', '', '参加できません', False))
    rp = rkt_push(k)
    if rp:
        T.append(('rocket', 'ロケット団', str(rp[0]['rank']), '位', rp[0]['foe'] + 'を速く倒せる' + ('・シャドウ' if rp[0]['sh'] else ''), True))
    else:
        T.append(('rocket', 'ロケット団', '—', '', 'ゴリ押しには不向き', False))
    html_ = ''
    for a, lab, val, unit, cap, ok in T:
        if val is None:   # ジム: 挑戦と防衛の2つを並べる（unit に中身のHTMLが入っている）
            html_ += '<a class="tile two' + ('' if ok else ' off') + '" href="#' + a + '"><span class="tl">' + ico(a) + lab + '</span><span class="tw2">' + unit + '</span></a>'
            continue
        html_ += ('<a class="tile' + ('' if ok else ' off') + '" href="#' + a + '"><span class="tl">' + ico(a) + lab + '</span>'
                  '<span class="tv">' + val + '<i>' + unit + '</i></span><span class="tc">' + esc(cap) + '</span></a>')
    return html_, T

# ---------- 関連するすがた ----------
def related(pg, lead=False):
    if not pg['related']:
        return ''
    items, any_bits = '', False
    for kind, rk in pg['related']:
        p = PVP['pokemon'][rk]
        n = p['n']
        bits = []
        td = b.td_rows([n])
        if td:
            r = min(td, key=lambda r: r['rank'])
            bits.append(('レイド', JA[r['t']] + 'の火力', str(r['rank']) + '位'))
        g = b.gbl_of(rk)
        if g:
            c, o = max(g.items(), key=lambda kv: kv[1]['score'])
            if o.get('metaRank') or o['score'] >= 40:
                bits.append(('GBL', b.LG[c] + 'リーグ', '%.1f%%' % o['score']))
        mx = b.max_rows([n])
        if mx:
            r = min(mx, key=lambda r: r['rank'])
            bits.append(('マックス', JA[r['t']] + ('タンク' if r['kind'] == 'maxtank' else 'アタッカー'), str(r['rank']) + '位'))
        bk = F.bulk_rank([n])
        if bk:
            bits.append(('耐久', '耐久指数', str(bk) + '位'))
        any_bits = any_bits or bool(bits)
        c1 = b.TCOL[JA[p['ty'][0]]]
        stats = ''.join('<span><small>' + x[0] + '</small>' + esc(x[1]) + '<b>' + x[2] + '</b></span>' for x in bits) or '<span class="no">上位の項目なし</span>'
        items += ('<li style="--c:' + c1 + '"><div class="rh"><em>' + kind + '</em><strong>' + pk_name(n, 18) + '</strong>'
                  '<small>最大CP ' + str(max_cp(p)) + '</small></div><div class="rs">' + stats + '</div></li>')
    if lead:
        return section('related', 'Evolves into', '進化すると', '<ul class="rel">' + items + '</ul>', 'このポケモンは進化してから活躍します' if any_bits else '')
    ttl = {'mega': 'メガシンカ前・ほかのすがた', 'primal': 'ゲンシカイキ前のすがた'}.get(pg['kind'], '進化先・ほかのすがた')
    return section('related', 'Forms', ttl, '<ul class="rel">' + items + '</ul>')

# ---------- 各場面 ----------
def rows_html(rows):
    return '<div class="rows">' + ''.join(rows) + '</div>'

td_top = F.td_top

def sec_raid(pg):
    td = b.td_rows(pg['names'])
    if not td:
        return section('raid', 'Raid', 'レイド', '<p class="none">タイプ別火力（17タイプ・上位40位）に入るタイプはありません。</p>' + ctas(link('/dps/', 'ボスごとの火力を調べる')))
    rows = []
    for r in td:
        sub = 'シャドウ・メガ込みの順位' if (r['sh'] or r['only_all']) else ('シャドウ・メガ込みで%d位' % r['rank_all'] if r['rank_all'] and r['rank_all'] != r['rank'] else '')
        rows.append('<div class="row"><div class="rl">' + ty(r['t'], 22) + '<b>' + JA[r['t']] + '</b>' + ('<em class="shd">' + ico('shadow') + 'シャドウ</em>' if r['sh'] else '') + '</div>'
                    '<div class="rm">' + mv_combo(r['mv']) + ('<small>' + sub + '</small>' if sub else '') + '</div>'
                    '<div class="rr"><b>' + str(r['rank']) + '</b><i>位</i><small>DPS ' + ('%.2f' % r['dps']) + '</small>' + meter(100 * r['dps'] / td_top(r)) + '</div></div>')
    t0 = td[0]
    return section('raid', 'Raid', 'レイド', rows_html(rows) + ctas(link('/type-dps/?t=' + t0['t'].lower() + '&n=40' + ('&sh=1&mg=1' if t0['sh'] or t0['only_all'] else ''), 'タイプごとの順位を全部見る'), link('/dps/', 'ボスごとの火力を調べる')),
                   '弱点を突いたときの火力の順位（PL50・個体値15）')

def sec_gym(pg, p):
    ge = gym_eval(pg['names'])
    body = '<h3>ジム挑戦</h3>'
    if ge:
        body += ('<div class="gcls c' + ge['cls'] + '"><div class="gc"><small>クラス</small><b>' + ge['cls'] + '</b></div>'
                 '<div class="gm"><div class="gr"><b>' + str(ge['rank']) + '</b><i>位</i><small>' + str(GYMEVAL['total']) + '匹中・' + ('%g' % ge['pt']) + 'ポイント</small>' + meter(ge['pt']) + '</div>'
                 '<div class="mvs">' + mv(ge['fast'], 17) + ''.join(mv(x, 17) for x in ge['charged']) + '</div>'
                 + ('<p class="warn">極低耐久のため評価を下げています</p>' if ge.get('low') else '') + '</div></div>'
                 '<p class="cap">ジム防衛ランキング上位30匹への強さ。よく置かれる相手（ハピナス・ラッキーなど）ほど重く数え、何発耐えるかも込み。わざ開放ずみ（SPアタック2つ）の前提</p>')
    else:
        body += '<p class="none">ジム挑戦の評価の対象外です。</p>'
    body += '<h3>ジム防衛</h3>'
    dr = None if cannot_defend(pg) else def_ranks(pg['names'])
    if cannot_defend(pg):
        body += '<p class="none">伝説・幻のポケモンはジムに置けません。</p>'
    elif not dr:
        body += '<p class="none">ジム防衛ランキングの対象外です。</p>'
    else:
        cols = {'総合': '#7ee787', '耐久': '#6ea1ff', 'タイプ': '#c396ff', 'やる気': '#ffcc33', '迎撃': '#ff8a5c'}
        cells = ''.join('<div style="--k:' + cols[k] + '"><small>' + k + '</small><b>' + str(r) + '<i>位</i></b></div>' for k, (r, v) in dr['ranks'].items())
        body += '<div class="five">' + cells + '</div>'
        mvs = [x for x in (dr['fm'], dr['cm'], dr['cm2']) if x]
        body += '<p class="cap">' + str(dr['n']) + '匹中' + ('（二重弱点があるため、既定の一覧には出ません）' if dr['dw'] else '') + '　おすすめのわざ ' + ''.join(mv(x) for x in mvs) + '</p>'
    links = [link('/gym-attack/', '相手ごとのおすすめを見る')]
    if not cannot_defend(pg):
        links.append(link('/gym-defense/', '置くポケモンをくらべる'))
    return section('gym', 'Gym', 'ジム', body + ctas(*links))

def sec_max(pg, p):
    mx = b.max_rows(pg['names'])
    ms = max_state(pg, p)
    if not mx:
        msg = {'none': 'マックスバトルでは未実装です（ダイマックスできません）。',
               'family': 'このすがたはランキングの対象外です。' + ('進化先' if any(k == '進化' for k, _ in pg['related']) else 'ほかのすがた') + 'が活躍します。',
               'in': 'ダイマックスできますが、タイプ別のランキングで10位以内に入っていません。'}[ms]
        return section('max', 'Max Battle', 'マックスバトル', '<p class="none">' + msg + '</p>' + (ctas(link('/max-type/', 'タイプ別のランキングを見る')) if ms != 'none' else ''))
    rows = ['<div class="row"><div class="rl">' + ty(r['t'], 22) + '<b>' + JA[r['t']] + '</b><small>' + ('を受けるタンク' if r['kind'] == 'maxtank' else 'のアタッカー') + '</small></div>'
            '<div class="rm"><small>' + esc(r['form']) + '</small></div><div class="rr"><b>' + str(r['rank']) + '</b><i>位</i><small>' + r['pt'] + ' pt</small>' + meter(float(r['pt'] or 0)) + '</div></div>' for r in mx]
    return section('max', 'Max Battle', 'マックスバトル', rows_html(rows) + ctas(link('/max-type/', 'タイプ別のランキングを見る')), 'タイプ別ランキングで10位以内のもの')

def sec_gbl(pg):
    k = pg['pk']
    g = b.gbl_of(k)
    if k == 'ditto' or not g:
        return section('gbl', 'Battle League', 'GBL', '<p class="none">GOバトルリーグには参加できません。</p>')
    head = ''
    for c in ['1500', '2500', '0']:
        o = g.get(c)
        if not o:
            continue
        ok = bool(o.get('metaRank')) or o['score'] >= 40
        head += ('<div class="lgm lg' + c + ('' if ok else ' off') + '"><span>' + b.LG[c] + '</span><b>' + ('%.1f' % o['score']) + '<i>%</i></b><small>'
                 + ('環境 %d位' % o['metaRank'] if o.get('metaRank') else '100位の外') + '</small></div>')
    cards = ''
    for c in ['1500', '2500', '0']:
        o = g.get(c)
        if not o or not (o.get('metaRank') or o['score'] >= 40):
            continue
        ms = [m for m in o['moves'] if m]
        iv = o['r1']['ivs']
        ivp = ('<span class="pill iv"><b>%d-%d-%d</b><small>PL%g</small></span>' % (iv[0], iv[1], iv[2], o['r1']['level'])) if c != '0' else '<span class="pill iv"><b>15-15-15</b><small>PL50</small></span>'
        win = ''.join('<li>' + pk_name(x) + '</li>' for x in o['win3']) or '<li class="no">なし</li>'
        lose = ''.join('<li>' + pk_name(x) + '</li>' for x in o['lose3']) or '<li class="no">なし</li>'
        cards += ('<div class="lg lg' + c + '"><h3>' + b.LG[c] + 'リーグ</h3><div class="mvs">' + ''.join(mv(x, 17) for x in ms) + ivp + '</div>'
                  '<div class="wl"><div class="w"><h4>勝てる相手<em>' + str(o['nWin3']) + '/' + str(o['n']) + '</em></h4><ul>' + win + '</ul></div>'
                  '<div class="l"><h4>苦手な相手<em>' + str(o['nLose3']) + '/' + str(o['n']) + '</em></h4><ul>' + lose + '</ul></div></div>'
                  + ctas(link('/gbl/?lg=' + c + '&md=multi&l=' + k, 'このポケモンで環境一覧を開く')) + '</div>')
    if not cards:
        cards = '<p class="none">環境上位100位に入るリーグはありません。</p>' + ctas(link('/gbl/?lg=1500&md=multi&l=' + k, 'このポケモンで環境一覧を開く'))
    return section('gbl', 'Battle League', 'GBL', '<div class="lgms">' + head + '</div>' + cards, ('メガシンカしたポケモンは、メガシンカが使えるカップでだけ参加できます。' if pg['kind'] in ('mega', 'primal') else '') + '環境勝率＝環境上位50匹に勝てる割合。50%で互角。勝てる／苦手はシールドの枚数がどれでも結果が同じ相手')

RK_TOP = 30   # ノーマルアタックでのゴリ押し向き＝対策ランキング30位以内＋どのわざでも先に倒されない
def rkt_push(k):
    return [r for r in b.rkt_best(k) if r['rank'] <= RK_TOP and r['win']]

def sec_rocket(pg):
    top = rkt_push(pg['pk'])[:5]
    lead = 'ロケット団戦は、SPアタックを撃たずノーマルアタックだけで押し切るのがいちばん速く倒せます。その速さの順位です'
    if not top:
        return section('rocket', 'Team Rocket', 'ロケット団', '<p class="none">ノーマルアタックでのゴリ押しには不向きです。</p>' + ctas(link('/rocket/', '速く倒せるポケモンをさがす')), lead)
    rows = ['<div class="row"><div class="rl"><b>' + pk_name(r['foe'], 18) + '</b><small>' + esc(r['who']) + '</small>' + ('<em class="shd">' + ico('shadow') + 'シャドウ</em>' if r['sh'] else '') + '</div>'
            '<div class="rm">' + mv(r['fast']) + '<small>どのわざで来ても先に倒されない</small></div>'
            '<div class="rr"><b>' + str(r['rank']) + '</b><i>位</i><small>DPS ' + ('%g' % r['dps']) + '</small></div></div>' for r in top]
    return section('rocket', 'Team Rocket', 'ロケット団', rows_html(rows) + ctas(link('/rocket/', '速く倒せるポケモンをさがす')), lead)

# ---------- 進化・すがた・育成 ----------
# build4.py に差し込む「進化・すがた・育成」の全ポケモン版（make_grow4.py が build4.py の node()〜sec_grow() をこれに置き換える）
# 見本との違い: ①分かれ道のある進化（イーブイ・ケムッソ・キルリアなど）を道すじごとに出す ②進化の条件（どうぐ・相棒・時間帯など）を札で出す
#               ③すがた違い（アローラなど）は自分のすがたの道すじをたどる ④メガのページでは元のポケモンの道すじを出す

COSTUME_FORMS = set()
try:
    for _lst in json.load(open(os.path.join(HERE, 'data', 'costumes.json'), encoding='utf-8')).values():
        COSTUME_FORMS |= {c['form'] for c in _lst if c.get('form')}
except FileNotFoundError:
    pass

GM2PK = {}
for _kinds in (('base',), ('form',)):
    for _pg in b.PAGES:
        if _pg['kind'] in _kinds:
            GM2PK.setdefault(_pg['gm'], _pg['pk'])
            GM2PK.setdefault(_pg['pid'], _pg['pk'])
PK_SET = {_pg['pk'] for _pg in b.PAGES}
PG_OF = {_pg['pk']: _pg for _pg in b.PAGES}

REGION = (('_ALOLA', '_alolan'), ('_GALARIAN', '_galarian'), ('_HISUIAN', '_hisuian'), ('_PALDEA', '_paldean'))
def pk_of(x):
    """ゲームデータのキー・pokemonId・対戦データのキーのどれからでも、ページのキーを返す（無ければ None）"""
    if not x:
        return None
    if x in PK_SET:
        return x
    if x.lower() in PK_SET:
        return x.lower()
    hit = GM2PK.get(x) or GM2PK.get(x.upper())
    if hit:
        return hit
    for a, z in REGION:      # 地方のすがた: ゲームデータは _ALOLA、対戦データは _alolan
        if x.upper().endswith(a) and (x.upper()[:-len(a)].lower() + z) in PK_SET:
            return x.upper()[:-len(a)].lower() + z
    pid = (GM.get(x) or {}).get('pokemonId')      # 見た目だけ違うすがた（シキジカの季節など）は元のポケモンのページへ
    return GM2PK.get(pid) if pid and pid != x else None

def canon(pid, form):
    return form if (form and form in GM and form not in COSTUME_FORMS) else pid

PARENT = {}
for _pass in (0, 1):      # すがた指定なし（元のすがた）を先に見る＝コスチュームや見た目違いに親を取られない
    for _key, _g in GM.items():
        if (('form' in _g) != bool(_pass)) or _key in COSTUME_FORMS:
            continue
        for _br in _g.get('evolutionBranch', []):
            if _br.get('evolution'):
                PARENT.setdefault(canon(_br['evolution'], _br.get('form')), _key)

class _MvJa(dict):
    def get(self, k, d=None):
        return b.ja_move(k)
MVJA = _MvJa()

def evo_children(key):
    g = GM.get(key, {})
    brs = [x for x in g.get('evolutionBranch', []) if x.get('evolution')]
    if not brs and 'form' not in g:      # 見た目だけ違うすがた（シキジカの季節など）にしか進化が書かれていないときは、そこから借りる
        for fk, fg in GM.items():
            if fg.get('pokemonId') == key and 'form' in fg and fk not in COSTUME_FORMS and pk_of(fk) == pk_of(key):
                brs = [x for x in fg.get('evolutionBranch', []) if x.get('evolution')]
                if brs:
                    break
    sibs = sum(x.get('evolutionLikelihoodWeight', 0) for x in brs)
    return [(canon(x['evolution'], x.get('form')), x, gm_ja.evo_conditions(x, MVJA, sibs)) for x in brs]

def evo_paths(root):
    """根から葉までの道すじぜんぶ → [[(キー, 次への枝, 条件の札)], ...]"""
    out = []
    def walk(key, path, seen):
        kids = [k for k in evo_children(key) if k[0] not in seen and pk_of(k[0])]
        if not kids:
            out.append(path + [(key, None, [])])
            return
        for child, br, conds in kids:
            walk(child, path + [(key, br, conds)], seen | {child})
    walk(root, [], {root})
    return out

def node(x, me=False, label=None):
    key = pk_of(x)
    p = PVP['pokemon'].get(key) if key else None
    if not p:
        return '<div class="node"><strong>' + esc(label or str(x)) + '</strong></div>'
    c1, c2 = b.TCOL[JA[p['ty'][0]]], b.TCOL[JA[p['ty'][-1]]]
    two = len(p['ty']) > 1
    dot = '<span class="dot' + (' two' if two else '') + '">' + ''.join(ty(t, 17 if two else 22) for t in p['ty']) + '</span>'
    nm = label or PG_OF.get(key, {}).get('title') or p['n']
    inner = dot + '<strong>' + esc(nm) + '</strong><small>CP ' + str(max_cp(p)) + '</small>'
    tag, attr = ('a', ' href="../' + key + '/"') if not me else ('div', '')
    return '<' + tag + attr + ' class="node' + (' me' if me else '') + '" style="--c:' + c1 + ';--c2:' + c2 + '">' + inner + '</' + tag + '>'

def arrow(br, conds):
    h = '<div class="arrow">'
    if br.get('candyCost'):
        h += pill('candy', br['candyCost'])
    if br.get('candyCostPurified'):
        h += '<small>リトレーン後 ' + str(br['candyCostPurified']) + '</small>'
    h += ''.join('<small class="cd">' + esc(c) + '</small>' for c in conds)
    return h + '<i></i></div>'

def sec_grow(pg):
    mega_page = pg['kind'] in ('mega', 'primal')
    start = pg['pid'] if mega_page else (pg['gm'] if pg['gm'] in GM else pg['pid'])
    g = GM.get(start, {})
    me_pk = pg['pk']
    out = ''
    root, guard = start, 0
    while root in PARENT and guard < 6:
        root, guard = PARENT[root], guard + 1
    paths = evo_paths(root)
    mine = [p for p in paths if any(k == start for k, _, _ in p)] or paths
    on_line = []
    if any(len(p) > 1 for p in mine):
        flows = ''
        for p in mine:
            flow = ''
            for key, br, conds in p:
                flow += node(key, (not mega_page) and pk_of(key) == me_pk)
                if br:
                    flow += arrow(br, conds)
                if key not in on_line:
                    on_line.append(key)
            flows += '<div class="flow">' + flow + '</div>'
        out += '<h3>進化</h3>' + flows
    else:
        on_line = [start]
    megas = []
    for key in on_line:
        pid = GM.get(key, {}).get('pokemonId', key)
        for br in GM.get(key, {}).get('evolutionBranch', []):
            if br.get('temporaryEvolution') and 'form' not in GM.get(key, {}):
                k = pid.lower() + b.TEMP_SUFFIX.get(br['temporaryEvolution'], '')
                if k in PK_SET:
                    megas.append((key, br, k))
    if megas:
        cards = ''
        for key, br, k in megas:
            p = PVP['pokemon'][k]
            cards += ('<div class="fx"><div class="eq">' + node(key, pk_of(key) == me_pk) + '<div class="arrow"><i></i></div>' + node(k, k == me_pk) + '</div>'
                      '<div class="pills">' + pill('energy', br['temporaryEvolutionEnergyCost'], 'はじめて') + pill('energy', br['temporaryEvolutionEnergyCostSubsequent'], '2回目から')
                      + '<span class="pill st"><small>攻</small><b>' + str(p['a']) + '</b><small>防</small><b>' + str(p['df']) + '</b><small>HP</small><b>' + str(p['h']) + '</b></span></div></div>')
        walk = next((GM[key].get('buddyWalkedMegaEnergyAward') for key, _, _ in megas if GM[key].get('buddyWalkedMegaEnergyAward')), None)
        primal = any(k.endswith('_primal') for _, _, k in megas)
        out += '<h3>' + ('ゲンシカイキ' if primal else 'メガシンカ') + '</h3>' + cards
        if walk:
            out += '<p class="cap">' + ico('walk') + '相棒にして歩くとエナジー +' + str(walk) + '（一度' + ('ゲンシカイキ' if primal else 'メガシンカ') + 'させたあと）</p>'
    fcs = [] if mega_page else [fc for fc in g.get('formChange', []) if fc.get('candyCost') or fc.get('item') or fc.get('stardustCost')]
    if fcs:
        cards, fuse_any = '', False
        base_name = b.ja_id(pg['pid'])
        for fc in fcs:
            comp = fc.get('componentPokemonSettings') or {}
            fuse = comp.get('formChangeType') == 'FUSE'
            for form in fc.get('availableForm', []):
                if not pk_of(form) or pk_of(form) == me_pk:
                    continue
                fuse_any = fuse_any or fuse
                eq = node(me_pk, True, base_name if pg['gm'] == pg['pid'] else None)
                if fuse:
                    eq += '<div class="op">＋</div>' + node(comp['pokedexId'])
                eq += '<div class="arrow"><i></i></div>' + node(form)
                pills = ''
                if fc.get('item'):
                    nm = b.ITEM_JA.get(fc['item'])
                    if not nm:
                        gm_ja.UNKNOWN.append(('item', fc['item'], form))
                    pills += pill('energy', fc['itemCostCount'], nm or '')
                if fc.get('candyCost'):
                    pills += pill('candy', fc['candyCost'], base_name)
                if fc.get('stardustCost'):
                    pills += pill('dust', format(fc['stardustCost'], ','))
                if comp.get('componentCandyCost'):
                    pills += pill('candy', comp['componentCandyCost'], b.ja_id(comp['pokedexId']))
                mvr = (fc.get('moveReassignment', {}).get('cinematicMoves') or [{}])[0]
                mvline = ''
                if mvr.get('replacementMoves'):
                    new = ' '.join(mv(b.ja_move(m)) for m in mvr['replacementMoves'])
                    if mvr.get('existingMoves'):
                        mvline = '<p class="cap">' + mv(b.ja_move(mvr['existingMoves'][0])) + '<span class="to">→</span>' + new + '<small>（このわざを覚えていることが条件）</small></p>'
                    else:
                        mvline = '<p class="cap"><small>覚えるわざ</small>' + new + '</p>'
                free = '<span class="pill free"><b>0</b><small>元に戻す</small></span>' if fc.get('item') else ''
                cards += '<div class="fx"><div class="eq' + (' fuse' if fuse else '') + '">' + eq + '</div><div class="pills">' + pills + free + '</div>' + mvline + '</div>'
        if cards:
            out += '<h3>' + ('合体' if fuse_any else 'フォルムチェンジ') + '</h3>' + cards
    pills = ''
    tm, sh = g.get('thirdMove'), (None if mega_page else g.get('shadow'))
    if tm and tm.get('stardustToUnlock') and tm.get('candyToUnlock'):
        pills += '<div class="cost"><small>2つ目のSPアタック</small><div>' + pill('dust', format(tm['stardustToUnlock'], ',')) + pill('candy', tm['candyToUnlock']) + '</div></div>'
    if sh:
        pills += '<div class="cost"><small>リトレーン</small><div>' + pill('dust', format(sh['purificationStardustNeeded'], ',')) + pill('candy', sh['purificationCandyNeeded']) + '</div></div>'
    if g.get('kmBuddyDistance'):
        pills += '<div class="cost"><small>相棒のアメ</small><div>' + pill('walk', '%gkm' % g['kmBuddyDistance'], 'ごとに1個') + '</div></div>'
    if pills:
        out += '<h3>育成のコスト</h3><div class="costs">' + pills + '</div>'
    legend = '<p class="legend">' + ico('candy') + 'アメ' + ico('energy') + 'エナジー' + ico('dust') + 'ほしのすな</p>'
    return section('grow', 'Evolution', '進化・すがた・育成', out + legend) if out else ''

# このポケモンだけの仕様（手書き）は notes.json に持つ。ok:false（タダシさんの確認がまだ）の項目はページに出さない
NOTES = {k: v for k, v in json.load(open(os.path.join(HERE, 'notes.json'), encoding='utf-8')).items() if not k.startswith('_')}

def sec_notes(pg):
    n = NOTES.get(pg['pk'])
    if not n or not n.get('ok'):
        return ''
    out = ''
    for it in n['items']:
        if it.get('chips'):
            out += '<h3>' + esc(it['t']) + '</h3><div class="chips">' + ''.join('<span>' + esc(x) + '</span>' for x in it['chips']) + '</div>'
        else:
            out += '<div class="nt"><h3>' + esc(it['t']) + '</h3><p>' + esc(it['p']) + '</p></div>'
    return section('notes', 'Special', 'このポケモンだけの仕様', out)

def sec_base(pg, p):
    mu = b.matchups(p['ty'])
    weak = sorted([t for t in b.TYPE_ORDER if mu[t] > 1], key=lambda t: (-mu[t], b.TYPE_ORDER.index(t)))
    res = sorted([t for t in b.TYPE_ORDER if mu[t] < 1], key=lambda t: (mu[t], b.TYPE_ORDER.index(t)))
    chip = lambda t: '<span class="mu' + (' x2' if mu[t] > 2 or mu[t] < 0.3 else '') + '">' + ty(t, 18) + JA[t] + '<small>' + b.mult_label(mu[t]) + '</small></span>'
    body = ('<h3>弱点</h3><div class="mus">' + (''.join(chip(t) for t in weak) or '<span class="no">なし</span>') + '</div>'
            '<h3>耐性</h3><div class="mus">' + (''.join(chip(t) for t in res) or '<span class="no">なし</span>') + '</div>' + ctas(link('/pokedex/?p=' + pg['pk'], '全ポケモンとくらべる')))
    return section('base', 'Type Chart', 'タイプ相性', body)

def sec_moves(pg, p):
    out = ''
    g = GO['pokemon'].get(pg['gk']) if pg['gk'] else None
    def table(title, fast_rows, chg_rows, c3):
        return ('<h3>' + title + '</h3><div class="tw"><table class="t"><thead><tr><th>ノーマルアタック</th><th>威力</th><th>' + c3 + '</th><th>ゲージ</th></tr></thead><tbody>' + fast_rows
                + '</tbody><thead><tr><th>SPアタック</th><th>威力</th><th>' + ('時間' if c3 == '時間' else '') + '</th><th>ゲージ</th></tr></thead><tbody>' + chg_rows + '</tbody></table></div>')
    if g:
        def row(i, sp):
            m = GO['moves'].get(i)
            if not m:
                return ''
            return '<tr><td>' + mv(m['n'] + ('*' if sp else ''), 17) + '</td><td class="num">%g</td><td class="num">%g秒</td><td class="num">%+d</td></tr>' % (m['p'], m['d'], m['e'])
        f = ''.join(row(i, False) for i in g['q']) + ''.join(row(i, True) for i in g.get('eq', []) if i not in g['q'])
        c = ''.join(row(i, False) for i in g['c']) + ''.join(row(i, True) for i in g.get('ec', []) if i not in g['c'])
        out += table('ジム・レイド', f, c, '時間')
    if pg['pk'] != 'ditto':
        sp = set(p.get('eq', [])) | set(p.get('ec', []))
        def prow(i, fast):
            m = PVP['moves'].get(i)
            if not m:
                return ''
            nm = mv(m['n'] + ('*' if i in sp else ''), 17)
            if fast:
                return '<tr><td>' + nm + '</td><td class="num">%g</td><td class="num">%sターン</td><td class="num">+%s</td></tr>' % (m['p'], m.get('tn', '—'), m.get('eg', 0))
            return '<tr><td>' + nm + '</td><td class="num">%g</td><td></td><td class="num">-%s</td></tr>' % (m['p'], m.get('e', 0))
        qs = list(dict.fromkeys(p['q'] + p.get('eq', [])))
        cs = list(dict.fromkeys(p['c'] + p.get('ec', [])))
        out += table('トレーナーバトル', ''.join(prow(i, True) for i in qs), ''.join(prow(i, False) for i in cs), 'ターン')
        out += '<p class="legend"><i class="spc">オレンジ＋*</i>＝特別なわざ（イベントやすごいわざマシンで覚える）</p>'
    else:
        out += '<p class="none">おぼえるわざは「へんしん」だけです。</p>'
    return section('moves', 'Moves', 'おぼえるわざ', out)


def facts_text(pg, p, T):
    """上の数字を文章でまとめる（事実だけ・良し悪しの言葉は使わない）"""
    name = pg.get('title') or p['n']
    tys = '・'.join(JA[t] for t in p['ty'])
    out = [name + 'は' + tys + 'タイプのポケモンで、種族値は攻撃%d・防御%d・HP%d、最大CPは%d（PL50・個体値15）です。' % (p['a'], p['df'], p['h'], max_cp(p))]
    on = [(lab, val, unit, cap) for _, lab, val, unit, cap, ok in T if ok]
    off = [lab for _, lab, val, unit, cap, ok in T if not ok]
    if on:
        out.append('いま上位に入っているのは、' + '、'.join((lab + 'の「' + cap + '」' + val + unit) if val is not None else cap for lab, val, unit, cap in on) + 'です。')
    if off:
        out.append('・'.join(off) + 'では、いまのところランキングの上位に入っていません。')
    rel = [PVP['pokemon'][k]['n'] for _, k in pg['related']]
    if rel:
        out.append('関連するすがたは' + '、'.join(rel) + 'で、それぞれの活躍は下にまとめています。')
    return ''.join(out)

def sec_faq(pg, p):
    name = pg.get('title') or p['n']
    g = GM.get(pg['gm'], {})
    mu = b.matchups(p['ty'])
    qa = []
    weak = sorted([t for t in b.TYPE_ORDER if mu[t] > 1], key=lambda t: -mu[t])
    if weak:
        w2 = [JA[t] for t in weak if mu[t] > 2]
        qa.append((name + 'の弱点は？', '、'.join(JA[t] for t in weak) + 'タイプのわざが弱点です。' + ('とくに' + '・'.join(w2) + 'は二重弱点（2.56倍）です。' if w2 else '')))
    evo = [] if pg['kind'] in ('mega', 'primal') else [(c, br, cd) for c, br, cd in evo_children(pg['gm'] if pg['gm'] in GM else pg['pid']) if pk_of(c)]
    if evo:
        parts = []
        for c, e, cd in evo:
            t = PVP['pokemon'][pk_of(c)]['n'] + 'への進化に' + ('アメ%d個' % e['candyCost'] if e.get('candyCost') else 'アメ0個')
            if cd:
                t += '（条件: ' + '・'.join(cd) + '）'
            t += 'が必要です。' + ('リトレーンした個体は%d個で進化できます。' % e['candyCostPurified'] if e.get('candyCostPurified') else '')
            parts.append(t)
        qa.append((name + 'の進化に必要なアメは？', ''.join(parts)))
    for br in g.get('evolutionBranch', []):
        if br.get('temporaryEvolution'):
            k = pg['gm'].lower() + b.TEMP_SUFFIX.get(br['temporaryEvolution'], '')
            if k in PVP['pokemon']:
                word = 'ゲンシカイキ' if k.endswith('_primal') else 'メガシンカ'
                qa.append((PVP['pokemon'][k]['n'] + 'への' + word + 'に必要なエナジーは？', 'はじめては%d、2回目からは%dです。メガレベルが上がると、さらに少なくなります。' % (br['temporaryEvolutionEnergyCost'], br['temporaryEvolutionEnergyCostSubsequent'])))
    for fc in g.get('formChange', []):
        if fc.get('item'):
            comp = fc.get('componentPokemonSettings') or {}
            cost = b.ITEM_JA.get(fc['item'], 'エナジー') + '%d' % fc['itemCostCount'] + '、' + b.ja_id(pg['gm']) + 'のアメ%d' % fc.get('candyCost', 0)
            if comp.get('componentCandyCost'):
                cost += '、' + b.ja_id(comp['pokedexId']) + 'のアメ%d' % comp['componentCandyCost']
            qa.append((b.ja_form(fc['availableForm'][0]) + 'にするには？', cost + 'が必要です。元のすがたに戻すのにコストはかかりません。'))
    gb = b.gbl_of(pg['pk'])
    best = [(c, o) for c, o in gb.items() if o.get('metaRank') or o['score'] >= 40]
    if best and pg['pk'] != 'ditto':
        c, o = max(best, key=lambda kv: kv[1]['score'])
        ms = [m for m in o['moves'] if m]
        qa.append((name + 'のGBLでのわざ構成は？', b.LG[c] + 'リーグでは、ノーマルアタック「' + ms[0] + '」、SPアタック「' + '」「'.join(ms[1:]) + '」の構成で環境勝率%.1f%%です。' % o['score']))
    tm = g.get('thirdMove')
    if tm and tm.get('stardustToUnlock') and tm.get('candyToUnlock'):
        qa.append(('2つ目のSPアタックの解放コストは？', 'ほしのすな%s とアメ%d個です。' % (format(tm['stardustToUnlock'], ','), tm['candyToUnlock'])))
    if cannot_defend(pg):
        qa.append((name + 'はジムに置ける？', '伝説・幻のポケモンなので、ジムには置けません。'))
    if pg['pk'] == 'ditto':
        qa += [('メタモンはどこで手に入る？', '野生でほかのポケモンに化けて出てきます。へんしん前のすがた（上の一覧）のポケモンをつかまえると、まれにメタモンに変わります。'),
               ('メタモンはGOバトルリーグで使える？', '使えません。GOバトルリーグには参加できないポケモンです。'),
               ('メタモンに色違いはいる？', '実装されています。色違いのポケモンに化けて出ることはなく、ふつうの色のポケモンをつかまえたあとに、まれに色違いのメタモンに変わります。')]
    if not qa:
        return ''
    return section('faq', 'Q &amp; A', 'よくある質問', '<dl class="faq">' + ''.join('<dt>' + esc(q) + '</dt><dd>' + esc(a) + '</dd>' for q, a in qa) + '</dl>')


SPY_JS = """(function(){var ls=[].slice.call(document.querySelectorAll('.snav a'));if(!('IntersectionObserver' in window)||!ls.length)return;
var map={};ls.forEach(function(a){map[a.getAttribute('href').slice(1)]=a;});
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){ls.forEach(function(a){a.classList.remove('on');});var a=map[e.target.id];if(a){a.classList.add('on');
var n=a.parentNode;n.scrollTo({left:a.offsetLeft-n.clientWidth/2+a.clientWidth/2,behavior:'smooth'});}}});},{rootMargin:'-45% 0px -50% 0px'});
Object.keys(map).forEach(function(id){var el=document.getElementById(id);if(el)io.observe(el);});})();"""

def body_line(pg):
    g = GM.get(pg['gm'], {})
    if pg['kind'] in ('mega', 'primal') or not g.get('pokedexHeightM'):
        return ''
    return '<p class="bodyline"><span>高さ <b>%gm</b></span><span>重さ <b>%gkg</b></span></p>' % (g['pokedexHeightM'], g['pokedexWeightKg'])

_ORDER = sorted(b.PAGES, key=lambda x: PVP['pokemon'][x['pk']]['dex'])
_ORDER_I = {x['pk']: i for i, x in enumerate(_ORDER)}
def pager(pg):
    order, i = _ORDER, _ORDER_I[pg['pk']]
    def one(x, cls, lab):
        if not x:
            return '<span></span>'
        p = PVP['pokemon'][x['pk']]
        return ('<a class="' + cls + '" href="../' + x['pk'] + '/"><small>' + lab + ' No.%04d' % p['dex'] + '</small><b>' + ''.join(ty(t, 16) for t in p['ty']) + esc(x.get('title') or p['n']) + '</b></a>')
    return '<nav class="pager">' + one(order[i - 1] if i > 0 else None, 'pv', '前') + one(order[i + 1] if i + 1 < len(order) else None, 'nx', '次') + '</nav>'


CHANGED = {}
_DATE = re.compile(r'\d{4}年\d{1,2}月\d{1,2}日')

def write_if_changed(fn, body):
    """中身が変わったときだけ書く。日付（「◯年◯月◯日時点」）だけの違いは変化とみなさない。戻り値＝書いたか"""
    try:
        old = open(fn, encoding='utf-8').read()
    except OSError:
        old = None
    if old is not None and _DATE.sub('', old) == _DATE.sub('', body):
        return False
    open(fn, 'w', encoding='utf-8').write(body)
    return True

def head_tags(pg, name, desc):
    """検索エンジン・SNS向けのタグ（build_seo.py の head_block と同じ並び）。確認用は全部 noindex"""
    e = lambda x: html.escape(x, quote=True)
    url = SITE + '/pokedex/' + pg['pk'] + '/'
    title = name + 'の強さと使い道｜ポケモンGO｜GOナビ'
    t = TIERS.get(pg['pk'], {})
    L = ['<title>' + e(title) + '</title>', '<meta name="description" content="' + e(desc) + '">']
    if not PUBLISH or t.get('noindex'):
        L.append('<meta name="robots" content="noindex">')
    L += ['<link rel="canonical" href="' + url + '">',
          '<meta property="og:type" content="article">', '<meta property="og:site_name" content="GOナビ">',
          '<meta property="og:locale" content="ja_JP">', '<meta property="og:title" content="' + e(title) + '">',
          '<meta property="og:description" content="' + e(desc) + '">', '<meta property="og:url" content="' + url + '">',
          '<meta property="og:image" content="' + SITE + '/assets/ogp/pokedex.png">',
          '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
          '<meta name="twitter:card" content="summary_large_image">',
          '<script type="application/ld+json">' + json.dumps({'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
              {'@type': 'ListItem', 'position': 1, 'name': 'GOナビ', 'item': SITE + '/'},
              {'@type': 'ListItem', 'position': 2, 'name': 'ステータス図鑑', 'item': SITE + '/pokedex/'},
              {'@type': 'ListItem', 'position': 3, 'name': name, 'item': url}]}, ensure_ascii=False, separators=(',', ':')) + '</script>']
    return ''.join(L)

NAV = [('strength', '強さ'), ('raid', 'レイド'), ('gym', 'ジム'), ('max', 'マックス'), ('gbl', 'GBL'), ('rocket', 'ロケット団'), ('grow', '育成'), ('base', '相性'), ('moves', 'わざ')]

def build(pg, faq=False):
    p = PVP['pokemon'][pg['pk']]
    name = pg.get('title') or p['n']
    m = re.match(r'^(.*?)（(.*)）$', name)
    main, sub = (m.group(1), m.group(2)) if m else (name, '')
    c1, c2 = b.TCOL[JA[p['ty'][0]]], b.TCOL[JA[p['ty'][-1]]]
    tl, T = tiles(pg, p)
    tags = []
    cls = GM.get(pg['gm'], {}).get('pokemonClass')
    if cls:
        tags.append({'POKEMON_CLASS_LEGENDARY': '伝説', 'POKEMON_CLASS_MYTHIC': '幻', 'POKEMON_CLASS_ULTRA_BEAST': 'ウルトラビースト'}.get(cls, ''))
    if pg['kind'] in ('mega', 'primal'):
        tags.append('メガシンカ' if pg['kind'] == 'mega' else 'ゲンシカイキ')
    elif GM.get(pg['gm'], {}).get('shadow'):
        tags.append('シャドウ')
    for kind in dict.fromkeys(k for k, _ in pg['related']):
        if kind not in ('進化', 'ほかのすがた', 'メガシンカ前', 'ゲンシカイキ前') and kind not in tags:
            tags.append(kind)
    tys = ''.join('<span class="tchip" style="--c:' + b.TCOL[JA[t]] + '">' + ty(t, 24) + JA[t] + '</span>' for t in p['ty'])
    spec = ''.join('<div><small>' + l + '</small><b>' + str(v) + '</b><i><u style="width:' + str(min(100, round(v / 4.2))) + '%"></u></i></div>' for l, v in (('攻撃', p['a']), ('防御', p['df']), ('HP', p['h'])))
    good = [(lab + ' ' + val + unit + '（' + cap + '）') if val is not None else cap for _, lab, val, unit, cap, ok in T if ok]
    desc = name + 'の強さをレイド・ジム・マックスバトル・GBL・ロケット団ごとに。' + ('、'.join(good[:2]) + '。' if good else '') + '進化の条件・種族値・わざも。' + b.DATE_JA + '時点。'
    pre_evo = any(k == '進化' for k, _ in pg['related'])
    secs = [('' if pre_evo else related(pg)), sec_raid(pg), sec_gym(pg, p), sec_max(pg, p), sec_gbl(pg), sec_rocket(pg), sec_grow(pg), sec_notes(pg), sec_base(pg, p), sec_moves(pg, p), (sec_faq(pg, p) if faq else '')]
    nav = ''.join('<a href="#' + a + '">' + l + '</a>' for a, l in NAV)
    body = ('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            + head_tags(pg, name, desc) +
            "<script>try{if(localStorage.getItem('site_theme')==='light')document.documentElement.className='light';}catch(e){}</script>"
            '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Zen+Kaku+Gothic+New:wght@900&display=swap" rel="stylesheet">'
            '<link rel="stylesheet" href="/assets/theme.css"><link rel="stylesheet" href="/assets/home.css"><link rel="stylesheet" href="/assets/ads.css"><script src="/assets/ads.js"></script>'
            + ('<link rel="stylesheet" href="/assets/pokepage.css">' if PUBLISH else '<style>' + CSS + '</style>') + '</head>'
            '<body style="--c1:' + c1 + ';--c2:' + c2 + '"><div class="glow"></div><div class="wrap">'
            '<div class="topbar"><a class="back" href="' + ('/pokedex/?p=' + urllib.parse.quote(name) if PUBLISH else '../../out.html') + '">GOナビ ／ ポケモン</a><div id="themesw"></div></div>'
            '<header class="hero"><div class="wm">' + ''.join('<span data-ty="' + JA[t] + '" data-sz="230"></span>' for t in p['ty']) + '</div><div class="no">No.' + ('%04d' % p['dex']) + ''.join('<span>' + t + '</span>' for t in tags if t) + '</div>'
            '<h1>' + esc(main) + ('<small>' + esc(sub) + '</small>' if sub else '') + '</h1><div class="tys">' + tys + '</div>' + body_line(pg) +
            '<div class="spec">' + spec + '<div class="cp"><small>最大CP</small><b>' + str(max_cp(p)) + '</b></div></div></header>'
            '<div class="adslot" data-ad="top" data-snap-skip></div>'
            '<nav class="snav">' + nav + '</nav>'
            + (related(pg, True) if pre_evo else '') +
            '<section id="strength" class="first"><header class="sh"><span class="eb">Where it shines</span><h2>どこで強いか</h2></header><div class="tiles">' + tl + '</div><p class="sum">' + esc(facts_text(pg, p, T)) + '</p></section><div class="adslot" data-ad="mid" data-snap-skip></div>'
            + ''.join(secs) + pager(pg) +
            '<p class="foot">' + b.DATE_JA + '時点。数字はすべて GOナビ の各ツールと同じ計算です。</p></div>'
            '<script src="/assets/type-icons.js"></script>'
            "<script>document.querySelectorAll('[data-ty]').forEach(function(e){e.innerHTML=typeIconHTML(e.dataset.ty,+e.dataset.sz||18);});</script>"
            '<script src="/assets/theme.js"></script><script src="/assets/home.js"></script><script>' + SPY_JS + '</script><script src="/assets/snap.js"></script></body></html>')
    d = os.path.join(ROOT, 'pokedex', pg['pk']) if PUBLISH else os.path.join(HERE, OUT, pg['pk'])
    os.makedirs(d, exist_ok=True)
    og_tiles = ''.join('<div class="ot' + ('' if ok else ' off') + '"><small>' + lab + '</small><b>' + (val if val is not None else (gym_eval(pg['names']) or {}).get('cls', '—')) + '<i>' + (unit if val is not None else 'クラス') + '</i></b></div>' for _, lab, val, unit, cap, ok in T)
    og = ('<!doctype html><html lang="ja"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Zen+Kaku+Gothic+New:wght@900&display=swap" rel="stylesheet"><style>'
          'body{margin:0;width:1200px;height:630px;overflow:hidden;background:#0a0e1f;color:#f2f4ff;font-family:system-ui,"Hiragino Kaku Gothic ProN",sans-serif;position:relative}'
          '.g{position:absolute;inset:0;background:radial-gradient(760px 460px at 12% 0,' + c1 + '88,transparent 70%),radial-gradient(700px 420px at 100% 10%,' + c2 + '55,transparent 70%)}'
          '.in{position:absolute;inset:0;padding:56px 64px}.no{font:600 22px Oswald;letter-spacing:.2em;color:#aab3d8}'
          'h1{margin:10px 0 18px;font:900 ' + ('118' if len(main) <= 6 else '92') + 'px/1.05 "Zen Kaku Gothic New",sans-serif}h1 small{display:block;font-size:34px;color:#c5cbe6;margin-top:8px}'
          '.tys{display:flex;gap:12px}.tchip{display:inline-flex;align-items:center;gap:8px;padding:8px 22px 8px 10px;border-radius:999px;font-weight:800;font-size:28px;color:#fff}'
          '.row{position:absolute;left:64px;right:64px;bottom:54px;display:grid;grid-template-columns:repeat(5,1fr);gap:12px}'
          '.ot{padding:16px 16px 12px;border-radius:18px;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1.5px ' + c1 + '99}.ot.off{background:transparent;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.14)}'
          '.ot small{display:block;font-size:19px;font-weight:800;color:#aab3d8}.ot b{font:600 50px/1.2 Oswald}.ot b i{font:800 18px system-ui;font-style:normal;color:#aab3d8;margin-left:3px}.ot.off b{color:#5d688f}'
          '.logo{position:absolute;right:64px;top:54px;display:flex;align-items:center;gap:12px;font:600 22px Oswald;letter-spacing:.12em;color:#c5cbe6}.logo img{width:64px;height:64px;border-radius:16px}'
          '</style></head><body><div class="g"></div><div class="in"><div class="logo"><span>gonavi.jp</span><img src="/assets/icons/home/icon-192.png"></div>'
          '<div class="no">POKÉMON GO ／ No.' + ('%04d' % p['dex']) + '</div><h1>' + esc(main) + ('<small>' + esc(sub) + '</small>' if sub else '') + '</h1>'
          '<div class="tys">' + ''.join('<span class="tchip" style="background:' + b.TCOL[JA[t]] + 'cc"><span data-ty="' + JA[t] + '" data-sz="36"></span>' + JA[t] + '</span>' for t in p['ty']) + '</div>'
          '<div class="row">' + og_tiles + '</div></div><script src="/assets/type-icons.js"></script>'
          "<script>document.querySelectorAll('[data-ty]').forEach(function(e){e.innerHTML=typeIconHTML(e.dataset.ty,+e.dataset.sz||18);});</script></body></html>")
    text = re.sub(r'<(script|style|svg)[\s\S]*?</\1>', '', body)
    n = len(re.sub(r'\s+', '', re.sub(r'<[^>]+>', '', text)))
    if n < TARGET and not faq:   # よくある質問は、本文が目標に届かないページにだけ足す（タダシさん判断）
        return build(pg, True)
    if not PUBLISH:
        open(os.path.join(d, 'ogp.html'), 'w', encoding='utf-8').write(og)
    CHANGED[pg['pk']] = write_if_changed(os.path.join(d, 'index.html'), body)
    return pg['pk'], name, n


def write_sitemap():
    """段階 STAGE までの、検索エンジンに載せるページだけのサイトマップ（sitemap-pokemon.xml）。
    lastmod は中身が変わった日（日付だけの違いは変化にしない）。変わっていなければ前回の値を引き継ぐ"""
    fn = os.path.join(ROOT, 'sitemap-pokemon.xml')
    prev = {}
    if os.path.exists(fn):
        prev = dict(re.findall(r'<loc>[^<]*/pokedex/([^/<]+)/</loc><lastmod>([^<]+)</lastmod>', open(fn, encoding='utf-8').read()))
    today = _d.isoformat()
    rows = []
    for pg in sorted(b.PAGES, key=lambda x: (PVP['pokemon'][x['pk']]['dex'], x['pk'])):
        t = TIERS.get(pg['pk'], {})
        if t.get('noindex') or t.get('tier', 9) > STAGE:
            continue
        lm = today if (CHANGED.get(pg['pk']) or pg['pk'] not in prev) else prev[pg['pk']]
        rows.append('  <url><loc>' + SITE + '/pokedex/' + pg['pk'] + '/</loc><lastmod>' + lm + '</lastmod><priority>0.6</priority></url>')
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + '\n'.join(rows) + '\n</urlset>\n')
    write_if_changed(fn, xml)
    return len(rows)

if __name__ == '__main__':
    import traceback, collections
    want = {a for a in sys.argv[1:] if not a.startswith('--')}
    rows, errs = [], []
    for pg in b.PAGES:
        if want and pg['pk'] not in want:
            continue
        try:
            rows.append(build(pg))
        except Exception as e:
            errs.append((pg['pk'], repr(e), traceback.format_exc().strip().splitlines()[-3:]))
    idx = ''.join('<li><a href="' + OUT + '/' + pk + '/">' + esc(n) + '</a><small>段階' + str(TIERS.get(pk, {}).get('tier', '?')) + ('・載せない候補' if TIERS.get(pk, {}).get('noindex') else '') + '　本文 約' + str(c) + '字</small></li>' for pk, n, c in rows)
    if not want and not PUBLISH:
        open(os.path.join(HERE, OUT + '.html'), 'w', encoding='utf-8').write(
            '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>全ポケモン（確認用）</title><style>' + CSS + '</style></head>'
            '<body style="--c1:#8b5cf6;--c2:#22c7e0"><div class="glow"></div><div class="wrap"><header class="hero"><div class="no">All Pokemon</div><h1>1ポケモン1ページ</h1></header><ul class="idx">' + idx + '</ul></div></body></html>')
    cs = [c for _, _, c in rows]
    print('作ったページ', len(rows), '／失敗', len(errs), '／本文の字数 最小%d・中央%d・最大%d' % (min(cs), sorted(cs)[len(cs) // 2], max(cs)) if cs else '')
    print('目標%d字に未達' % TARGET, sum(1 for c in cs if c < TARGET))
    print('日本語の札が無い項目', len(gm_ja.UNKNOWN), sorted(set(map(str, gm_ja.UNKNOWN)))[:12])
    for e in errs[:15]:
        print('✕', e)
    json.dump(dict(rows=rows, errs=errs), open(os.path.join(HERE, 'data', 'build_report.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    if PUBLISH:
        if errs:   # 1ページでも作れなかったら、中途半端な状態で公開しない
            sys.exit('✕ 作れなかったページがあるので止めます')
        write_if_changed(os.path.join(ROOT, 'assets', 'pokepage.css'), CSS)
        if not want:   # ステータス図鑑の入口用（名前→ページのキー）。図鑑はこれがあるときだけリンクを出す
            pm = {}
            for pg in b.PAGES:
                for n in [pg.get('title')] + pg['names'] + [PVP['pokemon'][pg['pk']]['n']]:
                    if n:
                        pm.setdefault(norm(n), pg['pk'])
            for pg in sorted(b.PAGES, key=lambda x: x['kind'] != 'base'):   # フォルム名なしで引いたとき（ミノマダム・メテノ等）は最初のすがたへ
                for n in pg['names']:
                    pm.setdefault(re.sub(r'（.*?）', '', norm(n)), pg['pk'])
            write_if_changed(os.path.join(ROOT, 'pokedex', 'pages.json'), json.dumps(pm, ensure_ascii=False, separators=(',', ':'), sort_keys=True))
        if not want:
            print('サイトマップに載せたページ（段階%dまで）' % STAGE, write_sitemap())
            gone = sorted(set(x for x in os.listdir(os.path.join(ROOT, 'pokedex')) if os.path.isfile(os.path.join(ROOT, 'pokedex', x, 'index.html'))) - {pg['pk'] for pg in b.PAGES})
            if gone:   # 消すのはタダシさんの確認のあと（ここでは知らせるだけ）
                print('⚠ 一覧から外れたページ（消していません）', gone)
        print('書き換えたページ', sum(CHANGED.values()))
