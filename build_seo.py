# -*- coding: utf-8 -*-
"""
検索エンジン・SNS向けの準備をまとめて作るスクリプト（2026-09-12新設）
=====================================================================
  python3 build_seo.py            … 下の4つを全部作る
  python3 build_seo.py --no-images … 共有用画像だけ作り直さない

作るもの:
  1) 各ページの <head> の「説明文・正式アドレス・共有用タグ」
     （<!-- seo:start --> 〜 <!-- seo:end --> の間を丸ごと書き換える。手で編集しない）
     あわせて <title> もこの表の値にそろえる
  2) 共有用画像 assets/ogp/<キー>.png（1200×630。SNSにURLを貼ったときに出る絵）
  3) sitemap.xml（検索エンジンにページの一覧を渡す）
  4) robots.txt（検索エンジンに見てほしくない場所を伝える）

⚠ レイド火力チェッカー(/dps/)は build_data.py が template.html から毎朝作り直すので、
  template.html にも同じ書き換えを入れる（片方だけだと翌朝消える）。
⚠ ツール名・説明を変えたら、この表を直して流し直す。
⚠ ページ内の絶対アドレスは https://gonavi.jp/ で書く（2026-09-12に独自ドメインへ移行）。
"""
import html, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = 'https://gonavi.jp'
BRAND = 'GOナビ'

