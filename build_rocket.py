#!/usr/bin/env python3
"""GOロケット団（したっぱ・リーダー・サカキ）の手持ちを3つの外部攻略情報から読み取り、
3つとも一致したものだけを assets/rocket_roster.js に反映する（2026-10-06 タダシさん指示）。

- 手持ちはイベントの切り替わりで入れ替わり、各情報元は2〜3日かけて少しずつ追いつく。
  なので「1人ずつ」比べ、3つの情報元がそろった人だけを書き換える（そろうまでは前のまま）。
- 比べるのは各枠の候補の顔ぶれ（並び順は問わない）。
- ゲームデータ側の名前（pvp_data.json）に当てはまらないポケモンが1匹でもあれば、その情報元のその人は「不明」扱い＝反映しない。
- 結果は rocket_changes.md に書く（変化・待ち・読み取れなかった情報元）。
  状態（いつから食い違っているか等）は .github/rocket_state.json に持つ（公開サイトには出ない）。

使い方:
  python3 build_rocket.py            # 取りに行って反映
  python3 build_rocket.py --dry      # 書き換えずに結果だけ表示
  python3 build_rocket.py --cache D  # 取ってきたHTMLを D に保存／あれば使う（確認用）

画面・コメント・お知らせには情報元の名前を書かない（情報1・2・3 と呼ぶ）。
"""
import html
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_JS = os.path.join(ROOT, 'assets', 'rocket_roster.js')
OUT_MD = os.path.join(ROOT, 'rocket_changes.md')
STATE = os.path.join(ROOT, '.github', 'rocket_state.json')
ID_CACHE = os.path.join(ROOT, '.github', 'rocket_ids.json')
PVP = os.path.join(ROOT, 'pvp_data.json')

JST = timezone(timedelta(hours=9))
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

SRC_LABEL = {1: '情報1（国内）', 2: '情報2（国内）', 3: '情報3（海外）'}
URL1 = 'https://pokemongo-get.com/pokego02797/'
URL2_GRUNT = 'https://9db.jp/pokemongo/data/6872'
URL2_LEADER = 'https://9db.jp/pokemongo/data/8147'
URL2_ID = 'https://9db.jp/pokemongo/data/{}'
URL3 = 'https://leekduck.com/rocket-lineups/'

# 食い違いが続いたら知らせるまでの日数（各情報元は2〜3日で追いつくため）
WAIT_DAYS = 4

# ---- したっぱのタイプ（画面の並び＝全ツール共通のタイプの並び）----
TYPE_ORDER = ['normal', 'grass', 'fire', 'water', 'electric', 'ice', 'rock', 'flying', 'bug', 'psychic',
              'ghost', 'fighting', 'ground', 'poison', 'dragon', 'steel', 'dark', 'fairy', 'none', 'decoy']
TYPE_JA = {'normal': 'ノーマル', 'grass': 'くさ', 'fire': 'ほのお', 'water': 'みず', 'electric': 'でんき',
           'ice': 'こおり', 'rock': 'いわ', 'flying': 'ひこう', 'bug': 'むし', 'psychic': 'エスパー',
           'ghost': 'ゴースト', 'fighting': 'かくとう', 'ground': 'じめん', 'poison': 'どく', 'dragon': 'ドラゴン',
           'steel': 'はがね', 'dark': 'あく', 'fairy': 'フェアリー', 'none': 'タイプなし', 'decoy': 'おとり'}
LEADERS = [('sierra', 'シエラ'), ('cliff', 'クリフ'), ('arlo', 'アルロ')]
BOSS = [('giovanni', 'サカキ')]
LEADER_NAME = dict(LEADERS + BOSS)

