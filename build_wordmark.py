#!/usr/bin/env python3
"""assets/wordmark.css（全ツールのタイトル文字）を作り直す。

ツール名を変えたり、ツールを増やしたら **必ずこれを流す**。
手で `text=` を書くと取り寄せる文字が漏れ、その字だけ端末の書体に化ける
（2026-09-03に「テ」「ド」「図」「鑑」で実際に起きた）。

    python3 build_wordmark.py
"""
import urllib.parse

WEIGHT = 900          # 書体の太さ（Noto Sans JP）

# (data-tool のキー, ライトの文字色, ダークの文字色, タイトルの文字)
#   ライトの色 = そのツールのアイコンの地の色から起こしたもの（2026-09-03確定・変更なし）。
#   ダークの色 = 2026-09-04タダシさん指示で「真っ白＋ツールごとの明るい色を半分ずつ」に方針転換。
#     金属加工・グラデーションは一切なし。ライトと同じ色相を、暗い背景で映える彩度・明るさまで上げたもの。
TOOLS = [
    ('dps',         '#ab4f3b', '#ff7a5c', 'レイド火力チェッカー'),
    ('raid',        '#2b736f', '#3fe0c4', 'レイドシミュレータ'),
    ('type-dps',    '#6863ac', '#a68bff', 'タイプ別火力ランキング'),
    ('max-battle',  '#ab4982', '#ff74c4', 'マックスバトル対策ツール'),
    ('gym-attack',  '#91681d', '#ffcc33', 'ジム挑戦オススメツール'),
    ('gym-defense', '#397a58', '#7ee787', 'ジム防衛オススメツール'),
    ('gbl',         '#4e67b1', '#6ea1ff', '対面シミュレーター'),
    ('battlelog',   '#836625', '#f0b942', '対戦記録'),
    ('rocket',      '#b14949', '#ff6b6b', '対策シミュレーター'),
    ('breakpoint',  '#5868ac', '#8ca3ff', 'GBLブレイクポイント'),
    ('iv-checker',  '#a44b76', '#ff7ec2', '個体値チェッカー'),
    ('pokedex',     '#7e60a4', '#bd93ff', 'ステータス図鑑'),
]
# 「◯◯オススメツール／◯◯対策ツール」のように、ツール名の後ろに付く決まり文句は
# タイトル色ではなく白のまま残す（2026-09-04タダシさん指示・例:「ジム防衛」だけ色・「オススメツール」は白）。
SUFFIXES = ['オススメツール', '対策ツール']
SITE_NAME = 'GOナビ'   # トップページの看板（禅角ゴシック New 900・別ファイル扱い）

def split_title(name: str):
    """タイトルを (色を付ける部分, 白のまま残す決まり文句) に分ける。無ければ (name, '')"""
    for suf in SUFFIXES:
        if name.endswith(suf):
            return name[:-len(suf)], suf
    return name, ''

def build() -> str:
    chars = ''.join(sorted(set(''.join(t[3] for t in TOOLS))))
    noto = ('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@%d&display=swap&text=%s'
            % (WEIGHT, urllib.parse.quote(chars)))
    zen = ('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@900&display=swap&text=%s'
           % urllib.parse.quote(SITE_NAME))
    light_colors = '\n'.join(f':root.light .wmk[data-tool="{k}"]{{--wmk-c:{lc}}}' for k, lc, _, _ in TOOLS)
    dark_colors = '\n'.join(f'.wmk[data-tool="{k}"]{{--wmk-d:{dc}}}' for k, _, dc, _ in TOOLS)
    return f'''@import url("{zen}");
@import url("{noto}");

/* =========================================================================
   ツール名の見た目（全ツール共通）
   ⚠ このファイルは build_wordmark.py の出力。手で編集しない（色とツール名は向こうを直す）。

   ページ側がやることは2つ:
     1. <head> に <link rel="stylesheet" href="/assets/wordmark.css">（explain.css の直後）
     2. ツール名の要素に class="wmk" と data-tool="<ツールのキー>" を付ける
        （GBL・ロケット団・対戦記録の見出しは assets/gbl-app.js が作る）
     3. 「◯◯オススメツール」のように決まり文句が付くタイトルは、その部分だけ
        class="wmksuf" の別要素に分けて白のまま残す（build_wordmark.pyのSUFFIXES参照）

   ■ ダーク: **真っ白＋ツールごとの明るい色**（2026-09-04タダシさん指示で確定・金属加工なし）。
     ⚠ この前に銀のグラデーション（トップページの看板と同じ質感）を小さい字に何度も調整して
       当てていたが、タダシさんには「変わった実感がない」状態が続き、最終的に
       **「機能を含めて、この一連の色変更より前の状態に戻して」**と指示された。
       ここまでの経緯が長く複雑だったため、後戻りのリスクを避けて**ゼロから作り直す**方針にした。
       グラデーション・押し出し・落ち影は一切使わない。色はライトと同じ色相を、
       暗い背景で映える彩度・明るさまで単純に引き上げただけの1色（ベタ塗り）。

   ■ ライト: **金属加工はしない。ツールごとのベタ塗り**（2026-09-03確定・変更なし）。
     色は**そのツールのアイコンの地の色**から起こす（ライトの背景はどのツールも紫＋水色でほぼ同じなので、
     背景から取ると色が分かれない）。

   ■ 書体: Noto Sans JP {WEIGHT}。取り寄せる文字はツール名から自動生成（漏れると字体が化ける）。
   ========================================================================= */
.wmk{{
  font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Hiragino Sans",system-ui,sans-serif;
  font-weight:{WEIGHT};
  color:var(--wmk-d,#ffffff);
}}
{dark_colors}
/* ライトはツールごとのベタ塗り（変更なし） */
:root.light .wmk{{
  color:var(--wmk-c,#3a4a86);
}}
{light_colors}
/* 「オススメツール」等の決まり文句は常に白（ダーク）／--inkに準じる地色（ライト）のまま */
.wmksuf{{
  font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Hiragino Sans",system-ui,sans-serif;
  font-weight:{WEIGHT};
  color:#ffffff;
}}
:root.light .wmksuf{{color:inherit}}
/* 添え書き（small）とバッジは本文なので、書体も色も元へ戻す */
.wmk small,.wmk .badge{{
  font-family:"Hiragino Kaku Gothic ProN","Hiragino Sans",system-ui,sans-serif;
  font-weight:700;
  color:inherit;
}}
'''

if __name__ == '__main__':
    css = build()
    open('assets/wordmark.css', 'w', encoding='utf-8').write(css)
    n = len(set(''.join(t[3] for t in TOOLS)))
    print(f'assets/wordmark.css を作りました（ツール {len(TOOLS)} / 取り寄せる文字 {n} 字）')
    print('タイトルの分割（色を付ける部分 / 白のまま残す部分）:')
    for k, _, _, name in TOOLS:
        head, suf = split_title(name)
        print(f'  {k}: 「{head}」 + 「{suf}」' if suf else f'  {k}: 「{head}」(分割なし)')