# path, 画像のキー, <title>, 説明文(検索結果に出る), 共有時の見出し, 共有時の説明,
# 画像の英字の小見出し, 画像のツール名, 画像の短い説明, ツールの色, JSON-LD を付けるか
PAGES = [
  dict(path='/', key='home',
       title='GOナビ｜ポケモンGO 攻略ツール（レイド火力・GBL・個体値）',
       desc='GOナビはポケモンGOの攻略ツール集です。レイドの火力ランキング、トレーナーバトルの対面シミュレート、個体値の順位、ジムの攻め・守り、マックスバトル対策まで13個の道具を無料で使えます。',
       og_title='GOナビ｜ポケモンGO 攻略ツール',
       og_desc='レイドの火力、GBLの対面、個体値の順位まで。13個の道具を無料で使えます。',
       eyebrow='POKÉMON GO TOOLS', name='GOナビ',
       tag='レイド・ジム・トレーナーバトル・個体値。13個の攻略ツールを無料で。',
       color='#7fb4ff', ld='site'),
  dict(path='/dps/', key='dps', src=['template.html', 'dps/index.html'],
       title='レイド火力チェッカー｜ポケモンGOのレイドDPSランキング｜GOナビ',
       desc='ポケモンGOのレイドボスを選ぶだけで、対ボスの火力(DPS)ランキングを自動で作ります。自分のポケモンはCPと個体値を入れると今の火力が分かります。最少討伐人数・スーパーメガレイドのシールド破壊にも対応。',
       og_title='レイド火力チェッカー｜ポケモンGO',
       og_desc='ボスを選ぶだけで、いちばん速く削れるポケモンが順に並びます。',
       eyebrow='POKÉMON GO RAID DPS', name='レイド火力チェッカー',
       tag='ボスを選ぶだけで、いちばん速く削れるポケモンが順に並びます',
       color='#ff7a5c', ld='app'),
  dict(path='/raid/', key='raid',
       title='レイドシミュレーター｜ポケモンGOの最少討伐人数｜GOナビ',
       desc='ポケモンGOのレイドを実戦どおりに再現して、何人で倒せるかを数えます。ボスのわざ・SPアタックの被弾・ひんしと再突入まで計算し、6匹の編成や天候・フレンド・チームパワーにも対応。',
       og_title='レイドシミュレーター｜ポケモンGO',
       og_desc='何人集まれば倒せるか、実際に戦わせて数えます。',
       eyebrow='POKÉMON GO RAID SIMULATOR', name='レイドシミュレーター',
       tag='何人集まれば倒せるか、実際に戦わせて数えます',
       color='#3fe0c4', ld='app'),
  dict(path='/type-dps/', key='type-dps',
       title='タイプ別火力ランキング｜ポケモンGOの最強アタッカー｜GOナビ',
       desc='ポケモンGOのタイプごとの最強アタッカーを火力(DPS)順に並べたランキング。ほのお・みず・ドラゴンなど17タイプをタップで切り替え、シャドウ・メガの有無も選べます。動画用のグラフ画像も保存できます。',
       og_title='タイプ別火力ランキング｜ポケモンGO',
       og_desc='ほのお・みずなど、タイプごとの最強アタッカーが分かります。',
       eyebrow='POKÉMON GO TYPE DPS RANKING', name='タイプ別火力ランキング',
       tag='ほのお・みずなど、タイプごとの最強アタッカーが分かります',
       color='#a68bff', ld='app'),
  dict(path='/max-battle/', key='max-battle',
       title='マックスバトル対策ツール｜ポケモンGOのダイマックス攻略｜GOナビ',
       desc='ポケモンGOのマックスバトルで、ボスごとに攻める役(アタッカー)と耐える役(タンク)のおすすめを並べます。ダイマックス・キョダイマックスのわざ、SPアタックの判定、0.5秒技の有無まで確認できます。',
       og_title='マックスバトル対策ツール｜ポケモンGO',
       og_desc='攻める役と耐える役、それぞれ誰を出せばいいか決まります。',
       eyebrow='POKÉMON GO MAX BATTLE', name='マックスバトル対策ツール',
       tag='攻める役と耐える役、それぞれ誰を出せばいいか決まります',
       color='#ff74c4', ld='app'),
  dict(path='/gym-attack/', key='gym-attack',
       title='ジム挑戦オススメツール｜ポケモンGOのジムバトル攻略｜GOナビ',
       desc='ポケモンGOのジムに置かれた相手を、いちばん速く崩せるポケモンを火力と総合力で並べます。シャドウ・メガの切り替え、わざ違いの表示にも対応。',
       og_title='ジム挑戦オススメツール｜ポケモンGO',
       og_desc='相手のジムを、いちばん速く崩せるポケモンを教えます。',
       eyebrow='POKÉMON GO GYM BATTLE ATTACK', name='ジム挑戦オススメツール',
       tag='相手のジムを、いちばん速く崩せるポケモンを教えます',
       color='#ffcc33', ld='app'),
  dict(path='/gym-defense/', key='gym-defense',
       title='ジム防衛オススメツール｜ポケモンGOのジムに置くポケモン｜GOナビ',
       desc='ポケモンGOのジムに置くと長く残りやすいポケモンを、耐久・タイプ相性・やる気の下がりにくさ・迎撃力から並べます。おすすめのわざ構成つき。',
       og_title='ジム防衛オススメツール｜ポケモンGO',
       og_desc='ジムに置くと、長く残りやすいポケモンが分かります。',
       eyebrow='POKÉMON GO GYM BATTLE DEFENSE', name='ジム防衛オススメツール',
       tag='ジムに置くと、長く残りやすいポケモンが分かります',
       color='#7ee787', ld='app'),
  dict(path='/gbl/', key='gbl',
       title='GBLシミュレーター｜ポケモンGOバトルリーグの対面計算｜GOナビ',
       desc='ポケモンGOのGOバトルリーグ(GBL)の対面を1ターンずつ再現するシミュレーター。環境上位との勝ち負け一覧、対策さがし、パーティ診断、3対3の模擬戦、見せ合い(6匹→3匹)まで無料で使えます。',
       og_title='GBLシミュレーター｜ポケモンGO',
       og_desc='この2匹が戦うとどうなるか、1ターンずつ再現します。',
       eyebrow='POKÉMON GO BATTLE LEAGUE', name='GBLシミュレーター',
       tag='この2匹が戦うとどうなるか、1ターンずつ再現します',
       color='#6ea1ff', ld='app'),
  dict(path='/battlelog/', key='battlelog',
       title='GBL対戦記録｜ポケモンGOバトルリーグの環境分析｜GOナビ',
       desc='ポケモンGOのGOバトルリーグで戦った相手を記録して、自分のレート帯でよく当たるポケモン・苦手な相手・刺さるポケモン・レートの推移を自動で分析します。記録は端末の中だけに保存されます。',
       og_title='GBL対戦記録｜ポケモンGO',
       og_desc='戦った相手を記録すると、自分がよく当たる相手が見えてきます。',
       eyebrow='POKÉMON GO BATTLE LOG', name='GBL対戦記録',
       tag='戦った相手を記録すると、自分がよく当たる相手が見えてきます',
       color='#f0b942', ld='app'),
  dict(path='/breakpoint/', key='breakpoint',
       title='GBLブレイクポイント計算｜ポケモンGOの個体値と強化の境目｜GOナビ',
       desc='ポケモンGOのトレーナーバトルで、ノーマルアタックのダメージが1上がる境目(ブレイクポイント)を環境上位100匹について一括で調べます。どの個体値・PLなら届くか、おすすめの個体まで分かります。',
       og_title='GBLブレイクポイント計算｜ポケモンGO',
       og_desc='あと少し強化すると、ダメージが1上がる境目が分かります。',
       eyebrow='POKÉMON GO BREAKPOINT', name='GBLブレイクポイント',
       tag='あと少し強化すると、ダメージが1上がる境目が分かります',
       color='#8ca3ff', ld='app'),
  dict(path='/rocket/', key='rocket',
       title='GOロケット団対策シミュレーター｜したっぱ・リーダー・サカキ｜GOナビ',
       desc='ポケモンGOのGOロケット団(したっぱ・シエラ・クリフ・アルロ・サカキ)を短い時間で倒すポケモンを探します。あいてのわざがどれで来ても勝てるかを計算し、3対3の模擬戦で通しの流れも試せます。',
       og_title='GOロケット団対策シミュレーター｜ポケモンGO',
       og_desc='したっぱやサカキを、短い時間で倒す組み合わせを探します。',
       eyebrow='POKÉMON GO TEAM ROCKET', name='GOロケット団対策シミュレーター',
       tag='したっぱやサカキを、短い時間で倒す組み合わせを探します',
       color='#ff6b6b', ld='app'),
  dict(path='/iv-checker/', key='iv-checker',
       title='個体値チェッカー｜ポケモンGOのPvP個体値順位｜GOナビ',
       desc='ポケモンGOの個体値を入れるだけで、リトル・スーパー・ハイパー・マスターリーグの順位(4096通り中)を同時に表示します。CPから個体値の組み合わせを逆引きする機能、アメXLの数、進化前のCPにも対応。',
       og_title='個体値チェッカー｜ポケモンGO',
       og_desc='その個体が4096通りの中で何位か、すぐ分かります。',
       eyebrow='POKÉMON GO IV CHECKER', name='個体値チェッカー',
       tag='その個体が4096通りの中で何位か、すぐ分かります',
       color='#ff7ec2', ld='app'),
  dict(path='/pokedex/', key='pokedex',
       title='ステータス図鑑｜ポケモンGOの種族値・弱点・わざ性能｜GOナビ',
       desc='ポケモンGOの全ポケモンの種族値・最大CP・最大SCP・弱点と耐性・わざ性能(ジム・レイド／トレーナーバトル)を1画面で確認できるステータス図鑑。わざ名や弱点からの逆引きもできます。',
       og_title='ステータス図鑑｜ポケモンGO',
       og_desc='種族値・弱点・わざの強さを、1画面でまとめて見られます。',
       eyebrow='POKÉMON GO STATUS DEX', name='ステータス図鑑',
       tag='種族値・弱点・わざの強さを、1画面でまとめて見られます',
       color='#bd93ff', ld='app'),
  dict(path='/bulk/', key='bulk',
       title='耐久指数ランキング｜ポケモンGOの倒されにくいポケモン｜GOナビ',
       desc='ポケモンGOの全ポケモンを倒されにくい順に並べた耐久指数(防御種族値×HP種族値)のランキング。シャドウ・メガ・ゲンシの切り替え、伝説系の除外、進化前を含めるかを選べます。',
       og_title='耐久指数ランキング｜ポケモンGO',
       og_desc='倒されにくいポケモンが順に並びます。防御とHPのかけ算です。',
       eyebrow='POKÉMON GO BULK RANKING', name='耐久指数ランキング',
       tag='倒されにくいポケモンが順に並びます。防御とHPのかけ算です',
       color='#8ec9ff', ld='app'),
  # 案内ページ（共有用画像はトップと同じ）
  dict(path='/about/', key='home', title='運営者情報｜GOナビ',
       desc='ポケモンGO攻略ツール集「GOナビ」の運営者情報・免責事項・著作権について。',
       og_title='運営者情報｜GOナビ', og_desc='ポケモンGO攻略ツール集「GOナビ」の運営者情報です。'),
  dict(path='/privacy/', key='home', title='プライバシーポリシー｜GOナビ',
       desc='ポケモンGO攻略ツール集「GOナビ」のプライバシーポリシー。保存する情報・広告・Cookie・外部サービスについて。',
       og_title='プライバシーポリシー｜GOナビ', og_desc='ポケモンGO攻略ツール集「GOナビ」のプライバシーポリシーです。'),
  dict(path='/contact/', key='home', title='お問い合わせ｜GOナビ',
       desc='ポケモンGO攻略ツール集「GOナビ」へのお問い合わせ・不具合の報告・ご意見はこちらから。',
       og_title='お問い合わせ｜GOナビ', og_desc='不具合の報告・ご意見はこちらから。'),
  dict(path='/backup/', key='home', title='データの引っ越し｜GOナビ',
       desc='ポケモンGO攻略ツール集「GOナビ」に保存した対戦記録・★登録・パーティなどを書き出して、別の端末やブラウザへ移せます。',
       og_title='データの引っ越し｜GOナビ', og_desc='保存した記録を書き出して、別の端末やブラウザへ移せます。'),
]