# 情報2のしたっぱは「セリフ」で見分ける（タイプの手がかりになる言葉）
PHRASE_TYPE = [('ノーマルタイプ', 'normal'), ('華麗に舞', 'flying'), ('炎', 'fire'), ('潮風', 'water'),
               ('ツタ', 'grass'), ('ビリビリ', 'electric'), ('凍らせ', 'ice'), ('筋肉', 'fighting'),
               ('毒', 'poison'), ('地面', 'ground'), ('エスパー', 'psychic'), ('むしポケ', 'bug'),
               ('ロック', 'rock'), ('ヒヒ', 'ghost'), ('ドラゴン', 'dragon'), ('影あり', 'dark'),
               ('はがね', 'steel'), ('フェアリー', 'fairy'), ('勝者', 'none')]
# 情報2のリーダーのページは、人ごとの画像のリンク先の番号で見分ける
ID2_LEADER = {'8182': 'sierra', '8183': 'cliff', '8181': 'arlo', '8246': 'giovanni', '8258': 'decoy'}
# 情報1の行の種類
CLS1 = {'boss_sakaki': 'giovanni', 'boss_cliff': 'cliff', 'boss_sierra': 'sierra', 'boss_arlo': 'arlo',
        'member_decoy': 'decoy', 'member_hidden': 'none'}
# 情報3の人の名前
NAME3 = {'Giovanni': 'giovanni', 'Cliff': 'cliff', 'Arlo': 'arlo', 'Sierra': 'sierra'}

REGION_JA = {'アローラ': 'アローラ', 'ガラル': 'ガラル', 'ヒスイ': 'ヒスイ', 'パルデア': 'パルデア'}
REGION_EN = {'Alolan': 'alolan', 'Galarian': 'galarian', 'Hisuian': 'hisuian', 'Paldean': 'paldean'}


def now_jst():
    return datetime.now(JST)


def fetch(url, cache_dir=None):
    if cache_dir:
        fn = os.path.join(cache_dir, re.sub(r'[^A-Za-z0-9]+', '_', url) + '.html')
        if os.path.exists(fn):
            return open(fn, encoding='utf-8').read()
    last = None
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.8'})
            with urllib.request.urlopen(req, timeout=30) as r:
                s = r.read().decode('utf-8', errors='replace')
            if cache_dir:
                os.makedirs(cache_dir, exist_ok=True)
                open(fn, 'w', encoding='utf-8').write(s)
            return s
        except Exception as e:  # 一時的な失敗は少し待って取り直す
            last = e
            time.sleep(3 * (i + 1))
    raise last


def strip(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s)).strip()


# ---- 名前 → ゲームデータのキー ----
class Names:
    def __init__(self):
        P = json.load(open(PVP, encoding='utf-8'))['pokemon']
        self.P = P
        self.ja = {}
        for k, v in P.items():
            if '_mega' in k or '_primal' in k or k.endswith('_shadow') or v.get('hid'):
                continue
            n = v.get('n')
            if not n:
                continue
            # 同じ名前が複数あるときは、実装済み・キーの短いものを優先
            cur = self.ja.get(n)
            if cur is None or (P[cur].get('r', 0), -len(cur)) < (v.get('r', 0), -len(k)):
                self.ja[n] = k

    def from_ja(self, name):
        n = name.replace('（', '(').replace('）', ')').replace('\n', '').strip()
        n = re.sub(r'\s+', '', n)
        m = re.match(r'^(.+?)\((.+?)\)$', n)
        if m:
            base, form = m.group(1), m.group(2)
            form = form.replace('のすがた', '').replace('すがた', '')
            if form in REGION_JA:
                n = REGION_JA[form] + base
            else:
                n = base
        return self.ja.get(n)

    def from_en(self, name):
        n = name.strip()
        words = n.split(' ')
        suf = ''
        if words and words[0] in REGION_EN:
            suf = '_' + REGION_EN[words[0]]
            n = ' '.join(words[1:])
        k = re.sub(r"[.'’]", '', n.lower())
        k = re.sub(r'[\s\-]+', '_', k) + suf
        if k in self.P:
            return k
        # 姿の名前が付いたキーしか無いもの（darmanitan_standard など）は、名前に括弧の無い姿を選ぶ
        cand = [x for x in self.P if x.startswith(k + '_') and not re.search(r'_(mega|primal|shadow|alolan|galarian|hisuian|paldean)', x[len(k):])
                and '(' not in self.P[x].get('n', '(') and '（' not in self.P[x].get('n', '（')]
        return cand[0] if len(cand) == 1 else None


