# -*- coding: utf-8 -*-
import io, os
HERE = os.path.dirname(os.path.abspath(__file__))
h = io.open(os.path.join(HERE, '..', '..', 'ep17', 'bg', 'index.html'), encoding='utf-8').read()
head = h[:h.index('<h1>')].replace('EP17', 'EP18')
body = '''<h1>plum music EP18 — 가을 6편째 배경 4안</h1>
<p class="sub">발행 10-05(월) 08:00 · 테마 <b>넓음·여백</b> · 15~17편이 실내 3연속이라 이번엔 외관 3 + 실내 1 · 구도도 넷 다 다르게 · 마음에 드는 안의 <b>알파벳</b>만 알려주세요. 작은 사진은 재도색 전 실사 원본.</p>
<div class="grid">
'''
cards = [('A', '코스모스 언덕 카페 · 정면', '외관 · 폴딩도어 활짝 · 분홍·흰 코스모스 들판 · 액센트 분홍', 'A_front_cosmos'),
         ('B', '자작나무 호숫가 · 모서리 3/4 시점', '외관 · 통유리 두 면 · 청록 호수 + 흰 자작나무 · 액센트 청록', 'B_corner_birchlake'),
         ('C', '억새 능선 유리 파빌리온 · 살짝 내려다봄', '외관 · 언덕 위 낮은 유리 건물 · 은빛 억새 물결 · 액센트 은백', 'C_ridge_silvergrass'),
         ('D', '녹차밭 라운지 · 실내 대각선', '실내 · 긴 라운지 한쪽 벽이 통째로 열림 · 굽이치는 초록 차밭 · 액센트 초록', 'D_lounge_teafield')]
for a, t, d, f in cards:
    body += f''' <div class="card"><h2><span class="tag">{a}</span>{t}</h2><p class="d">{d}</p>
  <img src="{f}.png"><div class="real"><img src="real/{f}.png">실사 원본</div></div>
'''
io.open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8').write(head + body + '</div></body></html>')
print('ok')
