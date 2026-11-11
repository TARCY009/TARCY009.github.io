# ボックス割引率チェッカーのアイコン(2026-11-12): scratchpad/icon_box.html を画面なしブラウザで撮った 512px を、
# 四隅を落として(他のアイコンと同じ半径102px) 4サイズに書き出す。
# 使い方: python3 scratchpad/icon_box.py 撮った画像.png
import sys, os
from PIL import Image, ImageDraw
S = 512
im = Image.open(sys.argv[1]).convert('RGBA').resize((S, S), Image.LANCZOS)
m = Image.new('L', (S * 4, S * 4), 0)
ImageDraw.Draw(m).rounded_rectangle([0, 0, S * 4 - 1, S * 4 - 1], radius=102 * 4, fill=255)
im.putalpha(m.resize((S, S), Image.LANCZOS))
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'icons', 'box') + '/'
os.makedirs(base, exist_ok=True)
im.save(base + 'icon-512.png')
im.resize((192, 192), Image.LANCZOS).save(base + 'icon-192.png')
im.resize((180, 180), Image.LANCZOS).save(base + 'apple-touch-icon.png')
im.resize((32, 32), Image.LANCZOS).save(base + 'favicon-32.png')
print('ok')
