# -*- coding: utf-8 -*-
r"""
EP13 업로드 잡 + 고정댓글 생성 — 2026-09-10. 형식은 EP12(`plum/ep12/_make_upload.py`) 그대로.
  py -3 plum\ep13\_make_upload.py
§4·§5·§6 준수 · 🍂 **가을 전환 첫 편**(cherry 첫 가을 제목 09-18 과 같은 날) · 문형 = **계절+감정형(신규, 13번째)** · 이모지 = 🍂.
⚠️ 가을을 아쉬워하지 않는다 — 반기는 쪽. 끝나감·떨어짐·지난 여름 0줄(§🏝️).
"""
import io, os, json, sys

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))

TITLE = 'Cafe Playlist ☕ 문을 활짝 열어두니 가을이 들어와요 🍂 Chill Cafe Music'

DESC = """폴딩도어를 활짝 열어두면 단풍 정원이 그대로 들어오는 카페의 플레이리스트입니다 ☕🍂

이번 편은 "볕이 부드러워지는" 이야기예요.
뜨겁던 햇살이 한결 누그러지고, 따뜻한 것이 다시 반가워지는 계절.
괜히 한 겹 느슨해져서, 오늘은 조금 더 오래 앉아 있고 싶어지는 마음.
열 곡 모두 저희가 직접 쓰고 만들었고, 가사도 전부 직접 썼습니다.

크림색 소파 두 개가 마주 놓여 있고, 활짝 열린 문 너머로 붉은 단풍이 가득합니다.
작은 테이블 위에는 찻주전자, 소파 한쪽에서는 고양이가 잡니다.

일할 때, 책 읽을 때, 선선한 바람이 좋은 날 오래 틀어두세요.

🎧 중간광고 없이 이어집니다.
오늘도 편하게 들어주세요 ☕

—

Ten original songs written and produced for this channel, looping for hours.
Soft soul-pop and bossa nova with the vocals kept low and behind the band —
made to stay in the background while you work, read, or just sit a little longer
now that the light has turned soft. No mid-roll ads.

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
# ── 발행 = 2026-09-18 (금) 08:00 KST = 09-17 23:00 UTC (§6 월·금 08:00) ──
PUBLISH_UTC = '2026-09-17T23:00:00Z'

job = {
    'token': 'yt_token.json',
    'videos': [{
        'file': 'plum/ep13/upload/ep13_main.mp4',
        'title': TITLE,
        'description': DESC,
        'tags': [],
        'thumbnail': 'plum/ep13/bg/thumb_ep13_final.jpg',
        'categoryId': 10,
        'publishAt': PUBLISH_UTC,
    }],
}
json.dump(job, io.open(os.path.join(HERE, '_upload_job.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

tl = json.load(io.open(os.path.join(HERE, 'tracklist_ep13.json'), encoding='utf-8'))
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
print('발행 %s (= 2026-09-18 금 08:00 KST)' % PUBLISH_UTC)
print('고정댓글 %d트랙' % len(first))
