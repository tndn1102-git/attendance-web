# -*- coding: utf-8 -*-
import io, json, os
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_assets', 'thumb_colors.json')
d = json.load(io.open(P, encoding='utf-8'))
d['episodes']['EP18'] = {
    'color': '#5E1F35', 'name': '딥 코스모스 로즈',
    'why': '이 씬의 액센트 원컬러인 분홍 코스모스를 잉크처럼 눌렀다. 텍스트 자리는 열린 폴딩도어 안 원목·크림 실내(p90 214,195,172)라 '
           '갈색 계열은 섞이고, 붉은 분홍(H~340)은 원목(H~30)과 색상각이 멀어 분리된다. 직전 EP17 딥 그레이프(보라 H~290)와 50도, '
           'EP16 번트 탠저린과는 정반대 쪽이며, 같은 붉은 계열 EP14 옥스블러드(적갈)와는 4편 떨어져 있다',
    'bg': '코스모스 언덕 위 화이트 라임스톤 단층 카페 정면 · 폴딩도어 활짝 · 오크 바·크림 소파 · 티크 라운지체어 · 분홍·흰 코스모스 들판 · 고양이 · 가을 6편째 · 넓음/여백 테마',
    'contrast': 7.11}
io.open(P, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))
print('EP18 등록')
