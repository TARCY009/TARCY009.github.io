#!/usr/bin/env python3
"""assets/wordmark.css（全ツールのタイトル文字）を作り直す。

ツール名を変えたり、ツールを増やしたら **必ずこれを流す**。
手で `text=` を書くと取り寄せる文字が漏れ、その字だけ端末の書体に化ける
（2026-09-03に「テ」「ド」「図」「鑑」で実際に起きた）。

    python3 build_wordmark.py
"""
import urllib.parse

WEIGHT = 900          # 書体の太さ（Noto Sans JP）

# (data-tool のキー, ライトの文字色, タイトルの文字)
#   色 = そのツールのアイコンの地の色から起こしたもの。
#   彩度は落とし気味、濃さは背景とのコントラスト4.5:1以上を満たす範囲でいちばん明るいところ。
#   レイド火力・ジム挑戦・GBL対戦記録の3つだけ彩度が一段上（2026-09-03タダシさん選択）。
TOOLS = [
    ('dps',         '#ab4f3b', 'レイド火力チェッカー'),
    ('raid',        '#2b736f', 'レイドシミュレータ'),
    ('type-dps',    '#6863ac', 'タイプ別火力ランキング'),
    ('max-battle',  '#ab4982', 'マックスバトル対策ツール'),
    ('gym-attack',  '#91681d', 'ジム挑戦オススメツール'),
    ('gym-defense', '#397a58', 'ジム防衛オススメツール'),
    ('gbl',         '#4e67b1', '対面シミュレーター'),
    ('battlelog',   '#836625', '対戦記録'),
    ('rocket',      '#b14949', '対策シミュレーター'),
    ('breakpoint',  '#5868ac', 'GBLブレイクポイント'),
    ('iv-checker',  '#a44b76', '個体値チェッカー'),
    ('pokedex',     '#7e60a4', 'ステータス図鑑'),
]
SITE_NAME = 'GOナビ'   # トップページの看板（禅角ゴシック New 900）

def build() -> str:
    chars = ''.join(sorted(set(''.join(t[2] for t in TOOLS))))
    noto = ('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@%d&display=swap&text=%s'
            % (WEIGHT, urllib.parse.quote(chars)))
    zen = ('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@900&display=swap&text=%s'
           % urllib.parse.quote(SITE_NAME))
    colors = '\n'.join(f':root.light .wmk[data-tool="{k}"]{{--wmk-c:{c}}}' for k, c, _ in TOOLS)
    return f'''@import url("{zen}");
@import url("{noto}");

/* =========================================================================
   ツール名の見た目（全ツール共通）
   ⚠ このファイルは build_wordmark.py の出力。手で編集しない（色とツール名は向こうを直す）。

   ページ側がやることは2つ:
     1. <head> に <link rel="stylesheet" href="/assets/wordmark.css">（explain.css の直後）
     2. ツール名の要素に class="wmk" と data-tool="<ツールのキー>" を付ける
        （GBL・ロケット団・対戦記録の見出しは assets/gbl-app.js が作る）

   ■ ダーク: トップページの看板と同じ銀（2026-09-03確定・折れ目なしの小さい字用レシピ）。
     2026-09-04に「白文字より暗い」「もっと目立たせたい」で何度か色を変えたが、
     どれも「変わった実感がない」となり、**タダシさん指示でこの最初の色に戻した**。
     ⚠ 次にこの色を触るときは、変更前に必ずタダシさんに意図を確認してから進めること

   ■ ライト: **金属加工はしない。ツールごとのベタ塗り**。
     ⚠ いちばん大事な学び: 以前はライトでもグラデの下端を暗い紫黒と混ぜ、押し出しと落ち影を敷いていた。
       22pxの細い字ではその暗い部分が線の大半を占め、**明るさが24〜41まで落ちて
       12ツールすべてが「黒っぽい同じ色」に見えた**（画素を測って確認済み）。
     色は**そのツールのアイコンの地の色**から起こす（ライトの背景はどのツールも紫＋水色でほぼ同じなので、
     背景から取ると色が分かれない）。

   ■ 書体: Noto Sans JP {WEIGHT}。取り寄せる文字はツール名から自動生成（漏れると字体が化ける）。
   ========================================================================= */
:root{{
  --wmk-g:linear-gradient(180deg,#ffffff 0%,#eaf1ff 34%,#bccde9 66%,#93a8cf 100%);
  --wmk-e:#2b3a5e;                 /* 押し出し（板の厚み・1段） */
  --wmk-sh:rgba(6,12,30,.55);      /* 落ち影 */
}}
.wmk{{
  font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Hiragino Sans",system-ui,sans-serif;
  font-weight:{WEIGHT};
  background-image:var(--wmk-g);
  -webkit-background-clip:text;background-clip:text;
  color:transparent;
  text-shadow:0 1px 0 var(--wmk-e), 0 2px 5px var(--wmk-sh);
}}
/* ライトは色だけ。塗りも影も持たせない */
:root.light .wmk{{
  background-image:none;
  color:var(--wmk-c,#3a4a86);
  text-shadow:none;
}}
{colors}
/* 添え書き（small）とバッジは本文なので、書体も色も影も元へ戻す */
.wmk small,.wmk .badge{{
  font-family:"Hiragino Kaku Gothic ProN","Hiragino Sans",system-ui,sans-serif;
  font-weight:700;
  -webkit-text-fill-color:currentColor;
  text-shadow:none;
}}
'''

if __name__ == '__main__':
    css = build()
    open('assets/wordmark.css', 'w', encoding='utf-8').write(css)
    n = len(set(''.join(t[2] for t in TOOLS)))
    print(f'assets/wordmark.css を作りました（ツール {len(TOOLS)} / 取り寄せる文字 {n} 字）')
