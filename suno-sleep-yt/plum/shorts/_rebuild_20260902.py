# -*- coding: utf-8 -*-
r"""
2026-09-02 쇼츠 배경 중복 해소 — 신규 세로 배경 6장 크롭(_final) + 쇼츠 6편 재빌드.
  py -3 plum\shorts\_rebuild_20260902.py

배경↔쇼츠 매핑 (편 컨셉 유지 · 구도만 분화):
  s14(9/3)  ep06_close   s15(9/5)  ep06_inside
  s17(9/8)  ep07_close   s18(9/9)  ep07_inside
  s20(9/12) ep08_close   s21(9/13) ep08_inside
유지(와이드 원본): s13(9/2) · s16(9/6) · s19(9/10)
"""
import io, os, sys, subprocess
from PIL import Image

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)

BGS = ['ep06_close_vert', 'ep06_inside_vert', 'ep07_close_vert',
       'ep07_inside_vert', 'ep08_close_vert', 'ep08_inside_vert']

# 1) ✦ 워터마크 = 아래 약 10%(1024 기준 103px)를 잘라 _final 저장 (기존 관행)
for name in BGS:
    src = 'plum/shorts/bg/%s.png' % name
    dst = 'plum/shorts/bg/%s_final.png' % name
    if not os.path.exists(src):
        sys.exit('⛔ 원본 없음: ' + src)
    im = Image.open(src)
    w, h = im.size
    cut = round(h * 103 / 1024)
    im.crop((0, 0, w, h - cut)).save(dst)
    print('크롭 %s %dx%d → %dx%d' % (name, w, h, w, h - cut))

# 2) 쇼츠 6편 재빌드
JOBS = [
    ('plum/shorts/bg/ep06_close_vert_final.png',
     'plum/shorts/hooks_ep06/hook_the day went loose on me.mp3',
     'plum/shorts/out_ep06/s14_the_day_went_loose_on_me.mp4'),
    ('plum/shorts/bg/ep06_inside_vert_final.png',
     'plum/shorts/hooks_ep06/hook_better just by sitting down.mp3',
     'plum/shorts/out_ep06/s15_better_just_by_sitting_down.mp4'),
    ('plum/shorts/bg/ep07_close_vert_final.png',
     'plum/shorts/hooks_ep07/hook_the still part is the good part.mp3',
     'plum/shorts/out_ep07/s17_the_still_part_is_the_good_part.mp4'),
    ('plum/shorts/bg/ep07_inside_vert_final.png',
     'plum/shorts/hooks_ep07/hook_my weight went somewhere else.mp3',
     'plum/shorts/out_ep07/s18_my_weight_went_somewhere_else.mp4'),
    ('plum/shorts/bg/ep08_close_vert_final.png',
     'plum/shorts/hooks_ep08/hook_i watch it the whole way in.mp3',
     'plum/shorts/out_ep08/s20_i_watch_it_the_whole_way_in.mp4'),
    ('plum/shorts/bg/ep08_inside_vert_final.png',
     'plum/shorts/hooks_ep08/hook_we look the same way.mp3',
     'plum/shorts/out_ep08/s21_we_look_the_same_way.mp4'),
]

for bg, hook, out in JOBS:
    if not os.path.exists(hook):
        sys.exit('⛔ 훅 없음: ' + hook)
    if os.path.exists(out):                      # 구판은 _oldbg 로 보존
        bak = out.replace('.mp4', '_oldbg.mp4')
        if not os.path.exists(bak):
            os.rename(out, bak)
    print('=== 빌드', out)
    r = subprocess.run(['py', '-3', 'plum/_assets/build_short.py', bg, hook, out],
                       capture_output=True, text=True)
    tail = (r.stdout or '').strip().split('\n')[-1:] + (r.stderr or '').strip().split('\n')[-1:]
    print('   ', ' | '.join(x for x in tail if x)[:160])
    if r.returncode != 0 or not os.path.exists(out):
        sys.exit('⛔ 빌드 실패 rc=%d' % r.returncode)
print('\n✅ 6편 재빌드 완료')
