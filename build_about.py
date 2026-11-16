#!/usr/bin/env python3
"""運営者情報（about/index.html）の YouTube チャンネル登録者数を読み取って書き直す（2026-11-16タダシさん指示）。

毎週月曜の自動更新（.github/workflows/update-meta.yml）から呼ばれる。
チャンネルのページの「チャンネル登録者数 24.1万人」を読み、
<!-- yt-subs:start -->〜<!-- yt-subs:end --> の中を「約24.1万人（2026年11月時点）」に書き換える。
数字も月も変わっていなければ書き換えない（コミットを増やさない）。
読み取れなかったときは前の値のまま残し、警告だけ出す（自動更新は止めない）。
"""
import datetime, os, re, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, 'about', 'index.html')
CHANNEL = 'https://www.youtube.com/@TarcySaopica?hl=ja&gl=JP'
MARK = re.compile(r'(<!-- yt-subs:start -->)(.*?)(<!-- yt-subs:end -->)', re.S)


def fetch():
    req = urllib.request.Request(CHANNEL, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', 'replace')


def parse(html):
    m = re.search(r'チャンネル登録者数\s*([0-9][0-9.,]*\s*(?:万|億)?人)', html)
    return re.sub(r'\s', '', m.group(1)) if m else None


def main():
    s = open(PAGE, encoding='utf-8').read()
    if not MARK.search(s):
        sys.exit('about/index.html に yt-subs の印がありません')
    try:
        subs = parse(fetch())
    except Exception as e:
        subs = None
        print(f'⚠ チャンネルのページを読めませんでした: {e}')
    if not subs:
        print('⚠ 登録者数を読み取れなかったので、前の値のまま残します')
        return
    today = datetime.datetime.utcnow() + datetime.timedelta(hours=9)
    text = f'約{subs}（{today.year}年{today.month}月時点）'
    out = MARK.sub(lambda m: m.group(1) + text + m.group(3), s, count=1)
    if out != s:
        open(PAGE, 'w', encoding='utf-8').write(out)
        print(f'登録者数を書き換えました: {text}')
    else:
        print(f'変化なし: {text}')


if __name__ == '__main__':
    main()
