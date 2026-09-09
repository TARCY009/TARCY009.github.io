# 耐久指数ランキングのアイコン(2026-09-09タダシさん指示「盾と王冠でオシャレに」):
# 濃い青灰の地(斜めのグラデーション＋ほのかな光＋四隅を落とす)に、空色の縁取りの盾と、
# その上に載る金の王冠(宝石3つ・光沢・落ち影)。「倒されにくさの王者」のイメージ
from PIL import Image, ImageDraw, ImageFilter
S=512; SS=4; W=S*SS
def lerp(a,b,t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))
def vgrad(c_top,c_bot,y0,y1):
    g=Image.new('RGB',(W,W)); p=g.load()
    for y in range(W):
        t=min(1,max(0,(y-y0)/max(1,(y1-y0)))); col=lerp(c_top,c_bot,t)
        for x in range(W): p[x,y]=col
    return g.convert('RGBA')
def masked(img,polyfn):
    m=Image.new('L',(W,W),0); polyfn(ImageDraw.Draw(m)); return Image.composite(img,Image.new('RGBA',(W,W),(0,0,0,0)),m)
def shadow(polyfn,alpha,blur,dy):
    sh=Image.new('RGBA',(W,W),(0,0,0,0)); d=ImageDraw.Draw(sh); polyfn(d,alpha); 
    sh=sh.transform((W,W),Image.AFFINE,(1,0,0,0,1,-dy)); return sh.filter(ImageFilter.GaussianBlur(blur))
# ---- 地
bg=Image.new('RGB',(W,W)); px=bg.load(); c0=(26,54,84); c1=(9,15,30)
for y in range(W):
    for x in range(W): px[x,y]=lerp(c0,c1,(x+y)/(2*W))
glow=Image.new('RGB',(W,W),(0,0,0)); gd=ImageDraw.Draw(glow)
gd.ellipse([-W*0.35,-W*0.45,W*0.75,W*0.55],fill=(60,120,190)); gd.ellipse([W*0.45,W*0.55,W*1.35,W*1.4],fill=(30,110,100))
glow=glow.filter(ImageFilter.GaussianBlur(W*0.18))
bg=Image.blend(bg,Image.composite(glow,bg,Image.new('L',(W,W),int(255*0.55))),0.45)
out=bg.convert('RGBA')
# ---- 盾(2026-09-09タダシさんの見本: 上の縁が真ん中でとがり、両側がなめらかに湾曲して下の先端へ。
#      外枠と中身のあいだに隙間のある二重の輪郭)
def bez(p0,p1,p2,p3,n=40):
    return [(( (1-t)**3*p0[0]+3*(1-t)**2*t*p1[0]+3*(1-t)*t**2*p2[0]+t**3*p3[0]),
             ( (1-t)**3*p0[1]+3*(1-t)**2*t*p1[1]+3*(1-t)*t**2*p2[1]+t**3*p3[1])) for i in range(n+1) for t in [i/n]]
def shield(cx,cy,w,h,k=1.0):
    """cx,cy=中心・w,h=外形・k=中心に対する縮尺"""
    w,h=w*k,h*k; top=cy-h/2; L,R=cx-w/2,cx+w/2; dip=h*0.17; side=top+h*0.36
    # 上の縁は両側とも内側(下)へ湾曲させて真ん中の山へ(2026-09-09タダシさんの見本の拡大より)
    pts=bez((L,top+dip),(cx-w*0.24,top+dip*1.08),(cx-w*0.09,top+dip*0.50),(cx,top))
    pts+=bez((cx,top),(cx+w*0.09,top+dip*0.50),(cx+w*0.24,top+dip*1.08),(R,top+dip))[1:]
    pts+=[(R,side)]
    pts+=bez((R,side),(R,top+h*0.72),(cx+w*0.30,top+h*0.93),(cx,top+h))[1:]
    pts+=bez((cx,top+h),(cx-w*0.30,top+h*0.93),(L,top+h*0.72),(L,side))[1:]
    return pts
