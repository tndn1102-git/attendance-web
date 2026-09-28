# -*- coding: utf-8 -*-
r"""EP16 D안 간판 철자 교정 — Gemini 가 흐리게 'plom masic' 처럼 그렸다. EP13 _fix_sign.py 방식:
글자 자리만 간판 바탕색으로 덮고 'plum / music' 재작성. 1920×1080 업스케일본(_D_1920.png) 기준 좌표.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
im = Image.open(os.path.join(HERE, '_D_1920.png')).convert('RGB')
a = np.asarray(im).astype(np.float32)
# 간판 면 ≈ x 709~755 · y 677~722. 글자 자리 = x 713~751 · y 682~712
FX0, FY0, FX1, FY1 = 713, 682, 751, 712
band = np.concatenate([a[679:682, 712:752].reshape(-1, 3), a[712:715, 712:752].reshape(-1, 3)])
base = np.median(band, axis=0)
rng = np.random.default_rng(16)
a[FY0:FY1, FX0:FX1] = base + rng.normal(0, 1.8, (FY1 - FY0, FX1 - FX0, 3))
im = Image.fromarray(a.clip(0, 255).astype('uint8'))
S = 8
W, H = (FX1 - FX0) * S, (FY1 - FY0) * S
lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(lay)
ink = (78, 74, 70, 235)
f = ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', int(10.5 * S))
for txt, cy in (('plum', 0.30), ('music', 0.74)):
    d.text((W / 2, H * cy), txt, font=f, fill=ink, anchor='mm')
lay = lay.resize((FX1 - FX0, FY1 - FY0), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.25))
im.paste(lay, (FX0, FY0), lay)
im.save(os.path.join(HERE, 'bg_ep16_final.png'))
im.crop((695, 665, 770, 735)).resize((450, 420), Image.LANCZOS).save(os.path.join(HERE, '_sign_zoom_fixed.png'))
print('saved bg_ep16_final.png · base', base.round(1))
