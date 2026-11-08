# -*- coding: utf-8 -*-
"""
お知らせ（メール）の本文を短い要約にする（2026-11-08タダシさん指示「1通にまとめ・なるべく少なく・わかりやすく」）

使い方: python3 .github/notify.py <種類> <元のmd> [<元のmd> ...]
  種類 = data（ゲームデータ）／meta（環境リスト）／rocket（ロケット団の手持ち）
  出力 = notify_body.md（送るもの）。送るものが無ければ作らず、標準出力に「送らない」と出す

決まり:
  - 送るのは見出し（###）と箇条書き（-）だけ。説明の文は落とす
  - 1つの見出しの箇条書きは5件まで（残りは「ほか◯件」）・1行は70字まで
  - 毎回同じ中身になりがちな節（確定わざ構成の見直し候補・内訳・食い違いなど）は、前回と中身が変わったときだけ1行で出す
    （前回の中身は .github/notify_state.json に控える）
  - 何も残らなければ送らない（内部データの調整のみの日など）
送り先は workflow 側で、1つの「📢 GOナビのお知らせ」にコメントとして足す（＝1回の更新でメール1通）
"""
import hashlib, json, os, re, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE = os.path.join(ROOT, '.github', 'notify_state.json')
OUT = os.path.join(ROOT, 'notify_body.md')
LABEL = {'data': 'ゲームデータ', 'meta': '環境リスト（GBL）', 'rocket': 'ロケット団の手持ち'}
MAX_ITEMS = 5
MAX_LEN = 70
# 毎回ほぼ同じになる節: 変わったときだけ「見出し（件数）」の1行にする
REPEAT = ('確定わざ構成の見直し候補', '内訳', '食い違', '人の確認がまだ')
# 送らなくてよい節
DROP = ('データ更新の内容', '環境リストの更新結果')


def clean(t):
    t = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', t)      # リンクは文字だけ
    t = t.replace('**', '').replace('`', '')
    t = re.sub(r'（[A-Za-z0-9_]+）', '', t)                 # 中の番号（chandelure_mega など）
    t = re.sub(r'（[^（）]{13,}）', '', t)                  # 長い補足のかっこ
    t = re.sub(r'（\s*）', '', t).strip()
    return t if len(t) <= MAX_LEN else t[:MAX_LEN - 1] + '…'


def sections(md):
    """[(見出し, [箇条書き])]。## と ### の両方を見出しとして扱う（## の親見出しは子の頭に付ける）"""
    out, parent, cur = [], '', None
    for line in md.splitlines():
        m = re.match(r'^(#{1,3})\s+(.*)$', line)
        if m:
            lv, title = len(m.group(1)), clean(m.group(2))
            if lv <= 2:
                parent = '' if any(d in title for d in DROP) else title
                cur = [parent, []]; out.append(cur)
            else:
                cur = [(parent + '｜' if parent else '') + title, []]; out.append(cur)
            continue
        m = re.match(r'^\s*-\s+(.*)$', line)
        if m and cur is not None:
            cur[1].append(clean(m.group(1)))
        elif m:
            cur = ['', [clean(m.group(1))]]; out.append(cur)
    return [s for s in out if s[1]]


def main():
    kind, files = sys.argv[1], sys.argv[2:]
    md = '\n'.join(open(f, encoding='utf-8').read() for f in files if os.path.exists(f))
    try: state = json.load(open(STATE, encoding='utf-8'))
    except Exception: state = {}
    body, last_parent = [], None
    for title, items in sections(md):
        rep = next((r for r in REPEAT if r in title), None)
        if rep:
            key = f'{kind}:{rep}'
            h = hashlib.sha1('\n'.join(items).encode()).hexdigest()[:12]
            if state.get(key) == h: continue
            state[key] = h
            body.append(f'- {title.split("｜")[-1]}：前回から変わりました（{len(items)}件）')
            continue
        shown = items[:MAX_ITEMS] + ([f'ほか{len(items) - MAX_ITEMS}件'] if len(items) > MAX_ITEMS else [])
        if '｜' in title:                                   # 親見出しの下の節（環境リストのリーグごと）は1行に詰める
            parent, sub = title.split('｜', 1)
            if parent != last_parent:
                body.append(f'**{parent}**'); last_parent = parent
            sub = re.sub(r'（\d+件）', '', sub).strip()
            body.append(f'- {sub}: ' + '、'.join(shown))
            continue
        last_parent = None
        if all(len(x) <= 16 for x in shown):                # 短い名前だけなら見出しと同じ行に
            body.append(f'**{title}** ' + '、'.join(shown))
        else:
            body.append(f'**{title}**')
            body += [f'- {x}' for x in shown]
    json.dump(state, open(STATE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
    body = [b for b in body if b != '']
    if not body:
        print('送らない（要約すると中身が残らない）')
        if os.path.exists(OUT): os.remove(OUT)
        return
    day = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime('%-m/%-d')
    text = f'### 📢 {day} {LABEL.get(kind, kind)}\n\n' + '\n'.join(body) + '\n'
    open(OUT, 'w', encoding='utf-8').write(text)
    print(text)


if __name__ == '__main__':
    main()
