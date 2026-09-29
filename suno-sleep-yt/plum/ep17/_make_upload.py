# -*- coding: utf-8 -*-
r"""
EP17 업로드 잡 + 고정댓글 생성 — 2026-09-29. 형식은 EP16(`plum/ep16/_make_upload.py`) 그대로.
  py -3 plum\ep17\_make_upload.py <발행UTC>
🍂 가을 5편째 · 문형 = 속도 체감형(17번째) · 이모지 = 🍂 · 씬 = 와이너리 창가 자리 · 앉은 1인칭 비정면(사용자 선택 C).
"""
import io, os, json, sys

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))

TITLE = 'Cafe Playlist ☕ 여기선 커피도 한 모금씩 천천히 마시게 돼요 🍂 Chill Cafe Music'

DESC = """포도밭이 내다보이는 창가 자리, 와이너리 카페의 플레이리스트입니다 ☕🍂

이번 편은 "천천히 음미하게 되는" 이야기예요.
자리에 앉아 잔을 드는 순간 서두르던 마음이 느려지고,
한 모금, 한 알을 끝까지 맛보게 되는 기분.
열 곡 모두 저희가 직접 쓰고 만들었고, 가사도 전부 직접 썼습니다.

활짝 열린 창 너머로 보랏빛 포도가 익어가고,
테이블 위엔 카푸치노 한 잔, 옆 의자에는 고양이가 동그랗게 잠들어 있습니다.

일할 때, 책 읽을 때, 커피 한 잔 천천히 마시고 싶은 날에 틀어두세요.

🎧 중간광고 없이 이어집니다.
오늘도 편하게 들어주세요 ☕

—

Ten original songs written and produced for this channel, looping for hours.
Soft soul-pop and bossa nova with the vocals kept low and behind the band —
made to stay in the background while you work, read, or take your time
with a cup by a window over the vineyard, one slow sip at a time. No mid-roll ads.

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
PUBLISH_UTC = sys.argv[1]

job = {
    'token': 'yt_token.json',
    'videos': [{
        'file': 'plum/ep17/upload/ep17_main.mp4',
        'title': TITLE,
        'description': DESC,
        'tags': [],
        'thumbnail': 'plum/ep17/bg/thumb_ep17_final.jpg',
        'categoryId': 10,
        'publishAt': PUBLISH_UTC,
    }],
}
json.dump(job, io.open(os.path.join(HERE, '_upload_job.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

tl = json.load(io.open(os.path.join(HERE, 'tracklist_ep17.json'), encoding='utf-8'))
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
print('발행 %s (UTC)' % PUBLISH_UTC)
print('고정댓글 %d트랙' % len(first))