def dedupe(xs):
    out = []
    for x in xs:
        if x not in out:
            out.append(x)
    return out


def to_keys(slots, conv):
    """[[名前,...]x3] → ([[キー,...]x3], 当てはまらなかった名前の一覧)"""
    bad, out = [], []
    for sl in slots:
        ks = []
        for nm in sl:
            k = conv(nm)
            if k:
                ks.append(k)
            else:
                bad.append(nm)
        out.append(dedupe(ks))
    return out, bad


# ---- 情報1 ----
def parse1(s, names):
    rows = []
    parts = re.split(r'<g class="rocketpoke_row ', s)[1:]
    for p in parts:
        cls = p[:p.find('"')]
        if cls.startswith('member_'):
            who = CLS1.get(cls, cls[len('member_'):])
            gender = 'm' if 'MGrunt' in p[:3000] else 'f' if 'FGrunt' in p[:3000] else 'b'
        else:
            who = CLS1.get(cls)
            gender = 'b'
        if not who:
            continue
        starts = [m.start() for m in re.finditer(r'<svg class="[^"]*" x="\d+" width="163" height="82"', p)][:3]
        if len(starts) != 3:
            continue
        starts.append(len(p))
        slots = []
        for a, b in zip(starts, starts[1:]):
            seg = p[a:b]
            slots.append([strip(m) for m in re.findall(r'class="rocketpoke_poke_name[^"]*"[^>]*>(.*?)</text>', seg, re.S)])
        rows.append((who, gender, slots))
    return rows


# ---- 情報2 ----
def id_names(ids, cache_dir=None):
    cache = {}
    if os.path.exists(ID_CACHE):
        cache = json.load(open(ID_CACHE, encoding='utf-8'))
    changed = False
    for i in ids:
        if i in cache:
            continue
        s = fetch(URL2_ID.format(i), cache_dir)
        m = re.search(r'<title>\s*【ポケモンGO】([^<|｜]+)', s)
        if m:
            cache[i] = m.group(1).strip()
            changed = True
        time.sleep(0.5)
    if changed:
        os.makedirs(os.path.dirname(ID_CACHE), exist_ok=True)
        with open(ID_CACHE, 'w', encoding='utf-8') as f:
            json.dump(dict(sorted(cache.items(), key=lambda x: int(x[0]))), f, ensure_ascii=False, indent=0)
    return cache


def parse2(grunt_html, leader_html, cache_dir=None):
    raw = []   # (who, gender, [[id,...]x3])
    for t in re.findall(r'<table[^>]*wiki_grunt[^>]*>.*?</table>', grunt_html, re.S):
        ph = re.search(r'wiki_phrase[^>]*>(.*?)</td>', t, re.S)
        if not ph:
            continue
        phrase = strip(ph.group(1))
        genders = set(re.findall(r'[♂♀]', phrase))
        gender = 'b' if len(genders) != 1 else ('m' if '♂' in genders else 'f')
        who = next((ty for kw, ty in PHRASE_TYPE if kw in phrase), None)
        if not who:
            continue
        tds = [td for td in re.findall(r'<td[^>]*>.*?</td>', t, re.S) if 'data-id=' in td]
        if len(tds) != 3:
            continue
        raw.append((who, gender, [dedupe(re.findall(r'data-id="(\d+)"', td)) for td in tds]))
    body = leader_html.split("<div class='toc'>")[0]   # 下の「過去の使用ポケモン」は読まない
    for m in re.finditer(r'<p><a href="data/(\d+)"><img[^>]*></a></p>\s*(<table.*?</table>)', body, re.S):
        who = ID2_LEADER.get(m.group(1))
        if not who:
            continue
        tds = [td for td in re.findall(r'<td[^>]*>.*?</td>', m.group(2), re.S) if 'data-id=' in td]
        if len(tds) != 3:
            continue
        raw.append((who, 'b', [dedupe(re.findall(r'data-id="(\d+)"', td)) for td in tds]))
    ids = sorted({i for _, _, sl in raw for s in sl for i in s}, key=int)
    nm = id_names(ids, cache_dir)
    return [(w, g, [[nm.get(i, '#' + i) for i in s] for s in sl]) for w, g, sl in raw]


