# アイコンの仕上げ（2026-11-12）: 画面なしブラウザで撮った 512px の絵の四隅を落として（ほかのアイコンと同じ半径102px）、
# assets/icons/<フォルダ>/ に4サイズ（512・192・180・32）を書き出す。
# 使い方: python3 scratchpad/icon_round.py 撮った画像.png フォルダ名
import sys, os
from PIL import Image, ImageDraw
S = 512
im = Image.open(sys.argv[1]).convert('RGBA').resize((S, S), Image.LANCZOS)
m = Image.new('L', (S * 4, S * 4), 0)
ImageDraw.Draw(m).rounded_rectangle([0, 0, S * 4 - 1, S * 4 - 1], radius=102 * 4, fill=255)
im.putalpha(m.resize((S, S), Image.LANCZOS))
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'icons', sys.argv[2]) + '/'
os.makedirs(base, exist_ok=True)
im.save(base + 'icon-512.png')
im.resize((192, 192), Image.LANCZOS).save(base + 'icon-192.png')
im.resize((180, 180), Image.LANCZOS).save(base + 'apple-touch-icon.png')
im.resize((32, 32), Image.LANCZOS).save(base + 'favicon-32.png')
print('ok', base)