# 共有用画像でツール名が1行に入らないとき、折り返してよい位置（'|'）。語の途中で切らないため
NAME_BR = {
  'dps': 'レイド火力|チェッカー', 'raid': 'レイド|シミュレーター',
  'type-dps': 'タイプ別火力|ランキング', 'max-battle': 'マックスバトル|対策ツール',
  'gym-attack': 'ジム挑戦|オススメツール', 'gym-defense': 'ジム防衛|オススメツール',
  'breakpoint': 'GBL|ブレイクポイント', 'rocket': 'GOロケット団|対策シミュレーター',
  'bulk': '耐久指数|ランキング', 'iv-checker': '個体値|チェッカー',
}
for _p in PAGES:
    if _p['key'] in NAME_BR and _p.get('name'):
        _p['name_br'] = NAME_BR[_p['key']]

# 検索エンジンに見せない場所（管理用・作業用）
DISALLOW = ['/feedback/', '/scratchpad/', '/pvp-tests/', '/iconlab/']


# ---------------------------------------------------------------- 1) head のタグ
def head_block(p):
    url = SITE + p['path']
    img = f"{SITE}/assets/ogp/{p['key']}.png"
    e = lambda s: html.escape(s, quote=True)
    L = ['<!-- seo:start (build_seo.py が作る・手で編集しない) -->',
         f'<meta name="description" content="{e(p["desc"])}">',
         f'<link rel="canonical" href="{url}">',
         '<meta property="og:type" content="website">',
         f'<meta property="og:site_name" content="{BRAND}">',
         '<meta property="og:locale" content="ja_JP">',
         f'<meta property="og:title" content="{e(p["og_title"])}">',
         f'<meta property="og:description" content="{e(p["og_desc"])}">',
         f'<meta property="og:url" content="{url}">',
         f'<meta property="og:image" content="{img}">',
         '<meta property="og:image:width" content="1200">',
         '<meta property="og:image:height" content="630">',
         f'<meta property="og:image:alt" content="{e(p.get("name") or BRAND)}">',
         '<meta name="twitter:card" content="summary_large_image">']
    ld = p.get('ld')
    if ld == 'site':
        data = {'@context': 'https://schema.org', '@type': 'WebSite', 'name': BRAND,
                'alternateName': 'ポケモンGO 攻略ツール', 'url': SITE + '/', 'inLanguage': 'ja'}
    elif ld == 'app':
        data = {'@context': 'https://schema.org', '@type': 'WebApplication', 'name': p['name'],
                'url': url, 'description': p['desc'], 'applicationCategory': 'GameApplication',
                'operatingSystem': 'Any', 'inLanguage': 'ja',
                'isPartOf': {'@type': 'WebSite', 'name': BRAND, 'url': SITE + '/'},
                'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'JPY'}}
    else:
        data = None
    if data:
        L.append('<script type="application/ld+json">' +
                 json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '</script>')
    L.append('<!-- seo:end -->')
    return '\n'.join(L)


OLD_TAG = re.compile(
    r'^[ \t]*<(meta\s+name="(description|twitter:[^"]+)"|meta\s+property="og:[^"]+"|link\s+rel="canonical")[^>]*>[ \t]*\n',
    re.M)


def patch_head(fn, p):
    path = os.path.join(HERE, fn)
    s = open(path, encoding='utf-8').read()
    head_end = s.index('</head>')
    head, rest = s[:head_end], s[head_end:]
    head = re.sub(r'<!-- seo:start.*?<!-- seo:end -->\n?', '', head, flags=re.S)
    head = OLD_TAG.sub('', head)
    # 古い共有用タグの見出しコメント（タグはこのスクリプトが持つので不要）
    head = re.sub(r'^[ \t]*<!-- SNSに貼ったときの表示[^>]*-->[ \t]*\n', '', head, flags=re.M)
    t = re.search(r'<title>.*?</title>[ \t]*\n', head, re.S)
    if not t:
        raise SystemExit(f'{fn}: <title> が見つかりません')
    new_title = f'<title>{html.escape(p["title"], quote=False)}</title>\n'
    head = head[:t.start()] + new_title + head_block(p) + '\n' + head[t.end():]
    out = head + rest
    if out != s:
        open(path, 'w', encoding='utf-8').write(out)
        return True
    return False


# ---------------------------------------------------------------- 2) 共有用画像
FONT_W8 = '/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc'
FONT_W6 = '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc'
FONT_W4 = '/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc'
FONT_EN = ('/System/Library/Fonts/Avenir Next.ttc', 8)   # Heavy


ICON_DIR = {'dps': 'karyoku'}   # アイコンのフォルダ名がツールのキーと違うもの


def icon_dir_of(fn, key=None):
    # ツールのキーと同じ名前のフォルダを優先（個体値チェッカーはページが自前のアイコンを読むため、
    # ページの favicon からたどると見つからない）
    k = ICON_DIR.get(key, key)
    if k and os.path.exists(os.path.join(HERE, 'assets', 'icons', k, 'icon-512.png')):
        return k
    s = open(os.path.join(HERE, fn), encoding='utf-8').read()
    m = re.search(r'href="/assets/icons/([^/]+)/favicon-32\.png"', s)
    return m.group(1) if m else 'home'


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


NO_START = set('、。，．・ー）」』！？：')


def wrap_chars(draw, text, font, width):
    lines, cur = [], ''
    for ch in text:
        if draw.textlength(cur + ch, font=font) <= width or not cur:
            cur += ch
        elif ch in NO_START:          # 行頭に来てはいけない文字は前の行へ
            cur += ch
        else:
            lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def wrap(draw, text, font, width):
    """「、」「。」「・」の後ろを優先して折り返す（語の途中で切らない）。
    1つの区切りが1行に入らないときだけ文字単位に落とす"""
    chunks = re.findall(r'[^、。・]+[、。・]?', text)
    lines, cur = [], ''
    for c in chunks:
        if draw.textlength(cur + c, font=font) <= width:
            cur += c
            continue
        if cur:
            lines.append(cur)
            cur = ''
        if draw.textlength(c, font=font) <= width:
            cur = c
        else:
            parts = wrap_chars(draw, c, font, width)
            lines += parts[:-1]
            cur = parts[-1]
    if cur:
        lines.append(cur)
    return lines


def fit_name(draw, name, width, ImageFont):
    """ツール名の組み方を決める。'|' は折り返してよい位置。
    1行で66px以上に収まれば1行、だめなら '|' で2行にして大きく組む"""
    one = name.replace('|', '')
    for size in range(84, 65, -2):
        f = ImageFont.truetype(FONT_W8, size)
        if draw.textlength(one, font=f) <= width:
            return [one], size
    if '|' in name:
        parts = name.split('|')
        for size in range(84, 49, -2):
            f = ImageFont.truetype(FONT_W8, size)
            if all(draw.textlength(x, font=f) <= width for x in parts):
                return parts, size
    for size in range(64, 49, -2):
        f = ImageFont.truetype(FONT_W8, size)
        if draw.textlength(one, font=f) <= width:
            return [one], size
    return wrap_chars(draw, one, ImageFont.truetype(FONT_W8, 50), width), 50


def make_image(p, icon_dir):
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
    W, H = 1200, 630
    col = hexrgb(p['color'])
    img = Image.new('RGB', (W, H), (11, 16, 35))
    # 下地: 上から下へ少しだけ暗くなる紺
    grad = Image.linear_gradient('L').resize((W, H))
    img = Image.composite(Image.new('RGB', (W, H), (8, 12, 27)), Image.new('RGB', (W, H), (17, 25, 52)), grad)
    # ごく淡いにじみ（左にツールの色・右上に紫）
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((-120, 60, 620, 640), fill=col + (60,))
    g.ellipse((820, -260, 1380, 260), fill=(139, 92, 246, 40))
    glow = glow.filter(ImageFilter.GaussianBlur(110))
    img = Image.alpha_composite(img.convert('RGBA'), glow)
    d = ImageDraw.Draw(img)
    # 上端の細い帯（ツールの色 → 透明）
    bar = Image.new('RGBA', (W, 6), (0, 0, 0, 0))
    for x in range(W):
        a = int(255 * max(0.0, 1 - x / (W * 0.85)))
        for y in range(6):
            bar.putpixel((x, y), col + (a,))
    img.alpha_composite(bar, (0, 0))
    # アイコン（落ち影つき）
    ic = Image.open(os.path.join(HERE, 'assets', 'icons', icon_dir, 'icon-512.png')).convert('RGBA')
    S = 330
    ic = ic.resize((S, S), Image.LANCZOS)
    ix, iy = 92, (H - S) // 2
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sh.paste((0, 0, 0, 150), (ix + 6, iy + 16), ic.split()[3])
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    img = Image.alpha_composite(img, sh)
    img.alpha_composite(ic, (ix, iy))
    d = ImageDraw.Draw(img)
    # 文字（先に組み方を決めて高さを測り、ブロックごと縦の中央に置く）
    X, TW = 486, 1200 - 486 - 72
    f_en = ImageFont.truetype(FONT_EN[0], 28, index=FONT_EN[1])
    nm_lines, size = fit_name(d, p.get('name_br') or p['name'], TW, ImageFont)
    f_nm = ImageFont.truetype(FONT_W8, size)
    f_tg = ImageFont.truetype(FONT_W4, 32)
    tg_lines = wrap(d, p['tag'], f_tg, TW)[:3]
    NM_LH = int(size * 1.16)
    total = 52 + NM_LH * len(nm_lines) + 8 + 26 + 48 * len(tg_lines)
    y = max(96, (H - 90 - total) // 2)
    # 小見出し（字間を少し空けて描く）
    cx = X
    for ch in p['eyebrow']:
        d.text((cx, y), ch, font=f_en, fill=col)
        cx += d.textlength(ch, font=f_en) + 3.2
    y += 52
    for ln in nm_lines:
        d.text((X, y), ln, font=f_nm, fill=(255, 255, 255))
        y += NM_LH
    # ツール名の下の細い罫線
    y += 8
    for x in range(int(TW * 0.55)):
        a = int(220 * (1 - x / (TW * 0.55)))
        d.line([(X + x, y), (X + x, y + 2)], fill=col + (a,))
    y += 26
    for ln in tg_lines:
        d.text((X, y), ln, font=f_tg, fill=(196, 208, 240))
        y += 48
    # 右下: サイト名とアドレス
    f_br = ImageFont.truetype(FONT_W8, 30)
    f_ur = ImageFont.truetype(FONT_W4, 24)
    by = H - 78
    if p['key'] != 'home':
        hi = Image.open(os.path.join(HERE, 'assets', 'icons', 'home', 'icon-192.png')).convert('RGBA').resize((44, 44), Image.LANCZOS)
        img.alpha_composite(hi, (X, by - 4))
        d.text((X + 56, by), BRAND, font=f_br, fill=(255, 255, 255))
        d.text((X + 56 + d.textlength(BRAND, font=f_br) + 16, by + 6), 'gonavi.jp', font=f_ur, fill=(150, 165, 205))
    else:
        d.text((X, by + 4), 'gonavi.jp', font=f_ur, fill=(150, 165, 205))
    out = os.path.join(HERE, 'assets', 'ogp', p['key'] + '.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.convert('RGB').save(out, optimize=True)
    return out


# ---------------------------------------------------------------- 3) 4) サイトマップ・robots
def lastmod(fn):
    try:
        r = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', fn], cwd=HERE,
                           capture_output=True, text=True)
        return r.stdout.strip() or None
    except Exception:
        return None


def write_sitemap():
    rows = []
    for p in PAGES:
        fn = (p.get('src') or [p['path'].strip('/') + '/index.html' if p['path'] != '/' else 'index.html'])[-1]
        lm = lastmod(fn)
        pr = '1.0' if p['path'] == '/' else ('0.3' if not p.get('ld') else '0.8')
        rows.append(f'  <url><loc>{SITE}{p["path"]}</loc>' + (f'<lastmod>{lm}</lastmod>' if lm else '') +
                    f'<priority>{pr}</priority></url>')
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(rows) + '\n</urlset>\n')
    open(os.path.join(HERE, 'sitemap.xml'), 'w', encoding='utf-8').write(xml)


def write_robots():
    txt = 'User-agent: *\n' + ''.join(f'Disallow: {d}\n' for d in DISALLOW) + f'\nSitemap: {SITE}/sitemap.xml\n'
    open(os.path.join(HERE, 'robots.txt'), 'w', encoding='utf-8').write(txt)


def main():
    images = '--no-images' not in sys.argv
    made = set()
    for p in PAGES:
        files = p.get('src') or [('index.html' if p['path'] == '/' else p['path'].strip('/') + '/index.html')]
        for fn in files:
            ch = patch_head(fn, p)
            print(('更新 ' if ch else '変化なし ') + fn)
        if images and p.get('name') and p['key'] not in made:
            print('画像 ' + os.path.relpath(make_image(p, icon_dir_of(files[-1], p['key'])), HERE))
            made.add(p['key'])
    write_sitemap()
    write_robots()
    print('sitemap.xml / robots.txt を作りました')


if __name__ == '__main__':
    main()