cx,cy=W/2,W*0.585; ow,oh=W*0.60,W*0.70
sky_top,sky_bot=(168,224,255),(40,124,205)
out=Image.alpha_composite(out,shadow(lambda d,a:d.polygon(shield(cx,cy,ow,oh),fill=(0,0,0,a)),150,W*0.035,-W*0.03))
# 外枠(輪)＝外形から少し小さい形をくり抜く
ring=Image.new('L',(W,W),0); rd=ImageDraw.Draw(ring)
rd.polygon(shield(cx,cy,ow,oh),fill=255); rd.polygon(shield(cx,cy,ow,oh,0.84),fill=0)
out=Image.alpha_composite(out,Image.composite(vgrad(sky_top,sky_bot,cy-oh/2,cy+oh/2),Image.new('RGBA',(W,W),(0,0,0,0)),ring))
# 外枠の内側の縁を少し暗くして厚みを見せる
rim2=Image.new('L',(W,W),0); r2=ImageDraw.Draw(rim2)
r2.polygon(shield(cx,cy,ow,oh,0.88),fill=255); r2.polygon(shield(cx,cy,ow,oh,0.84),fill=0)
out=Image.alpha_composite(out,Image.composite(Image.new('RGBA',(W,W),(20,70,130,110)),Image.new('RGBA',(W,W),(0,0,0,0)),rim2))
# 中身の盾＝空色→青のグラデーション(見本の金属質感を空色で)
k_in=0.72
out=Image.alpha_composite(out,shadow(lambda d,a:d.polygon(shield(cx,cy,ow,oh,k_in),fill=(0,0,0,a)),120,W*0.02,-W*0.015))
out=Image.alpha_composite(out,masked(vgrad((150,214,255),(34,112,196),cy-oh*k_in/2,cy+oh*k_in/2),lambda d:d.polygon(shield(cx,cy,ow,oh,k_in),fill=255)))
# 斜めの光沢(左上半分を明るく・見本の反射の折れ目)
gl=Image.new('RGBA',(W,W),(0,0,0,0)); gm=Image.new('L',(W,W),0); ImageDraw.Draw(gm).polygon(shield(cx,cy,ow,oh,k_in),fill=255)
gg=Image.new('L',(W,W),0); ImageDraw.Draw(gg).polygon([(cx-ow,cy-oh),(cx+ow*0.55,cy-oh),(cx-ow*0.05,cy+oh*0.05),(cx-ow,cy+oh*0.35)],fill=95)
gg=gg.filter(ImageFilter.GaussianBlur(W*0.004))
gl.paste((255,255,255,255),(0,0,W,W)); gl.putalpha(Image.composite(gg,Image.new('L',(W,W),0),gm))
out=Image.alpha_composite(out,gl)
# 右下は少し暗く沈める(金属の陰)
dk=Image.new('RGBA',(W,W),(0,0,0,0)); dm=Image.new('L',(W,W),0)
ImageDraw.Draw(dm).polygon([(cx+ow*0.55,cy-oh),(cx+ow,cy-oh),(cx+ow,cy+oh),(cx-ow*0.3,cy+oh),(cx-ow*0.05,cy+oh*0.05)],fill=55)
dm=dm.filter(ImageFilter.GaussianBlur(W*0.004))
dk.paste((0,20,60,255),(0,0,W,W)); dk.putalpha(Image.composite(dm,Image.new('L',(W,W),0),gm))
out=Image.alpha_composite(out,dk)
# ---- 王冠(盾の上縁に重ねる・立体: 円柱ふうの帯＋下の厚み＋とがりの左右の陰影・2026-09-09タダシさん指示)
def hgrad(stops,x0,x1):
    """横方向のグラデーション。stops=[(位置0〜1, 色),...]"""
    g=Image.new('RGB',(W,W)); p=g.load()
    for x in range(W):
        t=min(1,max(0,(x-x0)/max(1,(x1-x0))))
        for i in range(len(stops)-1):
            if t<=stops[i+1][0]:
                a,b=stops[i],stops[i+1]; u=(t-a[0])/max(1e-6,(b[0]-a[0])); col=lerp(a[1],b[1],u); break
        else: col=stops[-1][1]
        for y in range(W): p[x,y]=col
    return g.convert('RGBA')
cw,ch=W*0.42,W*0.21; kx,ky=W/2,cy-oh/2+W*0.085   # ky=帯の底。盾の上縁にしっかり重ねる
l,r=kx-cw/2,kx+cw/2; band=ch*0.30
def crown():
    return [(l,ky),(l,ky-band),(l,ky-ch),(kx-cw*0.25,ky-band-ch*0.18),(kx,ky-ch*1.15),(kx+cw*0.25,ky-band-ch*0.18),(r,ky-ch),(r,ky-band),(r,ky)]
out=Image.alpha_composite(out,shadow(lambda d,a:d.polygon([(l,ky),(l,ky-ch*1.15),(r,ky-ch*1.15),(r,ky)],fill=(0,0,0,a)),150,W*0.022,-W*0.02))
# 帯の下の厚み(手前に回り込む縁・暗い金)
th=Image.new('RGBA',(W,W),(0,0,0,0)); ImageDraw.Draw(th).rounded_rectangle([l,ky-band*0.5,r,ky+ch*0.16],radius=W*0.014,fill=(128,84,10,255))
out=Image.alpha_composite(out,th)
# とがり(縦の金グラデーション)
out=Image.alpha_composite(out,masked(vgrad((255,238,168),(206,150,30),ky-ch*1.15,ky-band),lambda d:d.polygon(crown(),fill=255)))
# とがりの左右の陰影(左の面は明るく・右の面は暗く)＝角ばった立体に見せる
shd=Image.new('RGBA',(W,W),(0,0,0,0)); sd2=ImageDraw.Draw(shd)
for (bx0,bx1,tipx,tipy) in [(l,kx-cw*0.25,l,ky-ch),(kx-cw*0.25,kx+cw*0.25,kx,ky-ch*1.15),(kx+cw*0.25,r,r,ky-ch)]:
    by=ky-band-ch*0.18
    sd2.polygon([(bx0,by if bx0!=l else ky-band),(tipx,tipy),(tipx,by)],fill=(255,255,255,70))   # 左の面
    sd2.polygon([(tipx,tipy),(bx1,by if bx1!=r else ky-band),(tipx,by)],fill=(70,40,0,80))          # 右の面
