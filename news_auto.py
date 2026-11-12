# -*- coding: utf-8 -*-
"""
公式ニュース（https://pokemongo.com/ja/news）を毎朝読み、実装の告知をツールのデータに取り込む（2026-10-30タダシさん指示）

情報元のデータ（ゲーム内公開データ・対戦データ）は実装に追いつくのが遅いので、公式の告知を先に読んで反映する。
読み取った結果は .github/official_news.json に貯め、次の3か所がそれを読む:
  ・build_data.py / build_pvp_data.py … 新しいポケモン・メガ（未実装の印を外す）、新しいシャドウ
  ・mega_plus_info.py              … メガの＋わざの威力（レイド・対戦）と対戦の能力変化
  ・.claude/hooks/news_notice.py   … チャットの始めに「自動で入れたもの」「確かめてほしいもの」を知らせる

読み取りの決まり（ニュースの書き方に合わせた規則で読む。読めないものは「要確認」に回し、勝手に推測しない）:
  ① 新しいポケモン: 「初登場」「初めて登場」「初となる」の文（と見出しの直後の3行）にある「名前」のうち、
     対戦データで未実装の印が付いているものだけ。色違いの初登場は対象外（もう実装済みなので自然に外れる）
  ② メガ: 「◯◯」の「メガレベル」を「スーパーマックス」…の文と、初登場の「メガシンカ」の見出しの直後にある「メガ◯◯」
  ③ ＋わざ: 「◯◯」が、メガシンカ中に追加の「スペシャルアタック」の「わざ+」… の直後の
     「トレーナーバトル：威力N、効果」「（ジムと）レイドバトル：威力N」。時間は元わざと同じ・ゲージは1本(100)の決まり
     （build_data.py の add_info_plus）。対戦の消費ゲージは発表されないので、対戦データには入らない（決まりどおり）
  ④ シャドウ: 「シャドウ◯◯」と書かれ、対戦データでシャドウが無いもの
  ⑤ ダイマックス・キョダイマックスの初登場は、マックスバトルのデータが別なので「要確認」として知らせるだけ

使い方: python3 news_auto.py            … 一覧を読み、新しい記事・書き換わった記事を読み取って保存
        python3 news_auto.py --dry-run  … 保存せずに結果だけ見る
"""
import json, os, re, sys, html, hashlib, datetime, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(ROOT, '.github', 'official_news.json')
TODAY_MD = os.path.join(ROOT, 'news_today.md')   # その回に新しく分かったこと（毎朝のお知らせに足す・git に入れない）
BASE = 'https://pokemongo.com'
LIST_URL = BASE + '/ja/news'
UA = {'User-Agent': 'Mozilla/5.0 (compatible; gonavi-news-check)'}
RECENT_DAYS = 45   # この日数より古い記事は読み直さない


