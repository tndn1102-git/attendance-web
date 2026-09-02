# -*- coding: utf-8 -*-
r"""
cherry music 배경 전수조사 az7 (2026-09-02) — 최신 롱폼 50편의 썸네일(=본편 배경, 20편 전수로 확정된 등식) 수집.
  py -3 research\cherry\az7\fetch_thumbs.py
"""
import os, sys, io, json, datetime, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = r'D:\test3\suno-sleep-yt\tools'
sys.path.insert(0, TOOLS)
os.environ.setdefault('YT_TOKEN', 'yt_token.json')
import yt_auth

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

UPLOADS = 'UUbGe5jill2XY05_TGvtKiPQ'   # cherry music uploads
vids, token = [], None
while len(vids) < 120:
    p = {'part': 'contentDetails', 'playlistId': UPLOADS, 'maxResults': 50}
    if token: p['pageToken'] = token
    r = yt_auth.api('GET', 'playlistItems', p)
    vids += [i['contentDetails']['videoId'] for i in r.get('items', [])]
    token = r.get('nextPageToken')
    if not token: break

# 길이·날짜 → 롱폼(>=30분)만
meta = []
for i in range(0, len(vids), 50):
    r = yt_auth.api('GET', 'videos', {'part': 'contentDetails,snippet', 'id': ','.join(vids[i:i+50])})
    for it in r.get('items', []):
        d = it['contentDetails']['duration']
        # PT#H#M#S 파싱
        h = m = s = 0
        num = ''
        for c in d.replace('PT', ''):
            if c.isdigit(): num += c
            elif c == 'H': h = int(num); num = ''
            elif c == 'M': m = int(num); num = ''
            elif c == 'S': s = int(num); num = ''
        sec = h*3600 + m*60 + s
        if sec < 1800: continue
        meta.append({'id': it['id'], 'published': it['snippet']['publishedAt'][:10],
                     'title': it['snippet']['title'], 'dur_h': round(sec/3600, 2),
                     'thumb': it['snippet']['thumbnails'].get('maxres', it['snippet']['thumbnails']['high'])['url']})

meta.sort(key=lambda x: x['published'], reverse=True)
meta = meta[:50]
json.dump(meta, io.open(os.path.join(HERE, 'longform50.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, v in enumerate(meta):
    out = os.path.join(HERE, 'thumbs', '%02d_%s_%s.jpg' % (k, v['published'], v['id']))
    if not os.path.exists(out):
        urllib.request.urlretrieve(v['thumb'], out)
    print('%02d %s %.1fh %s' % (k, v['published'], v['dur_h'], v['title'][:48]))
print('완료:', len(meta), '편')
