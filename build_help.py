"""GBL・ロケット団・対戦記録の「使い方」の文章を、各ページ本体に書き写す。

元の文章は assets/gbl-app.js の HELP_HTML の1か所だけ(二重管理しない)。
画面を全部プログラムで組み立てるページなので、そのままだと読み込んだ時点の本文が0文字になり、
検索エンジンや広告の審査が中身を読めない。ここで同じ文章をページ本体
(<!-- help:start -->〜<!-- help:end --> の #helpsrc)へ写し、gbl-app.js が読み込み時に
使い方の箱(#helpbody)へ移す。画面の見た目は変わらない。

HELP_HTML を直したら `python3 build_help.py` を流す(毎朝の自動更新でも流れる)。
"""
import re

SRC = 'assets/gbl-app.js'
PAGES = [('gbl/index.html', False), ('rocket/index.html', True), ('battlelog/index.html', False)]
START = '<!-- help:start (build_help.py が作る・手で編集しない) -->'
END = '<!-- help:end -->'

js = open(SRC, encoding='utf-8').read()
m = re.search(r"const HELP_HTML = `(.*?)\n  </ul>`;", js, re.S)
assert m, 'HELP_HTML が見つからない'
raw = m.group(1) + '\n  </ul>'
swap = re.search(r"const SWAPMK = '([^']*)';", js).group(1)

# ロケット団ページでは省く節: ${PAGE_ROCKET ? '' : `…`}
COND_A, COND_B = "${PAGE_ROCKET ? '' : `", "`}"


def render(rocket):
    t = raw
    i = t.find(COND_A)
    if i >= 0:
        j = t.find(COND_B, i + len(COND_A))
        assert j > 0
        inner = t[i + len(COND_A):j]
        t = t[:i] + ('' if rocket else inner) + t[j + len(COND_B):]
    t = t.replace('${SWAPMK}', swap)
    assert '${' not in t and '`' not in t, '未対応の差し込みがある'
    return t.strip()


for path, rocket in PAGES:
    html = open(path, encoding='utf-8').read()
    block = f'{START}\n<div id="helpsrc" hidden>\n{render(rocket)}\n</div>\n{END}'
    if START in html:
        new = re.sub(re.escape(START) + r'.*?' + re.escape(END), lambda _: block, html, flags=re.S)
    else:
        assert html.count('<div id="app"></div>') == 1, path
        new = html.replace('<div id="app"></div>', '<div id="app"></div>\n' + block)
    if new != html:
        open(path, 'w', encoding='utf-8').write(new)
        print('更新', path)
    else:
        print('変化なし', path)
