# SCPランキングのアイコン(2026-11-11):
# 濃い紺〜藍の地(斜めのグラデーション＋青と金のほのかな光＋四隅を落とす)に、攻撃・防御・HPの3本の棒
# (赤・青・緑)と、その上を横切る金の点線＝CP上限。攻撃が低く防御・HPが上限まで伸びる
# ＝「CPの上限に収まる中でSCPが最大の個体」のイメージ
from PIL import Image, ImageDraw, ImageFilter
import os
S=512; SS=4; W=S*SS
def lerp(a,b,t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))
bg=Image.new('RGB',(W,W)); px=bg.load(); c0=(30,46,104); c1=(10,12,34)
for y in range(0,W,2):
    for x in range(0,W,2):
        col=lerp(c0,c1,(x+y)/(2*W)); px[x,y]=col; px[x+1,y]=col; px[x,y+1]=col; px[x+1,y+1]=col
glow=Image.new('RGB',(W,W),(0,0,0)); gd=ImageDraw.Draw(glow)
gd.ellipse([-W*0.35,-W*0.45,W*0.75,W*0.55],fill=(70,120,230)); gd.ellipse([W*0.5,W*0.55,W*1.35,W*1.4],fill=(200,150,40))
glow=glow.filter(ImageFilter.GaussianBlur(W*0.18))
bg=Image.blend(bg,glow,0.28)
out=bg.convert('RGBA')
# 3本の棒
base_y=W*0.80; capy=W*0.25; bw=W*0.17; gap=W*0.065
x0=(W-(bw*3+gap*2))/2
bars=[((255,120,110),(196,52,60),0.52),((130,180,255),(46,98,214),0.985),((130,232,160),(36,150,92),0.965)]
for i,(ct,cb,hr) in enumerate(bars):
    L=x0+i*(bw+gap); top=base_y-(base_y-capy)*hr
    # 落ち影
    sh=Image.new('RGBA',(W,W),(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle([L,top+W*0.02,L+bw,base_y+W*0.02],radius=int(bw*0.28),fill=(0,0,0,140))
    out=Image.alpha_composite(out,sh.filter(ImageFilter.GaussianBlur(W*0.018)))
    g=Image.new('RGBA',(W,W)); gp=ImageDraw.Draw(g)
    for y in range(int(top),int(base_y)+1):
        gp.line([(L,y),(L+bw,y)],fill=lerp(ct,cb,(y-top)/max(1,base_y-top))+(255,))
    m=Image.new('L',(W,W),0); ImageDraw.Draw(m).rounded_rectangle([L,top,L+bw,base_y],radius=int(bw*0.28),fill=255)
    out=Image.alpha_composite(out,Image.composite(g,Image.new('RGBA',(W,W),(0,0,0,0)),m))
    # 左の光沢
    hl=Image.new('RGBA',(W,W),(0,0,0,0)); ImageDraw.Draw(hl).rounded_rectangle([L+bw*0.14,top+bw*0.18,L+bw*0.34,base_y-bw*0.22],radius=int(bw*0.1),fill=(255,255,255,70))
    out=Image.alpha_composite(out,hl.filter(ImageFilter.GaussianBlur(W*0.004)))
# 金の点線＝CP上限
ln=Image.new('RGBA',(W,W),(0,0,0,0)); ld=ImageDraw.Draw(ln)
xa,xb=W*0.11,W*0.89; seg=W*0.06; sp=W*0.035; x=xa; th=W*0.022
while x<xb:
    ld.rounded_rectangle([x,capy-th/2,min(x+seg,xb),capy+th/2],radius=int(th/2),fill=(255,214,92,255)); x+=seg+sp
gl=ln.filter(ImageFilter.GaussianBlur(W*0.01))
out=Image.alpha_composite(out,Image.blend(Image.new('RGBA',(W,W),(0,0,0,0)),gl,0.6))
out=Image.alpha_composite(out,ln)
# 床の線
fl=Image.new('RGBA',(W,W),(0,0,0,0)); ImageDraw.Draw(fl).rounded_rectangle([W*0.12,base_y+W*0.015,W*0.88,base_y+W*0.03],radius=int(W*0.008),fill=(200,214,255,110))
out=Image.alpha_composite(out,fl)
# 四隅を落とす(他のアイコンと同じ半径102px)
rm=Image.new('L',(W,W),0); ImageDraw.Draw(rm).rounded_rectangle([0,0,W-1,W-1],radius=int(102*SS),fill=255)
out.putalpha(rm); out=out.resize((S,S),Image.LANCZOS)
base=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','assets','icons','scp')+'/'
os.makedirs(base,exist_ok=True)
out.save(base+'icon-512.png'); out.resize((192,192),Image.LANCZOS).save(base+'icon-192.png')
out.resize((180,180),Image.LANCZOS).save(base+'apple-touch-icon.png'); out.resize((32,32),Image.LANCZOS).save(base+'favicon-32.png')
print('ok')
