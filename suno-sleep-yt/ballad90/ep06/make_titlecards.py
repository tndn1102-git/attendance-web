# -*- coding: utf-8 -*-
r"""
EP06 곡별 자막 카드 PNG 8장 + 시작 시각 계산.

확정 사양 (EP02 계승 · 실측 스펙):
  · 배치  = EQ·로고를 위(y=800)로 올리고 **자막이 하단중앙**
  · 위치  = 곡명 y=0.835 · 영문 부제 y=0.885
  · 크기  = 곡명 화면높이 5%(54px) · 부제 60%(32px)
  · 색    = #EBE8E1 / 부제 #CEC8BE
  · 처리  = **외곽선 없음 · 플레이트 없음 · 그림자만**
  · 형식  = 곡명 + 영문 부제 2줄 · **번호 없음**
  · 표시  = **곡 내내 지속**

⚠ 영문 부제는 프롬프트 파일에 없다(EP02도 그랬다). 자막 표시용이라 여기서 정한다 —
  EP02 문체(평이한 직역, 수식 없음)를 따른다.
"""
import io, os, sys, json, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, 'audio')
OUT = os.path.join(HERE, 'titlecards')
os.makedirs(OUT, exist_ok=True)

W, H = 1920, 1080
F_KR = 'C:/Windows/Fonts/malgunbd.ttf'
F_EN = 'C:/Windows/Fonts/georgiaz.ttf'
INK = (235, 232, 225)
SUB = (206, 200, 190)
GAP = 1.6

TRACKS = [
    ('오후 네 시',       'Four in the Afternoon'),
    ('외웠어요',         'Learned by Heart'),
    ('고맙다고 했어',    'I Said Thank You'),
    ('삼십분',           'Thirty Minutes'),
    ('답장이 없다',      'No Reply'),
    ('집 앞까지',        'To Your Door'),
    ('인정',             'Admitting It'),
    ('용기',             'Courage'),
]


def dur(p):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                        '-of', 'default=nw=1:nk=1', p],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    return float(r.stdout.strip())


def shadow_text(im, xy, text, font, fill, blur=6, alpha=155, off=(0, 2)):
    lay = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).text((xy[0] + off[0], xy[1] + off[1]), text, font=font,
                             fill=(0, 0, 0, alpha), anchor='mm')
    im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(blur)))
    ImageDraw.Draw(im).text(xy, text, font=font, fill=fill + (255,), anchor='mm')


f_t = ImageFont.truetype(F_KR, int(H * 0.05))
f_s = ImageFont.truetype(F_EN, int(H * 0.05 * 0.6))

t = 0.0
cards = []
for i, (ko, en) in enumerate(TRACKS, 1):
    src = os.path.join(WORK, '%02d.wav' % i)
    if not os.path.exists(src):
        sys.exit('없음: %s (build_master.py 먼저)' % src)
    d = dur(src)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    shadow_text(im, (W // 2, int(H * 0.835)), ko, f_t, INK)
    shadow_text(im, (W // 2, int(H * 0.885)), en, f_s, SUB, blur=5, alpha=140)
    p = os.path.join(OUT, 'card_%02d.png' % i)
    im.save(p)
    end = t + d + (GAP if i < len(TRACKS) else 0)
    cards.append({'n': i, 'ko': ko, 'en': en, 'file': p,
                  'start': round(t, 3), 'end': round(end, 3),
                  'mmss': '%02d:%02d' % (int(t) // 60, int(t) % 60)})
    print('%02d %-14s %s  %7.1f~%7.1fs' % (i, ko, cards[-1]['mmss'], t, end))
    t = end

json.dump(cards, open(os.path.join(OUT, 'cards.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('\n총 %d:%02d · 카드 %d장 -> %s' % (int(t) // 60, int(t) % 60, len(cards), OUT))
