# -*- coding: utf-8 -*-
r"""EP18 A안 — ✦ 제거본(_A_clean.png) 1920×1080 업스케일 + 간판 철자 교정(Gemini 가 'gdan music' 으로 그림).
EP13 _fix_sign.py 방식: 글자 자리만 간판 바탕색으로 덮고 'plum / music' 을 다시 쓴다.
  py -3 plum\ep18\bg\_fix_sign.py
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
src = Image.open(os.path.join(HERE, '_A_clean.png')).convert('RGB')
k = 1080 / src.height
W0 = round(src.width * k)
big = src.resize((W0, 1080), Image.LANCZOS)
ox = (W0 - 1920) // 2
im = big.crop((ox, 0, ox + 1920, 1080))
a = np.asarray(im).astype(np.float32)

def P(x, y):  # 1024 기준 → 1920 기준
    return round(x * k) - ox, round(y * k)

# 1024 기준 글자 자리 x 801~827 · y 273~293
FX0, FY0 = P(801, 273)
FX1, FY1 = P(827, 293)
band = np.concatenate([a[FY0 - 4:FY0 - 1, FX0:FX1].reshape(-1, 3), a[FY1 + 1:FY1 + 4, FX0:FX1].reshape(-1, 3)])
base = np.median(band, axis=0)
rng = np.random.default_rng(18)
a[FY0:FY1, FX0:FX1] = base + rng.normal(0, 2.2, (FY1 - FY0, FX1 - FX0, 3))
im = Image.fromarray(a.clip(0, 255).astype('uint8'))

S = 4
W, H = (FX1 - FX0) * S, (FY1 - FY0) * S
lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(lay)
ink = (70, 70, 72, 235)
f = ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', int(H * 0.36))
for txt, cy in (('plum', 0.30), ('music', 0.72)):
    d.text((W / 2, H * cy), txt, font=f, fill=ink, anchor='mm')
lay = lay.resize((FX1 - FX0, FY1 - FY0), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.35))
im.paste(lay, (FX0, FY0), lay)
im.save(os.path.join(HERE, 'bg_ep18_final.png'))
cx0, cy0 = P(790, 255)
cx1, cy1 = P(840, 310)
im.crop((cx0, cy0, cx1, cy1)).resize(((cx1 - cx0) * 5, (cy1 - cy0) * 5), Image.LANCZOS).save(os.path.join(HERE, '_sign_zoom.png'))
print('saved bg_ep18_final.png', im.size, 'box', (FX0, FY0, FX1, FY1), 'base', base.round(1))
