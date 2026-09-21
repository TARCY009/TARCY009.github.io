#!/usr/bin/env python3
# 全ページの機械点検: ①ページ同士のリンク切れ ②「None」「undefined」「nan」などの混入 ③英語のID（大文字_の並び）が本文に残っていないか
# ④タイトル・説明文の重複 ⑤表記の決まり（「子」呼び・「殴る」・他サイト名）
# ⑥「どこで強いか」のタイルの数字が、各ツールの出口から集めた数字（data/*.json）と同じか（ページを組む途中の取り違えを見張る）
# 使い方: python3 check.py            … 確認用（pokepage/out/）を点検
#         python3 check.py --publish  … 本番の置き場所（/pokedex/<キー>/）を点検
# 問題が1つでもあれば終了コード1（毎朝の自動更新はそこで止まり、ページは公開されない）
import os, re, sys, json, base64, html as H, collections
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
PUBLISH = '--publish' in sys.argv
OUT = os.path.join(ROOT, 'pokedex') if PUBLISH else os.path.join(HERE, 'out')
L = lambda f: json.load(open(os.path.join(HERE, 'data', f), encoding='utf-8'))
ROSTER = {pg['pk']: pg for pg in L('roster.json')}
pks = sorted(d for d in os.listdir(OUT) if d in ROSTER and os.path.isfile(os.path.join(OUT, d, 'index.html')))
S = set(pks)
bad = collections.defaultdict(list)
titles, descs = collections.Counter(), collections.Counter()
# 他サイトの名前はファイルに書かない決まりなので、探す名前は符号化して持つ
NG = ['この子', 'その子', '殴'] + base64.b64decode('UHZQb2tlfOOBv+OCk+ODneOCsXzjg53jgrHjgonjgY98R2FtZSBNYXN0ZXJ8UG9rZU1pbmVycw==').decode().split('|')
for pk in pks:
    h = open(os.path.join(OUT, pk, 'index.html'), encoding='utf-8').read()
    for m in re.finditer(r'href="\.\./([^/"]+)/"', h):
        if m.group(1) not in S:
            bad['リンク切れ'].append((pk, m.group(1)))
    text = re.sub(r'<(script|style|svg)[\s\S]*?</\1>', '', h)
    text = re.sub(r'<[^>]+>', ' ', text)
    for w in ('None', 'undefined', 'NaN', 'nan ', 'null'):
        if re.search(r'(?<![A-Za-z])' + re.escape(w) + r'(?![A-Za-z])', text):
            bad['混入 ' + w].append(pk)
    for m in re.finditer(r'\b[A-Z]{3,}(?:_[A-Z0-9]+)+\b', text):
        bad['英語のID'].append((pk, m.group(0)))
    for w in NG:
        if w in text:
            bad['表記 ' + w].append(pk)
    t = re.search(r'<title>(.*?)</title>', h).group(1)
    d = re.search(r'name="description" content="(.*?)"', h).group(1)
    titles[t] += 1
    descs[d] += 1
    if len(h) > 400000:
        bad['大きすぎる'].append((pk, len(h)))

# ---- ⑥ タイルの数字の突き合わせ ----
GO = json.load(open(os.path.join(ROOT, 'godata.json'), encoding='utf-8'))
nm = lambda x: x.replace('(', '（').replace(')', '）')
JA2EN = {v: k for k, v in GO['typeJa'].items()}
PVPN = {k: v['n'] for k, v in json.load(open(os.path.join(ROOT, 'pvp_data.json'), encoding='utf-8'))['pokemon'].items()}
GOK = {}
for k, g in GO['pokemon'].items():
    GOK.setdefault(nm(g['n']), set()).add(k)
TD, MX, RK, GDEF = L('typedps.json')['types'], L('maxtype.json'), L('rocket.json'), L('gymdef.json')
GBL = {c: L('gbl_%s.json' % c)['data'] for c in ('1500', '2500', '0')}
LGN = {'スーパー': '1500', 'ハイパー': '2500', 'マスター': '0'}
DEFR = {nm(r['n']): (r['rankAll'] if r['dw'] else r['rank']) for r in GDEF['total']}   # 二重弱点は「二重弱点も」を押したときの順位
TILE = re.compile(r'<a class="tile[^"]*" href="#(\w+)">(.*?)</a>')
checked = collections.Counter()
for pk in pks:
    h = open(os.path.join(OUT, pk, 'index.html'), encoding='utf-8').read()
    pg = ROSTER[pk]
    names = {nm(n) for n in pg['names']}
    gks = set().union(*[GOK.get(n, set()) for n in names]) | ({pg['gk']} if pg.get('gk') else set())
    for sec, inner in TILE.findall(h):
        v = re.search(r'<span class="tv">([\d.]+)<i>', inner)
        cap = H.unescape((re.search(r'<span class="tc">(.*?)</span>', inner) or [None, ''])[1])
        ng = None
        if sec == 'raid' and v:
            m = re.match(r'(.+?)タイプの火力(・シャドウ)?$', cap)
            t, sh, n = JA2EN.get(m.group(1)) if m else None, bool(m and m.group(2)), int(v.group(1))
            if not any(r['rank'] == n and r['k'] in gks and bool(r['sh']) == sh for w in ('base', 'all') for r in TD.get(t, {}).get(w, [])):
                ng = cap + ' ' + v.group(1) + '位'
        elif sec == 'max' and v:
            m = re.match(r'(.+?)(のアタッカー|を受けるタンク)$', cap)
            t = JA2EN.get(m.group(1), '').lower() if m else ''
            lst = MX.get(t, {}).get('atk' if m and m.group(2) == 'のアタッカー' else 'tank', [])
            if not any(r['rank'] == int(v.group(1)) and nm(r['n']) in names for r in lst):
                ng = cap + ' ' + v.group(1) + '位'
        elif sec == 'gbl' and v:
            m = re.match(r'(.+?)リーグの環境勝率$', cap)
            e = (GBL.get(LGN.get(m.group(1) if m else ''), {}).get(pk) or {}).get('n') or {}
            if e.get('score') is None or '%.1f' % float(e['score']) != v.group(1):
                ng = cap + ' ' + v.group(1) + '%（データ ' + str(e.get('score')) + '）'
        elif sec == 'rocket' and v:
            m = re.match(r'(.+?)を速く倒せる(・シャドウ)?$', cap)
            foe, sh = (m.group(1), bool(m.group(2))) if m else ('', False)
            if not any(r['rank'] == int(v.group(1)) and r['k'] == pk and bool(r.get('s')) == sh
                       for f in RK['foes'] if nm(PVPN.get(f['k'], '')) == nm(foe) for r in f['rows']):
                ng = cap + ' ' + v.group(1) + '位'
        elif sec == 'gym':
            d = re.search(r'<small>防衛</small><b>(\d+)</b>', inner)
            if d:
                want = next((DEFR[n] for n in names if n in DEFR), None)
                if want != int(d.group(1)):
                    ng = '防衛 総合' + d.group(1) + '位（ジム防衛の画面では ' + str(want) + '位）'
        if v or sec == 'gym':
            checked[sec] += 1
        if ng:
            bad['数字のずれ ' + sec].append((pk, ng))
print('数字を突き合わせたタイル', dict(checked))
print('点検したページ', len(pks))
print('同じタイトル', [t for t, n in titles.items() if n > 1][:10])
print('同じ説明文', len([d for d, n in descs.items() if n > 1]))
for k, v in bad.items():
    print('✕', k, len(v), v[:12])
if not bad:
    print('問題なし')
if bad:
    sys.exit(1)
