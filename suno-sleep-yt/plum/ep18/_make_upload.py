# -*- coding: utf-8 -*-
r"""
EP18 업로드 잡 + 고정댓글 생성 — 2026-10-03. 형식은 EP17(`plum/ep17/_make_upload.py`) 그대로.
  py -3 plum\ep18\_make_upload.py <발행UTC>
🍂 가을 6편째 · 문형 = 공간 체감형(18번째) · 이모지 = 🍂 · 씬 = 코스모스 언덕 카페 정면(사용자 선택 A).
"""
import io, os, json, sys

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))

TITLE = 'Cafe Playlist ☕ 탁 트인 곳에 앉으니 마음에도 여백이 생겨요 🍂 Chill Cafe Music'

DESC = """코스모스 언덕 위, 문을 활짝 열어둔 카페의 플레이리스트입니다 ☕🍂

이번 편은 "마음에 여백이 생기는" 이야기예요.
사방이 탁 트인 곳에 앉으면 꽉 차 있던 머릿속에 빈자리가 생기고,
서두를 일도, 채울 일도 없이 생각이 넓게 펼쳐지는 기분.
노래는 모두 저희가 직접 쓰고 만들었고, 가사도 전부 직접 썼습니다.

활짝 접힌 유리문 너머로 분홍·하얀 코스모스가 언덕을 덮고,
테라스 계단에는 고양이가 느긋하게 앉아 바람을 맞고 있습니다.

일할 때, 책 읽을 때, 잠깐 아무것도 안 하고 싶은 날에 틀어두세요.

🎧 중간광고 없이 이어집니다.
오늘도 편하게 들어주세요 ☕

—

Original songs written and produced for this channel, looping for hours.
Soft soul-pop and bossa nova with the vocals kept low and behind the band —
made to stay in the background while you work, read, or simply sit
somewhere wide open on a hillside of cosmos and let your mind spread out. No mid-roll ads.

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
        'file': 'plum/ep18/upload/ep18_main.mp4',
        'title': TITLE,
        'description': DESC,
        'tags': [],
        'thumbnail': 'plum/ep18/bg/thumb_ep18_final.jpg',
        'categoryId': 10,
        'publishAt': PUBLISH_UTC,
    }],
}
json.dump(job, io.open(os.path.join(HERE, '_upload_job.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

tl = json.load(io.open(os.path.join(HERE, 'tracklist_ep18.json'), encoding='utf-8'))
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
