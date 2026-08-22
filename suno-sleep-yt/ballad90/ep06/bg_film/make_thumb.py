# -*- coding: utf-8 -*-
r"""
EP06 배경·썸네일 확정 — PC방 새벽(j 계열·필름) + EP01 락업.

락업 = `finalize_vol01.py` 원문(큰 한글 2줄 외곽선 + 하단 영문). 2026-08-12 사용자 확정.
훅 문구 = `gayo90\brand\make_era10.py` 의 e08 HOOKS =「바람이 선선해지면 / 생각나는 노래」.
컨셉 부제와 같은 문장이라 썸네일·설명문·곡이 한 문장으로 묶인다.
"""
import io, os, sys, shutil
from PIL import Image, ImageDraw, ImageFont

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
EP = os.path.dirname(HERE)
UP = os.path.join(EP, 'upload'); os.makedirs(UP, exist_ok=True)
SRC = os.path.join(HERE, 'final', 'PICK.jpg')   # 🕰 2000년대판 (h1=90년대판은 이력 보존)

W, H = 1280, 720
F_KR = 'C:/Windows/Fonts/malgunbd.ttf'
F_EN = 'C:/Windows/Fonts/georgiaz.ttf'
AMBER = (233, 164, 76); DUSK = (59, 78, 107)
CREAM = (247, 239, 224); CORAL = (228, 115, 94)
WORDMARK = '추억 감성가요'; LABEL_EN = '2000s KOREAN BALLAD'   # 🕰 EP04부터 2000년대 (CLAUDE.md §🕰)
H1, H2, HI, VOL = '자꾸 눈이', '마주치던 그때', '마주치던', 6

im = Image.open(SRC).convert('RGB')
tw, th = im.size; want = W / H
if tw / th > want:
    nw = int(th * want); im = im.crop(((tw - nw) // 2, 0, (tw + nw) // 2, th))
else:
    nh = int(tw / want); im = im.crop((0, (th - nh) // 2, tw, (th + nh) // 2))

# 1) 본편 배경 (타이포 없음)
im.resize((1920, 1080), Image.LANCZOS).save(os.path.join(UP, 'bg_vol06_1920.jpg'), quality=94)
print('배경  bg_vol06_1920.jpg')

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

# ⚠ H1 이 9자라 EP01(6자)보다 길다 — 78px 고정이면 폭이 넘친다. 두 줄 모두 1080px 에 맞춰 줄인다.
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
t.save(os.path.join(UP, 'thumb_vol06.jpg'), quality=93)
t.resize((320, 180), Image.LANCZOS).save(os.path.join(UP, '_thumb_320.jpg'), quality=90)
print('썸네일 thumb_vol06.jpg (한글 %dpx) + _thumb_320.jpg' % f_h.size)
