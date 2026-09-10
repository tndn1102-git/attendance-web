# -*- coding: utf-8 -*-
r"""EP10 업로드 잡 + 고정댓글 생성 (EP09 _job.json 형식). titlecards/cards.json 의 타임스탬프를 읽는다.
  py -3 ballad90\ep10\_make_job.py
"""
import io, os, json, sys
if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
UP = os.path.join(HERE, 'upload')
cards = json.load(io.open(os.path.join(HERE, 'titlecards', 'cards.json'), encoding='utf-8'))
tl = '\n'.join('%s  %02d. %s' % (c['mmss'], c['n'], c['ko']) for c in cards)
N = len(cards)
NUM = {7: '일곱', 8: '여덟'}[N]
TITLE = '가을 체육대회 끝나고, 스탠드에 둘만 남아 🍂 | 2000년대 감성 가요 · 추억의 발라드 플레이리스트 | VOL.10'
DESC = TITLE + """

은행잎이 노랗게 물든 가을 한낮, 체육대회가 막 끝난 학교 운동장.
만국기 아래 흰 선이 그어진 트랙, 스탠드에 남아 있던 그날의 마음을 """ + NUM + """ 곡에 담았습니다.
이번 편도 전부 밝고 산뜻한 설렘의 노래들입니다.

━━━ 이런 순간에 들어보세요 ━━━
· 선선한 가을바람에 기분이 좋아질 때
· 마음에 둔 사람이 자꾸 생각날 때
· 산책하거나 운동하러 나가는 길에
· 콧노래가 나오는 오후에
· 그 시절 가을 운동회가 그리울 때

바통을 넘겨받고, 체육복을 빌려주고,
목이 쉬도록 응원하던 — """ + NUM + """ 번의 설렘을 담았습니다.
가사는 """ + NUM + """ 곡 모두 직접 썼습니다.

🎵 이 채널의 모든 곡은 창작곡입니다
   · 기존 곡의 리메이크나 커버, 원곡 모음이 아닙니다
   · 멜로디도 가사도 이 채널에서 새로 만든 것입니다
   · 가사는 사람이 직접 쓰고, 작·편곡에 AI 작곡 기술을 활용했습니다
   · 그 시절의 소리를 빌렸을 뿐, 담긴 마음은 사람의 것입니다

━━━━━━━━━━━━━━━━━━ 수록곡 ━━━━━━━━━━━━━━━━━━
""" + tl + """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 매주 수요일 오전 7시에 새 플레이리스트가 올라옵니다
💬 듣고 싶은 감정이나 상황이 있다면 댓글로 남겨주세요

▶ 구독 https://youtube.com/@chueokgamsung?sub_confirmation=1

#감성가요 #2000년대가요 #2000년대발라드 #추억의노래 #플레이리스트 #설렘 #첫사랑 #가을노래 #가을플레이리스트 #체육대회 #운동회 #학창시절 #옛날노래 #레트로 #기분좋은노래 #창작곡 #koreanballad #playlist"""
TAGS = ["2000년대 가요","2000년대 발라드","2000년대 감성","추억의 노래","옛날 노래","감성 가요","감성 플레이리스트","발라드 플레이리스트","가을 노래","가을 플레이리스트","가을 감성","설렘 노래","첫사랑 노래","짝사랑 노래","기분좋은 노래","밝은 노래","산뜻한 노래","체육대회","가을 운동회","학창시절","학교 운동장","산책 음악","드라이브 음악","카페 음악","미디엄템포","한국 발라드","추억 감성가요","레트로 가요","옛날 가요","그때 그 노래","추억여행","창작곡","자작곡","설렘","korean ballad","kpop ballad","2000s kpop","korean playlist"]
job = {'token': 'yt_token_gayo.json',
       '_note': 'EP10 본편 · 가을 진입 첫 편. 2026-09-23(수) 07:00 KST = 전날 22:00Z 예약. Mureka V7.6 3편째(밝은 설렘 문법 계승). 트랙 타임스탬프 = cards.json 반영.',
       'videos': [{'file': os.path.join(UP, 'ChueokGamsung_VOL10_Sports_Day.mp4'), 'title': TITLE, 'description': DESC,
                   'tags': TAGS, 'privacyStatus': 'public', 'categoryId': '10', 'defaultLanguage': 'ko',
                   'thumbnail': os.path.join(UP, 'thumb_vol10.jpg'), 'publishAt': '2026-09-22T22:00:00Z'}]}
json.dump(job, io.open(os.path.join(UP, '_job.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
PIN = """은행잎 물든 가을, 체육대회가 끝나고 스탠드에 둘만 남아 있던 마음입니다 🍂

🎵 이 채널의 곡은 전부 창작곡입니다
   기존 곡의 리메이크나 커버가 아니라, 멜로디도 가사도 새로 만든 것입니다.
   가사는 사람이 직접 쓰고, 작·편곡에 AI 작곡 기술을 활용했습니다.

━━━━━━━━ 수록곡 ━━━━━━━━
""" + tl + """
━━━━━━━━━━━━━━━━━━

여러분은 그 시절 가을 운동회 날, 누구를 제일 크게 응원했나요?
댓글로 들려주세요 — 다음 편에 담아볼게요 💬

📅 매주 수요일 오전 7시
"""
io.open(os.path.join(UP, '_고정댓글.txt'), 'w', encoding='utf-8').write(PIN)
print('제목 %d자 · 설명 %d자 · 태그 %d · 해시태그 %d' % (len(TITLE), len(DESC), len(TAGS), DESC.count('#')))
print(tl)
