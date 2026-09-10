# -*- coding: utf-8 -*-
r"""EP13 D안 간판 철자 교정 — Gemini 가 'plum mueic' 로 그렸다(검수에서 발견). 글자 자리만 간판 바탕색으로
덮고 'plum / music' 을 다시 쓴다. 1920×1080 업스케일본(_D_1920.png) 기준 좌표.
  py -3 plum\ep13\bg\_fix_sign.py
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
im = Image.open(os.path.join(HERE, '_D_1920.png')).convert('RGB')
a = np.asarray(im).astype(np.float32)

# 간판 면 = x 289~348 · y 665~707. 글자 자리 = x 294~346 · y 669~702
FX0, FY0, FX1, FY1 = 294, 669, 346, 702
# 바탕색 = 간판 면 가장자리(글자 밖) 띠의 중앙값
band = np.concatenate([a[666:669, 291:347].reshape(-1, 3), a[703:706, 291:347].reshape(-1, 3),
                       a[669:702, 290:293].reshape(-1, 3)])
base = np.median(band, axis=0)
rng = np.random.default_rng(13)
patch = base + rng.normal(0, 2.2, (FY1 - FY0, FX1 - FX0, 3))       # 과슈 면의 미세한 얼룩
a[FY0:FY1, FX0:FX1] = patch
im = Image.fromarray(a.clip(0, 255).astype('uint8'))

# 글자 = 4배 크기로 그려 줄여서 가장자리를 부드럽게
S = 4
W, H = (FX1 - FX0) * S, (FY1 - FY0) * S
lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(lay)
ink = (92, 66, 46, 235)
f = ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', 13 * S)
for txt, cy in (('plum', 0.30), ('music', 0.72)):
    d.text((W / 2, H * cy), txt, font=f, fill=ink, anchor='mm')
lay = lay.resize((FX1 - FX0, FY1 - FY0), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.35))
im.paste(lay, (FX0, FY0), lay)
im.save(os.path.join(HERE, 'bg_ep13_final.png'))
im.crop((270, 645, 370, 725)).resize((600, 480), Image.NEAREST).save(os.path.join(HERE, '_sign_zoom.png'))
print('saved bg_ep13_final.png · base', base.round(1))
