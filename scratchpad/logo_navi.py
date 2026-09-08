# GOナビのアイコン: 元の画素の「GO＋針」を切り出して上へずらし、下に「ナビ」を足す
import sys
from PIL import Image, ImageFilter, ImageDraw, ImageFont, ImageChops
import os
# ⚠ 取り出し元は「ナビ」を足す前のアイコン(コミット a3e662e)。いまのファイルを読むと「ナビ」が二重になる
SRC=os.environ.get('LOGO_SRC') or '/Users/t.t/Desktop/TARCY009.github.io/assets/icons/home/icon-512.png'
SP='/private/tmp/claude-501/-Users-t-t-Desktop-TARCY009-github-io/b9e4d1c5-3c2b-46bc-932d-bc6ad5914309/scratchpad'
GAP=int(sys.argv[1]) if len(sys.argv)>1 else 18      # GOとナビの間
NH=int(sys.argv[2]) if len(sys.argv)>2 else 88       # ナビの字の高さ
GOSCALE=float(sys.argv[5]) if len(sys.argv)>5 else 1.0   # GOの大きさ(2026-09-08: 僅かに小さく)
YOFF=int(sys.argv[6]) if len(sys.argv)>6 else 0            # GO＋ナビ全体を下へずらす量(px)
FILL=(166,210,255); OUT=(28,43,94); FONTP='/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc'; FONTI=int(sys.argv[4]) if len(sys.argv)>4 else 0; OUTW=int(sys.argv[3]) if len(sys.argv)>3 else 7

im=Image.open(SRC).convert('RGBA'); W,H=im.size
rgb=im.convert('RGB'); A=im.split()[3]
# 1) 文字＋光の範囲(マスク): 明るい画素を広げる
lum=rgb.convert('L')
white=lum.point(lambda v:255 if v>175 else 0)
region=white.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(22)).point(lambda v:255 if v>2 else 0)
region=region.filter(ImageFilter.MaxFilter(15))
# 2) 背景の復元: マスクの中を周囲から拡散で埋める(調和補間)
# 正規化畳み込み: 既知の画素だけを重み付きでぼかして、未知の画素をその平均で埋める(半径を段階的に広げる)
known=ImageChops.invert(region)           # 255=背景が分かっている画素
bg=rgb.copy(); bgp=bg.load(); kp=known.load()
for r in (6,12,24,48,96,160):
    col=ImageChops.multiply(bg,Image.merge('RGB',(known,known,known))).filter(ImageFilter.GaussianBlur(r))
    wt=known.filter(ImageFilter.GaussianBlur(r))
    cp=col.load(); wp=wt.load(); nk=known.copy(); nkp=nk.load()
    for y in range(H):
        for x in range(W):
            if kp[x,y]: continue
            w=wp[x,y]
            if w>=12:
                bgp[x,y]=tuple(min(255,int(cp[x,y][k]*255/w)) for k in range(3)); nkp[x,y]=255
    known=nk; kp=known.load()
# 仕上げに中だけなめらかに(境界の色は固定したまま拡散)
inv=ImageChops.invert(region)
for i in range(120):
    bl=bg.filter(ImageFilter.GaussianBlur(4))
    bg=Image.composite(bg,bl,inv)
# 3) 前景: 元と背景の差からアルファを作る。Oの穴など「囲まれた部分」は不透明で丸ごと持つ
diff=ImageChops.difference(rgb,bg).convert('L')
alpha=diff.point(lambda v:min(255,int(v*255/200)))
# 白い画素は完全不透明
alpha=ImageChops.lighter(alpha,white)
# 囲まれた部分(Oの穴): 外側から流し込んで届かない所
solid=white.filter(ImageFilter.MaxFilter(3))
fl=solid.copy(); ImageDraw.floodfill(fl,(0,0),128)   # 外側=128
enclosed=fl.point(lambda v:255 if v==0 else 0)      # 0のまま=囲まれた黒
alpha=ImageChops.lighter(alpha,enclosed)
alpha=Image.composite(alpha,Image.new('L',(W,H),0),A)  # 角丸の外は0
# 前景の色: 半透明の縁は背景を外して元の色へ戻す
fg=Image.new('RGBA',(W,H))
px=rgb.load(); pb=bg.load(); pa=alpha.load(); pf=fg.load()
for y in range(H):
    for x in range(W):
        a=pa[x,y]
        if a==0: continue
        if a>=250: pf[x,y]=px[x,y]+(255,); continue
        t=a/255; c=[]
        for k in range(3):
            v=(px[x,y][k]-pb[x,y][k]*(1-t))/t; c.append(max(0,min(255,int(round(v)))))
        pf[x,y]=(c[0],c[1],c[2],a)
# 文字の縦の範囲
ys=[y for y in range(H) if any(white.getpixel((x,y)) for x in range(0,W,2))]
top,bot=min(ys),max(ys); GH=bot-top+1
# 3.5) GOを僅かに小さくする(字形はそのまま縮小・中心は変えない)
if GOSCALE!=1.0:
    cx=W/2; cy=(top+bot)/2
    nw=int(round(W*GOSCALE)); nh=int(round(H*GOSCALE))
    small=fg.resize((nw,nh),Image.LANCZOS)
    fg2=Image.new('RGBA',(W,H)); fg2.alpha_composite(small,(int(round(cx-cx*GOSCALE)),int(round(cy-cy*GOSCALE))))
    fg=fg2
    top=int(round(cy-(cy-top)*GOSCALE)); bot=int(round(cy+(bot-cy)*GOSCALE)); GH=bot-top+1
# 4) 配置: GO + GAP + ナビ を縦中央へ(＋YOFFだけ下へ)
total=GH+GAP+NH; newtop=(H-total)//2+YOFF; dy=newtop-top
out=Image.new('RGBA',(W,H)); out.paste(bg.convert('RGBA'))
out.alpha_composite(fg,(0,dy) if dy>=0 else (0,0), (0,0) if dy>=0 else (0,-dy))
out.putalpha(A)
# 5) ナビ(丸ゴシック900・薄い水色＋紺の太い輪郭)
font=ImageFont.truetype(FONTP,200,index=FONTI)
bb=font.getbbox('ナビ'); gh=bb[3]-bb[1]; size=int(200*NH/gh)
font=ImageFont.truetype(FONTP,size,index=FONTI); bb=font.getbbox('ナビ')
tw=bb[2]-bb[0]; th=bb[3]-bb[1]
txt=Image.new('RGBA',(W,H)); d=ImageDraw.Draw(txt)
tx=(W-tw)//2-bb[0]; ty=newtop+GH+GAP-bb[1]
d.text((tx,ty),'ナビ',font=font,fill=FILL,stroke_width=OUTW,stroke_fill=OUT)
# 淡い影
sh=Image.new('RGBA',(W,H)); ImageDraw.Draw(sh).text((tx,ty+4),'ナビ',font=font,fill=(0,0,0,150),stroke_width=OUTW,stroke_fill=(0,0,0,150))
sh=sh.filter(ImageFilter.GaussianBlur(5))
out.alpha_composite(sh); out.alpha_composite(txt); out.putalpha(A)
out.save(f'{SP}/navi-512.png'); bg.save(f'{SP}/navi-bg.png'); fg.save(f'{SP}/navi-fg.png')
print('GO',top,bot,'dy',dy,'navi size',size,'w',tw,'h',th,'text top',newtop+GH+GAP)
