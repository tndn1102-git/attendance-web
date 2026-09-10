# -*- coding: utf-8 -*-
r"""감성가요 쇼츠에 태그 세트를 넣는다 (videos.update · 제목·설명·카테고리는 그대로 유지).
  py -3 tools\gayo_shorts_tags.py <추가태그콤마> <영상ID> [<영상ID> ...]
  예) py -3 tools\gayo_shorts_tags.py "가을 노래,기차 여행" 6orbE0If2W0 HOl7hnbdruw

왜 (2026-09-10): yt_upload_shorts.py 는 plum 벤치마크(cherry 238/238 = 태그 0)를 따라 태그를 비워 올린다.
그런데 감성가요는 EP08 쇼츠가 15개, EP09 쇼츠가 0개로 섞여 있었고, 메모리 규칙은
"쇼츠엔 본편 링크·태그 10개↑"(쇼츠 1,887회가 본편 7회로 샌 실측)이다. → 감성가요 쇼츠는 EP08 세트로 통일.
"""
import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('YT_TOKEN', 'yt_token_gayo.json')
if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from yt_auth import api

BASE = ["2000년대 가요", "2000년대 감성", "korean pop", "감성 가요", "기분좋은 노래", "밝은 노래", "설렘 노래",
        "쇼츠", "옛날 노래", "짝사랑 노래", "창작곡", "첫사랑 노래", "추억의 노래", "플레이리스트"]
if len(sys.argv) < 3:
    sys.exit(__doc__)
extra = [t.strip() for t in sys.argv[1].split(',') if t.strip()]
tags = BASE + [t for t in extra if t not in BASE]
for vid in sys.argv[2:]:
    sn = api('GET', 'videos', {'part': 'snippet', 'id': vid})['items'][0]['snippet']
    body = {'id': vid, 'snippet': {'title': sn['title'], 'description': sn['description'],
                                   'categoryId': sn['categoryId'], 'tags': tags,
                                   'defaultLanguage': sn.get('defaultLanguage', 'ko')}}
    res = api('PUT', 'videos', {'part': 'snippet'}, body)
    # 🐞 직후 GET 은 옛 값(0개)을 돌려준다(읽기 지연 — 2026-09-10 4편 중 4편). PUT 응답 + 몇 초 뒤 재조회로 판정.
    import time
    got = []
    for _ in range(6):
        time.sleep(5)
        got = api('GET', 'videos', {'part': 'snippet', 'id': vid})['items'][0]['snippet'].get('tags', [])
        if len(got) >= 10:
            break
    print('%s  PUT응답 %d개 · 재조회 %d개 %s' % (vid, len(res.get('snippet', {}).get('tags', [])), len(got),
                                          '✅' if len(got) >= 10 else '⛔'))
