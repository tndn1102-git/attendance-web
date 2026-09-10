# -*- coding: utf-8 -*-
r"""
EP11 배경·썸네일 확정 — 컨셉 = ep11/_컨셉.md

락업 = EP07 make_thumb.py 그대로 (큰 한글 2줄 외곽선 + 하단 영문).
훅 문구 = 그시절형(로테이션: EP08 감정훅 → EP09 그시절) =「그 시절 분식집 / 네 옆자리를 맡아 놨어」.
배경 = c2_clean (✦ 확산 제거본). a판(밤)·b판(파스텔)은 기각 이력 — §☀️🔴.
"""
import io, os, sys
from PIL import Image, ImageDraw, ImageFont

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
EP = os.path.dirname(HERE)
UP = os.path.join(EP, 'upload'); os.makedirs(UP, exist_ok=True)
SRC = os.path.join(HERE, 'final', 'PICK.png')

W, H = 1280, 720
F_KR = 'C:/Windows/Fonts/malgunbd.ttf'
F_EN = 'C:/Windows/Fonts/georgiaz.ttf'
AMBER = (233, 164, 76); DUSK = (59, 78, 107)
CREAM = (247, 239, 224); CORAL = (228, 115, 94)
WORDMARK = '추억 감성가요'; LABEL_EN = '2000s KOREAN BALLAD'
H1, H2, HI, VOL = '가을 기차에서', '몰래 보던 게 들켰어', '들켰어', 11   # 감정훅 · 곡4 「들켰어」 · 가을 2편째

im = Image.open(SRC).convert('RGB')
tw, th = im.size; want = W / H
if tw / th > want:
    nw = int(th * want); im = im.crop(((tw - nw) // 2, 0, (tw + nw) // 2, th))
else:
    nh = int(tw / want); im = im.crop((0, (th - nh) // 2, tw, (th + nh) // 2))

# 1) 본편 배경 (타이포 없음)
im.resize((1920, 1080), Image.LANCZOS).save(os.path.join(UP, 'bg_vol11_1920.jpg'), quality=94)
print('배경  bg_vol11_1920.jpg')

# 2) 썸네일
t = im.resize((W, H), Image.LANCZOS)
sc = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(sc)
for i in range(300):
    y = H - 300 + i
    sd.line([(0, y), (W, y)], fill=(12, 14, 22, int(205 * (i / 300) ** 1.5)))
t = Image.alpha_composite(t.convert('RGBA'), sc).convert('RGB')
d = ImageDraw.Draw(t, 'RGBA')
f_l = ImageFont.truetype(F_EN, 31)
f_m = ImageFont.truetype(F_KR, 26); f_v = ImageFont.truetype(F_EN, 27)

def fit_kr(text, target_w, hi=78):
    for s in range(hi, 30, -1):
        f = ImageFont.truetype(F_KR, s)
        if d.textlength(text, font=f) <= target_w:
            return f
    return ImageFont.truetype(F_KR, 30)

f_h = min((fit_kr(H1, 1080), fit_kr(H2, 1080)), key=lambda f: f.size)

b = d.textbbox((0, 0), WORDMARK, font=f_m); bw, bh = b[2] - b[0], b[3] - b[1]
d.rounded_rectangle([26, 22, 26 + bw + 32, 22 + bh + 24], radius=17, fill=DUSK + (215,))
d.text((42, 22 + bh + 12), WORDMARK, font=f_m, fill=CREAM, anchor='lm')
vt = 'VOL.%02d' % VOL
b = d.textbbox((0, 0), vt, font=f_v); vw, vh = b[2] - b[0], b[3] - b[1]
d.rounded_rectangle([W - 26 - vw - 30, 22, W - 26, 22 + vh + 24], radius=17, fill=AMBER + (225,))
d.text((W - 41, 22 + vh + 12), vt, font=f_v, fill=(28, 24, 18), anchor='rm')

d.text((W // 2, H - 188), H1, font=f_h, fill=CREAM, stroke_width=8,
       stroke_fill=(10, 12, 18), anchor='mm')
total = d.textlength(H2, font=f_h); x = W // 2 - total / 2; idx = H2.find(HI)
for i, ch in enumerate(H2):
    col = CORAL if (idx >= 0 and idx <= i < idx + len(HI)) else CREAM
    d.text((x, H - 104), ch, font=f_h, fill=col, stroke_width=8,
           stroke_fill=(10, 12, 18), anchor='lm')
    x += d.textlength(ch, font=f_h)
d.line([(W // 2 - 190, H - 56), (W // 2 + 190, H - 56)], fill=AMBER, width=3)
d.text((W // 2, H - 30), LABEL_EN, font=f_l, fill=CREAM, stroke_width=4,
       stroke_fill=(10, 12, 18), anchor='mm')
t.save(os.path.join(UP, 'thumb_vol11.jpg'), quality=93)
t.resize((320, 180), Image.LANCZOS).save(os.path.join(UP, '_thumb_320.jpg'), quality=90)
print('썸네일 thumb_vol11.jpg (한글 %dpx) + _thumb_320.jpg' % f_h.size)
