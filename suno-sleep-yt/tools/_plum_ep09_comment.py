# -*- coding: utf-8 -*-
r"""
plum EP09 고정댓글 자동 게시 — 발행(2026-09-04 08:00 KST) 직후 실행.

예약(private) 상태에서는 `commentThreads.insert` 가 403 이므로 발행 후에만 성공한다.
윈도우 작업 스케줄러(`plum-ep09-comment`)가 `_plum_ep09_comment.cmd` 를 통해 호출한다.
가요 채널의 `_ep08_comment.py` 패턴을 그대로 가져왔다(.cmd 는 ASCII 만, 한글은 .py 에).

⚠️ 토큰 = 기본 yt_token.json (plum). YT_TOKEN 을 건드리지 말 것 —
   2026-08-07 에 채널을 잘못 잡아 가요 채널로 인증된 사고가 있었다.
"""
import io, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
# YT_TOKEN 설정하지 않음 → yt_auth 기본 = yt_token.json (plum music)

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 🔴 업로드 후 실제 영상 ID 로 채운다. 비어 있으면 소리내어 실패한다.
VID = 'jTWRk9367LE'
BODY = os.path.join(ROOT, 'plum', 'ep09', '_고정댓글만.txt')

print('=' * 60)
print('plum EP09 고정댓글 · %s' % time.strftime('%Y-%m-%d %H:%M:%S'))

if not VID:
    sys.exit('🚨 VID 가 비어 있다 — 업로드 후 tools\\_plum_ep09_comment.py 의 VID 를 채울 것.')
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
        if '직접 만든 곡' in a.get('textOriginal', ''):
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
print('→ 이어서 .cmd 가 yt_pin_comment.js 로 고정을 시도한다 (실패해도 댓글은 살아 있음)')