# ---- 情報3 ----
def parse3(s):
    rows = []
    parts = re.split(r'<div class="rocket-profile"', s)[1:]
    for p in parts:
        nm = re.search(r'<div class="name">(.*?)</div>', p)
        if not nm:
            continue
        name = re.sub(r'\s+', ' ', strip(nm.group(1)).replace('\xa0', ' '))
        if name in NAME3:
            who, gender = NAME3[name], 'b'
        else:
            m = re.match(r'^(Decoy )?(?:(\w+)-type )?(Male|Female) Grunt$', name)
            if not m:
                continue
            gender = 'm' if m.group(3) == 'Male' else 'f'
            who = 'decoy' if m.group(1) else (m.group(2) or 'none').lower()
        slots = []
        for sl in re.split(r'<div class="slot', p)[1:4]:
            slots.append(re.findall(r'data-pokemon="([^"]+)"', sl))
        if len(slots) == 3:
            rows.append((who, gender, slots))
    return rows


# ---- 行 → 人ごとの手持ち ----
def split_types(all_rows):
    """どれかの情報元で同じタイプが2行あるタイプ＝性別で分ける"""
    sp = set()
    for rows in all_rows:
        cnt = {}
        for who, g, _ in rows:
            cnt[who] = cnt.get(who, 0) + 1
        sp |= {w for w, c in cnt.items() if c > 1}
    return sp


def to_map(rows, sp, conv):
    out, bad = {}, {}
    for who, g, slots in rows:
        keys = [who] if who not in sp else [f'{who}_{x}' for x in (['m', 'f'] if g == 'b' else [g])]
        ks, b = to_keys(slots, conv)
        for k in keys:
            if b:
                bad[k] = b
            else:
                out[k] = ks
    return out, bad


def same(a, b):
    return a is not None and b is not None and len(a) == len(b) and all(set(x) == set(y) for x, y in zip(a, b))


def label(gid):
    if gid in LEADER_NAME:
        return LEADER_NAME[gid]
    base, _, g = gid.partition('_')
    return TYPE_JA.get(base, base) + ('♂' if g == 'm' else '♀' if g == 'f' else '')


def grunt_sort(gid):
    base, _, g = gid.partition('_')
    return (TYPE_ORDER.index(base) if base in TYPE_ORDER else 99, g)


# ---- いまのファイル ----
def read_current():
    s = open(OUT_JS, encoding='utf-8').read()
    body = s[s.index('{', s.index('window.ROCKET_ROSTER')):s.rindex('}') + 1]
    # JSのオブジェクト → JSON（キーに引用符・末尾のカンマを外す・' → "）
    j = re.sub(r"'", '"', body)
    j = re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r'\1"\2":', j)
    j = re.sub(r',(\s*[}\]])', r'\1', j)
    data = json.loads(j)
    cur = {}
    for kind in ('leader', 'boss', 'grunt'):
        for w in data['list'].get(kind, []):
            cur[w['id']] = w['slots']
    return data.get('updated', ''), cur


