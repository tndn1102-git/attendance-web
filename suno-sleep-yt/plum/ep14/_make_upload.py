# -*- coding: utf-8 -*-
r"""
EP14 업로드 잡 + 고정댓글 생성 — 2026-09-11. 형식은 EP13(`plum/ep13/_make_upload.py`) 그대로.
  py -3 plum\ep14\_make_upload.py
§4·§5·§6 준수 · 🍂 가을 2편째 · 문형 = **감탄·궁금증형(신규, 14번째)** · 이모지 = 🍂 · 씬 = 외관 복귀(흰 벽 카페·폴딩도어·은행나무).
⚠️ 가을을 아쉬워하지 않는다 — 맑고 높은 하늘을 반기는 쪽. 끝나감·떨어짐 0줄(§🏝️).
"""
import io, os, json, sys

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))

TITLE = 'Cafe Playlist ☕ 하늘이 원래 이렇게 높았었나요 🍂 Chill Cafe Music'

DESC = """폴딩도어를 활짝 열어둔 흰 카페, 양옆으로 노란 은행나무가 선 곳의 플레이리스트입니다 ☕🍂

이번 편은 "공기가 맑아지는" 이야기예요.
하늘이 높고 공기가 투명해서 멀리 있는 것까지 또렷하게 보이는 날,
복잡하던 머리가 한 번 헹군 것처럼 가벼워지는 기분.
열 곡 모두 저희가 직접 쓰고 만들었고, 가사도 전부 직접 썼습니다.

활짝 열린 문 너머로 뒤뜰의 은행나무까지 한 번에 보이고,
문 앞 라탄 의자 하나에는 고양이가 앉아 있습니다.

일할 때, 책 읽을 때, 창문을 활짝 열어두고 싶은 날에 틀어두세요.

🎧 중간광고 없이 이어집니다.
오늘도 편하게 들어주세요 ☕

—

Ten original songs written and produced for this channel, looping for hours.
Soft soul-pop and bossa nova with the vocals kept low and behind the band —
made to stay in the background while you work, read, or just take a deep breath
on a day when the air is this clear. No mid-roll ads.

이 채널의 음악에 대하여
곡도, 가사도, 화면 속 그림도 전부 plum music 에서 직접 만듭니다.
AI 를 도구로 씁니다. 다만 어떤 곡을 넣고 뺄지는 사람이 정합니다.

무단 복제·재배포·재업로드·2차 가공을 금지합니다.
영상과 음원의 저작권은 plum music 에 있습니다.

들어주셔서 고맙습니다 ☕

#카페음악
#카페플레이리스트
#가을플레이리스트
#가을노래
#플레이리스트
#잔잔한음악
#작업할때듣는음악
#공부할때듣는음악
#보사노바
#힐링음악
#매장음악
#cafemusic
#cafeplaylist
#autumnplaylist
#chillmusic
#bossanova
#relaxingmusic
#studymusic
#backgroundmusic
#plummusic
"""
# ── 발행 = 2026-09-21 (월) 08:00 KST = 09-20 23:00 UTC (§6 월·금 08:00) ──
PUBLISH_UTC = '2026-09-20T23:00:00Z'

job = {
    'token': 'yt_token.json',
    'videos': [{
        'file': 'plum/ep14/upload/ep14_main.mp4',
        'title': TITLE,
        'description': DESC,
        'tags': [],
        'thumbnail': 'plum/ep14/bg/thumb_ep14_final.jpg',
        'categoryId': 10,
        'publishAt': PUBLISH_UTC,
    }],
}
json.dump(job, io.open(os.path.join(HERE, '_upload_job.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

tl = json.load(io.open(os.path.join(HERE, 'tracklist_ep14.json'), encoding='utf-8'))
first = [t for t in tl['tracks'] if t['i'] <= 20]
lines = ['모든 곡은 저희가 직접 만든 곡입니다 🎶',
         '음원 발매를 원하는 곡이 있다면 번호나 제목으로 댓글 남겨주세요.',
         '의견을 반영해서 발매하고, 이 댓글에 소식을 업데이트할게요 😊',
         "If there's a song you'd like to see released, leave a comment below!",
         '']
lines += ['%s %s' % (t['ts'], t['title']) for t in first]
io.open(os.path.join(HERE, '_고정댓글만.txt'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

print('제목 %d자: %s' % (len(TITLE), TITLE))
print('설명 %d자 · 해시태그 %d개' % (len(DESC), DESC.count('#')))
print('발행 %s (= 2026-09-21 월 08:00 KST)' % PUBLISH_UTC)
print('고정댓글 %d트랙' % len(first))
