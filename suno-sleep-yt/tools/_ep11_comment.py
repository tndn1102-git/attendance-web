# -*- coding: utf-8 -*-
r"""
EP11 고정댓글 자동 게시 — 발행(2026-09-30 07:00 KST) 직후 실행.

예약(private) 상태에서는 `commentThreads.insert` 가 403 이므로 발행 후에만 성공한다.
윈도우 작업 스케줄러(`gayo-ep09-comment`)가 `_ep09_comment.cmd` 를 통해 이 파일을 호출한다.

🐞 왜 .cmd 가 아니라 .py 에 로직을 두는가 (2026-08-08 실측):
   **cmd.exe 는 배치 파일을 ANSI(CP949)로 읽는다.** 파일이 UTF-8 이면 한글 주석·경로가 깨져
   각 줄이 엉뚱한 명령으로 실행된다. → **.cmd 는 ASCII 만**, 한글은 전부 이 파일에서.
"""
import io, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
os.environ['YT_TOKEN'] = 'yt_token_gayo.json'

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 🔴 업로드 후 실제 영상 ID 로 채운다. 비어 있으면 그냥 죽지 말고 **소리내어** 실패시킨다 —
#    조용히 실패하면 발행일 아침에 아무도 모른다(밤 채널에서 26시간 멈춤을 못 본 사고가 있었다).
VID = 'WQimetUBqok'   # 2026-09-10 업로드 · 09-30 07:00 예약
BODY = os.path.join(ROOT, 'ballad90', 'ep11', 'upload', '_고정댓글.txt')

print('=' * 60)
print('EP11 고정댓글 · %s' % time.strftime('%Y-%m-%d %H:%M:%S'))

if not VID:
    sys.exit('🚨 VID 가 비어 있다 — 업로드 후 tools\\_ep09_comment.py 의 VID 를 채울 것.')
if not os.path.exists(BODY):
    sys.exit('🚨 고정댓글 본문이 없다: %s' % BODY)

import yt_auth  # noqa: E402

# 1) 공개 상태 확인 — 아직 예약이면 댓글이 403 이라 의미가 없다
r = yt_auth.api('GET', 'videos', {'part': 'status', 'id': VID})
if not r.get('items'):
    sys.exit('🚨 영상이 조회되지 않는다 (삭제·거부 확인 필요)')
priv = r['items'][0]['status']['privacyStatus']
print('공개상태: %s' % priv)
if priv != 'public':
    sys.exit('아직 공개 전이다 (%s). 발행 후 다시 실행할 것.' % priv)

# 2) 이미 달려 있으면 중복 게시하지 않는다 (작업이 재실행될 수 있다)
try:
    ex = yt_auth.api('GET', 'commentThreads',
                     {'part': 'snippet', 'videoId': VID, 'maxResults': 20})
    for it in ex.get('items', []):
        a = it['snippet']['topLevelComment']['snippet']
        if '수록곡' in a.get('textOriginal', ''):
            print('이미 게시됨: %s — 중복 방지로 종료' % it['id'])
            sys.exit(0)
except Exception as e:
    print('기존 댓글 조회 실패(계속 진행): %s' % str(e)[:120])

text = open(BODY, encoding='utf-8').read().strip()
res = yt_auth.api('POST', 'commentThreads', {'part': 'snippet'},
                  {'snippet': {'videoId': VID,
                               'topLevelComment': {'snippet': {'textOriginal': text}}}})
print('✅ 댓글 작성 완료: %s' % res.get('id'))
print('   https://youtu.be/%s' % VID)
print('⚠️ 고정(Pin)은 Advanced features 인증 전까지 불가 — 인증 후 tools\\yt_pin_switch.js 로 처리')