def write_js(updated, ros, P):
    def slot_js(sl):
        return '[' + ', '.join(f"'{k}'" for k in sl) + ']'

    def who_js(gid, name, slots):
        inner = ''.join(f'        {slot_js(sl)},\n' for sl in slots)
        return f"      {{ id: '{gid}', name: '{name}', slots: [\n{inner}      ] }},\n"

    lines = [
        '// GOロケット団（したっぱ・リーダー・サカキ）の手持ちデータ',
        '// ------------------------------------------------------------------',
        '// ⚠ build_rocket.py が毎日つくる生成物。3つの外部攻略情報を読み、3つとも一致した人だけを書き換える',
        '// （そろうまでは前のまま）。手で直したいときもこのファイルを直してよいが、3つの情報がそろって',
        '// 別の中身になった日に上書きされる。',
        '// slots = [1匹目の候補, 2匹目の候補, 3匹目の候補]。候補が1つなら固定、2つ以上ならランダム。',
        '// 中身は pvp_data.js のポケモンキー。あいては必ずシャドウなので、ここには書かない。',
        '// わざは公開情報が安定しないため持たない（画面の選択欄で選ぶ／既定はおぼえるわざの先頭）。',
        '// grunt の id は「タイプ」（同じタイプに2人いれば _m=♂ / _f=♀）、none=セリフにタイプなし、decoy=おとり。',
        'window.ROCKET_ROSTER = {',
        f"  updated: '{updated}',",
        '  list: {',
    ]
    for kind, ids in (('leader', [g for g, _ in LEADERS]), ('boss', [g for g, _ in BOSS]),
                      ('grunt', sorted([g for g in ros if g not in LEADER_NAME], key=grunt_sort))):
        lines.append(f'    {kind}: [')
        body = ''.join(who_js(g, label(g), ros[g]) for g in ids if g in ros)
        lines.append(body.rstrip('\n'))
        lines.append('    ],')
    lines += ['  },', '};', '']
    open(OUT_JS, 'w', encoding='utf-8').write('\n'.join(l for l in lines if l != '') + '\n')


def names_of(slots, P):
    return ' / '.join('・'.join(P[k]['n'] if k in P else k for k in sl) for sl in slots)