# ---------------------------------------------------------------- 読み込み（ビルドから使う）
def load():
    try:
        with open(STATE, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def _union(kind):
    out = {}
    for slug, rec in (load().get('articles') or {}).items():
        for k, v in (rec.get(kind) or {}).items():
            out.setdefault(k, dict(v, slug=slug))
    return out


def released_pvp():
    """実装の告知があったポケモン（対戦データのキー・小文字）"""
    return {k for k in _union('released') if not k.startswith('pve:')}


def released_pve():
    """実装の告知があったが対戦データに名前が無いポケモン（ゲーム内データのキー・大文字）。build_data.py が未実装の除外から外す"""
    return {k[4:] for k in _union('released') if k.startswith('pve:')}


def shadow_pvp():
    """シャドウの告知があったポケモン（対戦データのキー・小文字・シャドウの付かない本体のキー）"""
    return set(_union('shadow'))


def plus_info():
    """メガの＋わざ: {ジム・レイド側のメガのキー: {'base','raid','pvp','buff','slug'}}"""
    return _union('plus')


def new_megas():
    """どの情報元にも無いまま初登場が告知された新メガの名前（mega_auto.py が換算値で先行収録する）"""
    return {v.get('name') or k for k, v in _union('mega_new').items()}


def dynamax_pve():
    """ダイマックス・キョダイマックスの初登場が告知されたポケモン: {ゲーム内データのキー: 'D'|'G'}（build_max.py が読む）"""
    return {k: v.get('form', 'D') for k, v in _union('dmax').items()}


# ---------------------------------------------------------------- 取り寄せ・文字だけにする
def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', 'replace')


def to_lines(page):
    t = re.sub(r'<script.*?</script>|<style.*?</style>', '', page, flags=re.S)
    t = html.unescape(re.sub(r'<[^>]+>', '\n', t))
    return [l.strip() for l in t.splitlines() if l.strip()]


def published_of(page):
    m = re.search(r'"datePublished"\s*:\s*"([^"]+)"', page)
    if not m: return None
    try:
        d = datetime.datetime.fromisoformat(m.group(1).replace('Z', '+00:00'))
        return d.astimezone(datetime.timezone(datetime.timedelta(hours=9))).strftime('%Y-%m-%d')
    except Exception:
        return None


_FORM_SUFFIX = re.compile(r'^(.+?)\((メガX|メガY|メガ|ゲンシ|アローラ|ガラル|ヒスイ|パルデア|アーマード)(?:のすがた)?\)$')


def norm(s):
    s = s.replace('（', '(').replace('）', ')').replace('＋', '+').replace(' ', '').replace('　', '')
    s = s.strip('*＊')
    m = _FORM_SUFFIX.match(s)   # 「ヌメルゴン(ヒスイのすがた)」→「ヒスイヌメルゴン」・「ミュウツー(メガX)」→「メガミュウツーX」
    if m:
        base, tag = m.group(1), m.group(2)
        s = ('メガ' + base + tag[-1]) if tag in ('メガX', 'メガY') else tag + base
    return s


def pve_names():
    """ゲーム内データ側の名前 → キー（実装済み＋未実装の控え）。対戦データに無い・名前が付いていないポケモンの照合に使う"""
    out = {}
    for path in ('pokedex/unreleased.json', 'godata.json'):
        try:
            with open(os.path.join(ROOT, path), encoding='utf-8') as f:
                for k, v in (json.load(f).get('pokemon') or {}).items():
                    out.setdefault(norm(v['n']), (k, path.endswith('unreleased.json'), v['n']))
        except Exception:
            pass
    return out


# ---------------------------------------------------------------- 読み取り
DEBUT = re.compile(r'初登場|初めて登場|初となる|初めての登場')
BRACKET = re.compile(r'「([^「」]+)」')


def parse(lines, pvp, pve=None):
    """1つの記事を読み取る。返すのは released / shadow / plus / notes
    pve: ゲーム内データ側の名前→(キー, 未実装か)。対戦データに名前が無いポケモン（情報元が日本語名を付けていない・載っていない）
         でも、ゲーム内データ側の未実装の控えにあれば 'pve:キー' として実装の告知に入れる（2026-11-12）"""
    P = pvp['pokemon']
    pve = pve if pve is not None else {}
    by_name = {}
    for k, v in P.items():
        by_name.setdefault(norm(v['n']), k)
    moves_by_name = {norm(v['n']): k for k, v in pvp['moves'].items() if 'e' in v}
    out = {'released': {}, 'shadow': {}, 'plus': {}, 'dmax': {}, 'mega_new': {}, 'notes': []}

    # 初登場の文とその直後3行を「初登場の範囲」にする（見出しのあとに名前だけの行が並ぶ書き方のため）
    debut_idx = set()
    for i, l in enumerate(lines):
        if DEBUT.search(l) or re.search(r'「スーパーマックス」まで上げる', l):
            debut_idx.update(range(i, min(i + 4, len(lines))))
    for i in sorted(debut_idx):
        l = lines[i]
        for m in BRACKET.finditer(l):
            name = norm(m.group(1))
            if l[max(0, m.start() - 4):m.start()].endswith('色違いの'):
                continue
            dmax = re.match(r'^(キョダイマックス|ダイマックス)(.+)$', name)
            if dmax:
                base = dmax.group(2)
                form = 'G' if dmax.group(1) == 'キョダイマックス' else 'D'
                if base in pve:   # ゲーム内データ側のキーで控える → build_max.py が自動で足す（2026-11-12タダシさん指示）
                    out['dmax'][pve[base][0]] = {'name': pve[base][2], 'form': form}
                elif base in by_name:
                    out['notes'].append(('check', f'{dmax.group(1)}「{base}」が初登場（ゲーム内データ側に名前が無く自動で足せない。マックスバトルのデータを確かめる）'))
                continue
            k = by_name.get(name)
            if k and not P[k].get('r'):
                out['released'][k] = {'name': P[k]['n']}
            elif not k and name in pve and pve[name][1]:   # 対戦データに無いが、ゲーム内データ側の未実装の控えにはある
                out['released']['pve:' + pve[name][0]] = {'name': pve[name][2], 'pve': pve[name][0]}
            elif not k and name not in pve:
                # どの情報元にも無い新メガ（例: メガピクシー）: 元のポケモンが分かれば、原作の種族値の換算値で先行収録する（mega_auto.py）
                mm = re.match(r'^(メガ|ゲンシ)(.+?)([XYZ])?$', name)
                if mm and (mm.group(2) in by_name or mm.group(2) in pve):
                    out['mega_new'][name] = {'name': m.group(1).strip('*＊'), 'base': mm.group(2)}

    # シャドウ
    for l in lines:
        for m in BRACKET.finditer(l):
            name = norm(m.group(1))
            if not name.startswith('シャドウ'): continue
            k = by_name.get(name[4:])
            if k and not P[k].get('shadow'):
                out['shadow'][k] = {'name': P[k]['n']}

    # ＋わざ
    for i, l in enumerate(lines):
        if 'メガシンカ中に追加の「スペシャルアタック」' not in l or '覚えることができます' in l:
            continue
        mb = re.match(r'^「([^」]+)」が', l)
        mv = None
        for j in range(i, min(i + 4, len(lines))):
            mm = re.search(r'「([^「」]+?)[+＋]」', lines[j])
            if mm: mv = norm(mm.group(1)); break
        pvp_pw = raid_pw = None; effect = ''
        for j in range(i + 1, min(i + 10, len(lines))):
            if 'メガシンカ中に追加の' in lines[j]: break
            if lines[j] == 'トレーナーバトル' and j + 1 < len(lines):
                mm = re.match(r'^[：:]\s*威力\s*(\d+)(?:[、,]\s*(.*))?$', lines[j + 1])
                if mm: pvp_pw = int(mm.group(1)); effect = (mm.group(2) or '').strip()
            if 'レイドバトル' in lines[j] and j + 1 < len(lines):
                mm = re.match(r'^[：:]\s*威力\s*(\d+)', lines[j + 1])
                if mm: raid_pw = int(mm.group(1))
        if not mb or not mv:
            out['notes'].append(('check', f'＋わざの告知を読み取れません（{l[:40]}…）')); continue
        base_name = norm(mb.group(1))
        megas = [k for k, v in P.items() if v.get('mega') and re.fullmatch('(メガ|ゲンシ)' + re.escape(base_name) + '[XYZ]?', norm(v['n']))]
        base_mv = moves_by_name.get(mv)
        if len(megas) != 1:
            out['notes'].append(('check', f'「{base_name}」の＋わざ「{mv}＋」: 対象のメガが{len(megas)}匹で決められません（{megas}）')); continue
        if not base_mv:
            out['notes'].append(('check', f'「{base_name}」の＋わざ「{mv}＋」: 元わざが見つかりません')); continue
        mk = megas[0].upper()
        buff = parse_buff(effect)
        if effect and not buff:
            out['notes'].append(('check', f'{P[megas[0]]["n"]}の「{mv}＋」: 対戦の効果「{effect}」を読み取れません（mega_plus_info.py の MEGA_PLUS_PVP_BUFF に手で入れる）'))
        out['plus'][mk] = {'name': P[megas[0]]['n'], 'move': mv + '＋', 'base': base_mv,
                           'raid': raid_pw, 'pvp': pvp_pw, 'buff': buff, 'effect': effect}
        # スーパーマックスの告知があったメガは実装済み
        if not P[megas[0]].get('r'):
            out['released'][megas[0]] = {'name': P[megas[0]]['n']}
    return out


def parse_buff(t):
    """「こうげきとぼうぎょが1段階増加することがある」「使用するポケモンの「ぼうぎょ」を3段階下げます」などを読む"""
    if not t: return None
    t = t.replace('「', '').replace('」', '')
    m = re.search(r'(\d)段階', t)
    if not m: return None
    n = int(m.group(1))
    if re.search(r'下げ|下が|減少|ダウン', t): n = -n
    elif not re.search(r'上げ|上が|増加|アップ', t): return None
    atk, df = 'こうげき' in t, 'ぼうぎょ' in t
    if not (atk or df): return None
    target = 'opponent' if re.search(r'相手|あいて', t) else 'self'
    chance = None if 'ことがある' in t or '確率' in t else 1.0
    return {'bf': [n if atk else 0, n if df else 0], 'bt': target, 'bc': chance}


def keep_old(old, res):
    """記事を読み直したとき、前に読み取った実装・シャドウ・＋わざを消さない。
    parse は「いま未実装のもの」だけを拾うので、取り込み済みのものは2回目から拾わない＝そのまま置き換えると未実装へ戻る"""
    return {k: {**((old or {}).get(k) or {}), **res.get(k, {})} for k in ('released', 'shadow', 'plus', 'dmax', 'mega_new')}


# ---------------------------------------------------------------- 本体
# ---------------------------------------------------------------- 公式トップとイベントのページ（2026-11-12タダシさん指示）
# ニュース一覧に出ないページ（ワイルドエリア・シーズンなどのビッグイベント）も読む。
# トップ（/ja）のメニューにあるパスから始めて、そのページの中のパスを1段たどる（深さ2・最大 MAX_PAGES）
TOP_URL = BASE + '/ja'
SITE_SKIP = {'/ja', '/ja/', '/ja/news', '/ja/store', '/ja/tickets', '/ja/map', '/ja/leaderboard', '/ja/code-redemption',
             '/ja/find-your-community', '/ja/reward-road', '/ja/events', '/ja/featured-in-person-events', '/ja/support'}
MAX_PAGES = 40
PATH_RE = re.compile(r'(/ja/[A-Za-z0-9_\-][A-Za-z0-9_\-/]*)')


def site_paths(page):
    out = set()
    for p in PATH_RE.findall(page):
        p = p.rstrip('/')
        if p.startswith('/ja/news') or p in SITE_SKIP or '//' in p or len(p) > 80:
            continue
        out.add(p)
    return out


def site_pages():
    """{パス: HTML} トップのメニュー → 各ページ → その中のパス（1段）"""
    pages = {}
    try:
        top = fetch(TOP_URL)
    except Exception as e:
        print('公式トップを読めませんでした（イベントページは今回読まない）:', e)
        return pages
    queue = sorted(site_paths(top))
    seen = set(queue)
    depth = {p: 1 for p in queue}
    while queue and len(pages) < MAX_PAGES:
        p = queue.pop(0)
        try:
            page = fetch(BASE + p)
        except Exception as e:
            print('  読めません', p, e); continue
        pages[p] = page
        if depth[p] >= 2:
            continue
        for q in sorted(site_paths(page)):
            if q not in seen:
                seen.add(q); depth[q] = depth[p] + 1; queue.append(q)
    return pages


def read_one(key, url, page, old, pvp, today, arts, new_notes, is_news, pve=None):
    """1ページを読み取って記録する。返り値は読んだか（変化が無ければ False）"""
    lines = to_lines(page)
    try:
        start = lines.index('中文') + 1   # 言語の一覧のあとが本文
    except ValueError:
        start = 0
    body = lines[start:]
    h = hashlib.sha1('\n'.join(body).encode()).hexdigest()[:12]
    if old and old.get('hash') == h:
        return False
    mt = re.search(r'<title[^>]*>(.*?)</title>', page, re.S)
    if not is_news and mt:
        title = html.unescape(re.sub(r'<[^>]+>', '', mt.group(1))).strip()[:60]   # イベントのページは <title> を使う
    else:
        title = html.unescape(mt.group(1)).strip() if mt and start == 0 else (body[1] if len(body) > 1 else key)
    res = parse(body, pvp, pve)
    seen_notes = []
    for n in res['notes']:   # 同じ知らせが何行にも出るので1つにまとめる
        if list(n) not in seen_notes: seen_notes.append(list(n))
    res['notes'] = [tuple(n) for n in seen_notes]
    rec = {'title': title, 'published': (published_of(page) if is_news else None) or (old or {}).get('published') or today,
           'hash': h, 'read': today, 'url': url,
           **keep_old(old, res)}
    # 知らせ（1度読んだページが書き換わったときは、前に無かったものだけ）
    notes = []
    for k, v in res['released'].items():
        if k not in (old or {}).get('released', {}):
            notes.append(('auto', f'{v["name"]}（{k}）の実装の告知 → 未実装の印を外して全ツールに入れる'))
    for k, v in res['shadow'].items():
        if k not in (old or {}).get('shadow', {}):
            notes.append(('auto', f'シャドウ{v["name"]}の告知 → シャドウを付ける'))
    for k, v in res['mega_new'].items():
        if k not in (old or {}).get('mega_new', {}):
            notes.append(('auto', f'{v["name"]}の初登場の告知（情報元にまだ無い） → 原作の種族値の換算値で先行収録（実装後に確定値と照らし合わせる）'))
    for k, v in res['dmax'].items():
        if k not in (old or {}).get('dmax', {}):
            notes.append(('auto', f'{"キョダイマックス" if v["form"] == "G" else "ダイマックス"}{v["name"]}の初登場の告知 → マックスバトルのデータに足す'
                          + '（ボスの設定値は未確認なので既定値）'))
    for k, v in res['plus'].items():
        if (old or {}).get('plus', {}).get(k) != v:
            notes.append(('auto', f'{v["name"]}の＋わざ「{v["move"]}」 レイド威力{v["raid"]}・対戦威力{v["pvp"]}'
                          + (f'・効果「{v["effect"]}」' if v['effect'] else '')
                          + '（レイドは元わざの時間・ゲージ1本で計算。対戦は消費ゲージが分かるまで入れない）'))
    notes += [n for n in res['notes'] if list(n) not in [list(x) for x in (old or {}).get('notes', [])]]
    rec['notes'] = [list(n) for n in res['notes']]
    arts[key] = rec
    for kind, text in notes:
        if any(n['text'] == text for n in new_notes):   # 同じ告知が別のページにもあるときは1つにまとめる
            continue
        new_notes.append({'id': f'{key}:{hashlib.sha1(text.encode()).hexdigest()[:8]}', 'kind': kind,
                          'slug': key, 'url': url, 'title': title, 'date': today, 'text': text})
    print(f'  読み取り {key}: 実装{len(res["released"])} シャドウ{len(res["shadow"])} ＋わざ{len(res["plus"])} 要確認{len(res["notes"])}')
    return True


def main():
    dry = '--dry-run' in sys.argv
    state = load()
    arts = state.setdefault('articles', {})
    with open(os.path.join(ROOT, 'pvp_data.json'), encoding='utf-8') as f:
        pvp = json.load(f)
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime('%Y-%m-%d')
    new_notes = []
    pve = pve_names()
    # ① ニュース一覧の記事
    try:
        listing = fetch(LIST_URL)
        slugs = sorted(set(re.findall(r'href="/ja/news/([A-Za-z0-9_\-]+)"', listing)))
        print(f'公式ニュースの記事 {len(slugs)}件')
    except Exception as e:
        print('公式ニュースの一覧を読めませんでした（記事は今回読まない）:', e)
        slugs = []
    for slug in slugs:
        old = arts.get(slug)
        if old and old.get('published') and (datetime.date.fromisoformat(today) - datetime.date.fromisoformat(old['published'])).days > RECENT_DAYS:
            continue
        try:
            page = fetch(f'{LIST_URL}/{slug}')
        except Exception as e:
            print('  読めません', slug, e); continue
        read_one(slug, f'{LIST_URL}/{slug}', page, old, pvp, today, arts, new_notes, True, pve)
    # ② 公式トップのメニューからたどれるイベント・シーズンのページ（一覧に出ない告知もここで拾う）
    pages = site_pages()
    print(f'公式トップからたどったページ {len(pages)}件')
    for path, page in pages.items():
        key = 'page:' + path[len('/ja/'):]
        read_one(key, BASE + path, page, arts.get(key), pvp, today, arts, new_notes, False, pve)
    log = state.setdefault('notices', [])
    known = {n['id'] for n in log}
    log += [n for n in new_notes if n['id'] not in known]
    state['notices'] = log[-200:]
    for n in new_notes:
        print(('  ✅ ' if n['kind'] == 'auto' else '  ⚠ ') + n['text'] + f'（{n["title"]}）')
    if dry:
        print('（試しなので保存していません）'); return 0
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    with open(STATE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=1, sort_keys=True)
    with open(TODAY_MD, 'w', encoding='utf-8') as f:
        if new_notes:
            f.write('\n## 公式ニュースから読み取ったこと\n\n')
            for n in new_notes:
                f.write(('- ✅ ' if n['kind'] == 'auto' else '- ⚠ 要確認: ') + n['text']
                        + f'（[{n["title"]}]({n.get("url") or LIST_URL + "/" + n["slug"]})）\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