out=Image.alpha_composite(out,shd)
# 帯(円柱ふう: 左寄りが明るく両端へ暗く)
bandimg=hgrad([(0,(190,132,22)),(0.32,(255,236,160)),(0.5,(236,190,72)),(1,(160,104,12))],l,r)
out=Image.alpha_composite(out,masked(bandimg,lambda d:d.rounded_rectangle([l,ky-band,r,ky],radius=W*0.012,fill=255)))
# 帯の上下の縁線と輪郭
ol=Image.new('RGBA',(W,W),(0,0,0,0)); od=ImageDraw.Draw(ol)
od.polygon(crown(),outline=(140,92,8,255),width=int(W*0.009))
od.rounded_rectangle([l,ky-band,r,ky],radius=W*0.012,outline=(140,92,8,255),width=int(W*0.009))
od.line([(l+W*0.01,ky-band+W*0.012),(r-W*0.01,ky-band+W*0.012)],fill=(255,248,210,150),width=int(W*0.006))
out=Image.alpha_composite(out,ol)
# 土台の帯の宝石(青緑・マゼンタ・青緑)
gm2=Image.new('RGBA',(W,W),(0,0,0,0)); g2=ImageDraw.Draw(gm2)
for i,(gx,col) in enumerate([(kx-cw*0.28,(63,214,193)),(kx,(255,90,190)),(kx+cw*0.28,(63,214,193))]):
    rr=W*0.027 if i==1 else W*0.021; gy=ky-band*0.5
    g2.ellipse([gx-rr*1.25,gy-rr*1.25,gx+rr*1.25,gy+rr*1.25],fill=(120,78,8,255))            # 台座
    g2.ellipse([gx-rr,gy-rr,gx+rr,gy+rr],fill=col+(255,),outline=(90,58,4,255),width=int(W*0.005))
    g2.ellipse([gx-rr*0.45,gy-rr*0.6,gx+rr*0.05,gy-rr*0.15],fill=(255,255,255,170))
out=Image.alpha_composite(out,gm2)
# とがった先の玉(金・左上に光)
bl=Image.new('RGBA',(W,W),(0,0,0,0)); bd=ImageDraw.Draw(bl)
for gx,gy in [(l,ky-ch),(kx,ky-ch*1.15),(r,ky-ch)]:
    rr=W*0.025 if gx==kx else W*0.02
    bd.ellipse([gx-rr,gy-rr,gx+rr,gy+rr],fill=(255,226,120,255),outline=(140,92,8,255),width=int(W*0.007))
    bd.ellipse([gx-rr*0.55,gy-rr*0.7,gx-rr*0.05,gy-rr*0.2],fill=(255,255,255,200))
out=Image.alpha_composite(out,bl)
# きらめき(王冠の右上に小さな十字の光)
sp=Image.new('RGBA',(W,W),(0,0,0,0)); sd=ImageDraw.Draw(sp)
for (sx,sy,sz) in [(kx+cw*0.44,ky-ch*1.05,W*0.030),(kx-cw*0.55,ky-ch*0.45,W*0.018)]:
    sd.polygon([(sx,sy-sz),(sx+sz*0.22,sy-sz*0.22),(sx+sz,sy),(sx+sz*0.22,sy+sz*0.22),(sx,sy+sz),(sx-sz*0.22,sy+sz*0.22),(sx-sz,sy),(sx-sz*0.22,sy-sz*0.22)],fill=(255,255,255,235))
out=Image.alpha_composite(out,sp)
# ---- 四隅を落とす(他のアイコンと同じ半径102px)
rm=Image.new('L',(W,W),0); ImageDraw.Draw(rm).rounded_rectangle([0,0,W-1,W-1],radius=int(102*SS),fill=255)
out.putalpha(rm); out=out.resize((S,S),Image.LANCZOS)
base='/Users/t.t/Desktop/TARCY009.github.io/assets/icons/bulk/'
out.save(base+'icon-512.png'); out.resize((192,192),Image.LANCZOS).save(base+'icon-192.png')
out.resize((180,180),Image.LANCZOS).save(base+'apple-touch-icon.png'); out.resize((32,32),Image.LANCZOS).save(base+'favicon-32.png')
print('ok')