def main():
    dry = '--dry' in sys.argv
    cache_dir = sys.argv[sys.argv.index('--cache') + 1] if '--cache' in sys.argv else None
    names = Names()
    P = names.P
    today = now_jst().strftime('%Y-%m-%d')

    rows, fail = {}, {}
    for n, job in ((1, lambda: parse1(fetch(URL1, cache_dir), names)),
                   (2, lambda: parse2(fetch(URL2_GRUNT, cache_dir), fetch(URL2_LEADER, cache_dir), cache_dir)),
                   (3, lambda: parse3(fetch(URL3, cache_dir)))):
        try:
            r = job()
            lead = {w for w, _, _ in r if w in LEADER_NAME}
            grunts = [w for w, _, _ in r if w not in LEADER_NAME]
            # 読み取りの作りが変わったら、ここで気づく（人数が明らかに少ない）
            if len(lead) < 4 or len(grunts) < 15:
                raise RuntimeError(f'読み取れた人数が少ない（リーダー・サカキ{len(lead)}人・したっぱ{len(grunts)}人）')
            rows[n] = r
        except Exception as e:
            fail[n] = str(e)[:200]

    sp = split_types(rows.values())
    conv = {1: names.from_ja, 2: names.from_ja, 3: names.from_en}
    maps, bads = {}, {}
    for n, r in rows.items():
        maps[n], bads[n] = to_map(r, sp, conv[n])

    updated, cur = read_current()
    state = json.load(open(STATE, encoding='utf-8')) if os.path.exists(STATE) else {}
    pend = state.get('pending', {})
    fails = state.get('fail', {})

    ids = set(cur) | {g for m in maps.values() for g in m}
    new = dict(cur)
    changed, waiting, notify_wait = [], [], []
    for gid in sorted(ids, key=lambda g: (g not in LEADER_NAME, grunt_sort(g))):
        vals = [maps.get(n, {}).get(gid) for n in (1, 2, 3)]
        if len(rows) == 3 and all(v is not None for v in vals) and same(vals[0], vals[1]) and same(vals[1], vals[2]):
            pend.pop(gid, None)
            if not same(vals[2], cur.get(gid)):
                # 並び順は情報3（海外）にそろえる（3つとも同じ顔ぶれなので、どれでも中身は同じ）
                new[gid] = vals[2]
                changed.append((gid, cur.get(gid), vals[2]))
            continue
        # そろっていない: どれか1つでもいまと違えば「待ち」
        diff = [n for n, v in zip((1, 2, 3), vals) if v is not None and not same(v, cur.get(gid))]
        miss = [n for n, v in zip((1, 2, 3), vals) if v is None]
        if not diff and not (miss and gid not in cur):
            pend.pop(gid, None)
            continue
        since = pend.get(gid, {}).get('since', today)
        told = pend.get(gid, {}).get('told', False)
        pend[gid] = {'since': since, 'told': told}
        days = (datetime.strptime(today, '%Y-%m-%d') - datetime.strptime(since, '%Y-%m-%d')).days
        waiting.append((gid, days, vals))
        if days >= WAIT_DAYS and not told:
            notify_wait.append((gid, days, vals))
            pend[gid]['told'] = True

    new_fail = []
    for n in (1, 2, 3):
        if n in fail:
            if n not in fails:
                fails[n] = today
                new_fail.append(n)
        else:
            fails.pop(str(n), None)
            fails.pop(n, None)
    fails = {str(k): v for k, v in fails.items()}

    # ---- 報告 ----
    md = []
    if changed:
        md.append('## 🚀 ロケット団の手持ちを更新しました（3つの情報がそろった人）\n')
        for gid, old, nw in changed:
            md.append(f'- **{label(gid)}**: {names_of(nw, P)}')
            if old:
                md.append(f'  - 前: {names_of(old, P)}')
        md.append('')
    if notify_wait:
        md.append(f'## ⏳ {WAIT_DAYS}日以上そろわないポケモンがいます（確認をお願いします）\n')
        for gid, days, vals in notify_wait:
            md.append(f'- **{label(gid)}**（{days}日）')
            for n, v in zip((1, 2, 3), vals):
                md.append(f'  - {SRC_LABEL[n]}: ' + (names_of(v, P) if v else '（読めない・載っていない）'))
        md.append('')
    if new_fail:
        md.append('## ⚠ 読み取れなかった情報があります（ページの作りが変わった可能性）\n')
        for n in new_fail:
            md.append(f'- {SRC_LABEL[n]}: {fail[n]}')
        md.append('')
    bad_lines = [f'- {SRC_LABEL[n]} の {label(g)}: {"・".join(b)}' for n in bads for g, b in bads[n].items()]
    if bad_lines and (changed or notify_wait or new_fail):
        md.append('### ゲームデータに当てはまらなかった名前\n')
        md += bad_lines + ['']

    print('\n'.join(md) if md else 'ロケット団の手持ち: 変化なし')
    if waiting:
        print('そろうのを待っている人: ' + '、'.join(f'{label(g)}({d}日)' for g, d, _ in waiting))
    for n, e in fail.items():
        print(f'読み取り失敗 {SRC_LABEL[n]}: {e}')
    for line in bad_lines:
        print('当てはまらない名前 ' + line)

    if dry:
        return
    if changed:
        d = now_jst()
        write_js(f'{d.year}年{d.month}月{d.day}日', new, P)
    state = {'pending': pend, 'fail': fails}
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    with open(STATE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=1, sort_keys=True)
    if md:
        open(OUT_MD, 'w', encoding='utf-8').write('\n'.join(md))
    elif os.path.exists(OUT_MD):
        open(OUT_MD, 'w', encoding='utf-8').write('')
    # お知らせの件名に使う1行
    head = []
    if changed:
        head.append(f'更新{len(changed)}人')
    if notify_wait:
        head.append(f'要確認{len(notify_wait)}件')
    if new_fail:
        head.append(f'読み取り失敗{len(new_fail)}件')
    print('HEADLINE: ' + '・'.join(head))


if __name__ == '__main__':
    main()
