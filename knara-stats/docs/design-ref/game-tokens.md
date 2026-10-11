# 「K의 나라」 게임 앱 디자인 토큰 (2026-10-11 실측, 앱 인라인 CSS에서 추출)

## 색 (CSS 변수 이름이 곧 컨셉: 한지·먹·오방색·놋쇠)
--hanji:#F5EFE4  --hanji-2:#EBE2D2  --hanji-3:#DED2BE   (종이 배경 3단)
--meok:#211E1A   --meok-2:#4B443B   --mute:#8D8477       (먹 글자 3단)
--line:rgba(33,30,26,.13)                                (선·테두리)
--jeok:#C33A2E  --cheong:#1F4A8C  --hwang:#DFA42A  --nok:#2E7D6B   (적·청·황·녹 = 오방색 포인트)
--brass:#C9A24B  --brass-d:#8E6B22                         (놋쇠·금빛 = "금빛 칸/금빛 신호" 게임 내 성공 색)
자주 쓰인 보조색: #FFD9A0(살구빛 하이라이트) #F2EADA #7E2119(진한 적) #D23A2C #FFF8EE #EAE0D1(theme-color, 첫 화면 베이지)
지도 도(道) 라벨 색: 서울·경기 보라, 충북·충남 빨강, 전북 주황, 전남 노랑, 경북 파랑, 경남 하늘, 강원 연두, 제주 하늘 — 파스텔 바탕에 흰 테두리 알약 라벨.

## 글꼴
--f-disp:"Hahmlet","Noto Serif KR",serif          제목(h1 900, 34px, letter-spacing -.02em) — 세로 쓰기 "K의 나라" 타이틀도 이 계열
--f-story:"Gowun Batang","Noto Serif KR",serif     본문·카드 글(16.5px 700)
--f-ui:"Noto Sans KR",sans-serif                   UI 라벨·칩
--f-brush:"Nanum Brush Script","Hahmlet",cursive   붓글씨 포인트
--f-num:"Hahmlet",ui-serif,serif                   숫자

## 모양
border-radius: 알약 999px · 카드 16~20px · 칩 14px · 바텀시트 26px 26px 0 0
.btn  : 검정(먹) 바탕 + 한지색 글자, min-height 58px, radius 16px, 굵은 글자 16.5px, box-shadow 0 4px 0 #000(두꺼운 밑그림자) + 0 8px 18px rgba(33,30,26,.22) → "눌리는 도장" 느낌
.card : rgba(255,255,255,.55) 반투명 흰 + inset 1.5px --line 테두리 + 0 2px 0 연한 그림자, radius 16px, Gowun Batang 16.5px 700
.chip : rgba(255,255,255,.5) + inset 1.5px --line, radius 14px, 14.5px 500, min-height 52px
.sheet: 하단 시트 width min(100%,520px), 위 모서리 26px, 그림자 0 -10px 40px
.paper: 한지 배경 + 종이 질감 타일(--paper, 220px)
--ease: cubic-bezier(.2,.8,.2,1)
세계관 모티프 셀렉터: .saekdong(색동) .beads(구슬) .noribox/.mynori(노리개) .seal(도장) .brush(붓) .compass .hseal
```
## 화면 레퍼런스
- game-01-title-map.jpg : 첫 화면. 로우폴리 3D 한국 지도(파스텔 바다·초록 산·베이지 땅), 오른쪽 세로 "K의 나라" 굵은 명조 타이틀 + 작은 세로 "팔색 노리개", 왼쪽 위 파란 알약 "지역을 플레이, K를 발견", 아래 알약 "🌐 한국어", 색동 진행바, 검정 큰 버튼 "들어가기".
- game-02-sense-sheet.jpg : 한지색 바텀시트 "모든 감각을 깨워라" + 아이콘 카드 8개(AR 카메라·마이크·초음파·움직임·나침반·빛·QR·블루투스) + 검정 버튼 "감각 열기". 상단 왼쪽 구슬 8개 진행(0/8).
