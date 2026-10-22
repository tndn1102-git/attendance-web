# -*- coding: utf-8 -*-
r"""
업로드 예약 현황판 — plum music · 달빛국악 (10-08부터 두 채널만)

  py -3 tools\yt_schedule_board.py            # → suno-sleep-yt\업로드일정.html 생성
  py -3 tools\yt_schedule_board.py --open     # 생성 후 브라우저로 열기

OAuth 로 붙어서 **예약(비공개+publishAt)** 까지 읽는다. API 키로는 공개 영상만 보여 예약이 안 보인다.
토큰은 읽기만 한다(갱신된 access token 을 파일에 다시 쓰지 않음 → 다른 스크립트와 경합 없음).
만든 HTML 은 Artifact 로 그대로 올릴 수 있게 <!doctype>/<html> 없이 쓴다(브라우저는 그냥 열린다).
"""
import json, os, re, sys, io, html, datetime, urllib.request, urllib.parse, webbrowser

if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), '업로드일정.html')
KST = datetime.timezone(datetime.timedelta(hours=9))
WD = '월화수목금토일'

# key, 표시명, 토큰, 색
CHANNELS = [
    ('plum',  'plum music',  os.path.join(HERE, 'yt_token.json'),        'plum'),
    ('night', '달빛국악',     os.path.join(HERE, 'yt_token_night.json'),  'night'),
    # 2026-10-08 사장님 확정: 추억 감성가요·기업잔혹사 제작 중지 → 현황판에서 뺐다(되살리려면 .bak-20261008)
]
PAST_DAYS = 7      # 지난 며칠까지 보여줄지
SHORTS_MAX = 180   # 이 초 이하면 쇼츠
STAT_DAYS = 30     # 구독 추이 기간
RECENT_LONG, RECENT_SHORT = 3, 4   # 채널당 최근 공개 몇 편까지 조회수를 보여줄지
COMMENT_DAYS = 14  # 시청자 댓글을 며칠치 보여줄지
HIST = os.path.join(HERE, '_board_history.json')   # 날마다 구독·조회 스냅샷 → 집계 지연 메우기·전날 대비


def access_token(path):
    d = json.load(open(path, encoding='utf-8'))
    body = urllib.parse.urlencode({'client_id': d['client_id'], 'client_secret': d['client_secret'],
                                   'refresh_token': d['refresh_token'],
                                   'grant_type': 'refresh_token'}).encode()
    return json.load(urllib.request.urlopen('https://oauth2.googleapis.com/token', body))['access_token']


def get(at, ep, params):
    url = 'https://www.googleapis.com/youtube/v3/%s?%s' % (ep, urllib.parse.urlencode(params))
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + at})
    # 🐞 2026-10-08: 갓 받은 access token 이 첫 호출에서 401 을 내다가 몇 초 뒤엔 통했다(plum, 재현 2회).
    #    → 재인증해도 같았다: plum 만 호출의 약 절반이 401(구글 쪽 간헐 거절). 8회까지 다시 시도한다.
    for i in range(8):
        try:
            return json.load(urllib.request.urlopen(req))
        except urllib.error.HTTPError as e:
            if e.code != 401 or i == 7:
                raise
            import time
            time.sleep(2)


def secs(iso):
    m = re.match(r'P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', iso)
    d, h, mi, s = [int(x or 0) for x in m.groups()]
    return d * 86400 + h * 3600 + mi * 60 + s


def fetch(token_path, n=100):
    at = access_token(token_path)
    ch = get(at, 'channels', {'part': 'snippet,contentDetails,statistics', 'mine': 'true'})['items'][0]
    up = ch['contentDetails']['relatedPlaylists']['uploads']
    ids, pt = [], None
    while len(ids) < n:
        p = {'part': 'contentDetails', 'playlistId': up, 'maxResults': 50}
        if pt:
            p['pageToken'] = pt
        r = get(at, 'playlistItems', p)
        ids += [i['contentDetails']['videoId'] for i in r.get('items', [])]
        pt = r.get('nextPageToken')
        if not pt:
            break
    vids = []
    for i in range(0, len(ids), 50):
        vids += get(at, 'videos', {'part': 'snippet,status,contentDetails,statistics',
                                   'id': ','.join(ids[i:i + 50])})['items']
    out = []
    for v in vids:
        st = v['status']
        sched = st.get('publishAt')
        # 예약 안 된 비공개(구판 등)·일부공개는 일정이 아니라 뺀다
        if st['privacyStatus'] != 'public' and not sched:
            continue
        t = datetime.datetime.fromisoformat((sched or v['snippet']['publishedAt']).replace('Z', '+00:00'))
        out.append({
            'id': v['id'], 'title': v['snippet']['title'], 'at': t.astimezone(KST),
            'sched': bool(sched) and st['privacyStatus'] != 'public',
            'short': secs(v['contentDetails']['duration']) <= SHORTS_MAX,
            'views': int(v.get('statistics', {}).get('viewCount') or 0),
            'bad': st.get('uploadStatus') not in ('processed', 'uploaded'),
        })
    titles = {v['id']: v['snippet']['title'] for v in vids}
    try:
        cm = comments(at, ch['id'], titles)
    except Exception as e:
        print('  댓글 실패:', e)
        cm = None
    return {'title': ch['snippet']['title'], 'subs': int(ch['statistics'].get('subscriberCount') or 0),
            'videos': out, 'daily': daily(at), 'cid': ch['id'], 'comments': cm}


def comments(at, cid, titles):
    """채널 전체 영상의 최신 댓글 스레드 100개를 한 번에 받는다(영상별로 돌지 않는다).
    시청자가 쓴 최상위 댓글·답글마다 '내 채널 답글이 그 뒤에 달렸나'를 붙인다. 검토 대기 댓글은 따로 센다."""
    th = get(at, 'commentThreads', {'part': 'snippet,replies', 'allThreadsRelatedToChannelId': cid,
                                    'maxResults': 100, 'order': 'time'}).get('items', [])
    out = []
    for t in th:
        top = t['snippet']['topLevelComment']
        reps = t.get('replies', {}).get('comments', [])
        if t['snippet'].get('totalReplyCount', 0) > len(reps):   # replies 필드는 최대 5개뿐
            reps = get(at, 'comments', {'part': 'snippet', 'parentId': t['id'], 'maxResults': 100}).get('items', [])
        msgs = sorted([top] + reps, key=lambda c: c['snippet']['publishedAt'])
        for i, c in enumerate(msgs):
            s = c['snippet']
            out.append({'id': c['id'], 'vid': t['snippet'].get('videoId'),
                        'author': s.get('authorDisplayName', ''),
                        'aid': s.get('authorChannelId', {}).get('value'),
                        'text': s.get('textOriginal', ''),
                        'at': datetime.datetime.fromisoformat(s['publishedAt'].replace('Z', '+00:00')).astimezone(KST),
                        'reply': c is not top,
                        # 이 댓글 뒤에 같은 스레드에서 내 채널이 답했으면 답한 것으로 본다
                        'answered': any(m['snippet'].get('authorChannelId', {}).get('value') == cid
                                        for m in msgs[i + 1:])})
    held = get(at, 'commentThreads', {'part': 'id', 'allThreadsRelatedToChannelId': cid,
                                      'moderationStatus': 'heldForReview', 'maxResults': 100}).get('items', [])
    miss = sorted({c['vid'] for c in out if c['vid'] and c['vid'] not in titles})
    for i in range(0, len(miss), 50):
        for v in get(at, 'videos', {'part': 'snippet', 'id': ','.join(miss[i:i + 50])}).get('items', []):
            titles[v['id']] = v['snippet']['title']
    for c in out:
        c['title'] = titles.get(c['vid'], '')
    return {'list': out, 'held': len(held)}


def daily(at, days=STAT_DAYS):
    """채널 일별 구독 증감·조회 (Analytics). 2~3일 늦게 집계된다. 실패해도 현황판은 그대로 나가게 None."""
    end = datetime.date.today()
    q = urllib.parse.urlencode({'ids': 'channel==MINE', 'startDate': (end - datetime.timedelta(days=days)).isoformat(),
                                'endDate': end.isoformat(), 'dimensions': 'day', 'sort': 'day',
                                'metrics': 'subscribersGained,subscribersLost,views'})
    try:
        req = urllib.request.Request('https://youtubeanalytics.googleapis.com/v2/reports?' + q,
                                     headers={'Authorization': 'Bearer ' + at})
        for i in range(8):   # plum 간헐 401 대비 (get() 주석 참조)
            try:
                rows = json.load(urllib.request.urlopen(req)).get('rows', [])
                break
            except urllib.error.HTTPError as e:
                if e.code != 401 or i == 7:
                    raise
                import time
                time.sleep(2)
    except Exception as e:
        print('  analytics 실패:', e)
        return None
    return [{'d': datetime.date.fromisoformat(r[0]), 'net': int(r[1]) - int(r[2]), 'views': int(r[3])} for r in rows]


def fmt_day(d):
    return '%d/%d(%s)' % (d.month, d.day, WD[d.weekday()])


RHYTHM_DAYS = 21   # 평소 리듬 = 그 유형의 마지막 편(예약 포함)에서 거꾸로 며칠을 볼지
LEAD = 14          # 오늘 +며칠까지는 표를 최소 보여줄지(빈칸이 보이게)


def rhythm(videos, now, short):
    """'평소 나가는 요일 → 시각' 추정. 마지막 편 기준 최근 RHYTHM_DAYS 일에서 요일당 2번 이상 나온 것만.
    지금이 아니라 마지막 편에서 거꾸로 보는 이유 = 예약이 이미 새 요일로 넘어갔으면 그걸 따라가야 해서."""
    vs = [v for v in videos if v['short'] == short]
    if not vs:
        return {}
    hi = max(max(v['at'] for v in vs), now)
    lo = hi - datetime.timedelta(days=RHYTHM_DAYS)
    vs = [v for v in vs if v['at'] > lo]
    days = {}
    for v in vs:
        days.setdefault(v['at'].weekday(), set()).add(v['at'].date())
    out = {}
    for wd, ds in days.items():
        if len(ds) >= 2:
            hrs = [v['at'].hour for v in vs if v['at'].weekday() == wd]
            out[wd] = max(set(hrs), key=hrs.count)
    return out


def summarize(c, now, horizon):
    vids = c['videos']
    fut = sorted([v for v in vids if v['sched']], key=lambda v: v['at'])
    end = fut[-1]['at'] if fut else None
    res = {'fut': fut, 'end': end, 'bad': any(v['bad'] for v in fut),
           'runway': (end.date() - now.date()).days if end else -1}
    days = {(v['at'].date(), v['short']) for v in vids}
    for short, k in ((False, 'long'), (True, 'short')):
        r = rhythm(vids, now, short)
        nxt = next((v for v in fut if v['short'] == short), None)
        last = max([v['at'] for v in fut if v['short'] == short], default=None)
        gaps = []  # 평소 나가는 요일인데 비어 있는 날(오늘 남은 시각 포함)
        d = now.date()
        while d <= horizon:
            if d.weekday() in r and (d, short) not in days:
                h = r[d.weekday()]
                if d > now.date() or h > now.hour:
                    gaps.append((d, h))
            d += datetime.timedelta(days=1)
        res[k] = {'rhythm': r, 'next': nxt, 'last': last, 'gaps': gaps,
                  'n': sum(1 for v in fut if v['short'] == short)}
    # 상태 = 가장 먼저 비는 슬롯까지 남은 날
    first = min([(g, k) for k in ('long', 'short') for g in res[k]['gaps'][:1]], default=None)
    if res['bad']:
        res['level'] = 'crit'
    elif first is None:
        res['level'] = 'ok'
    else:
        left = (first[0][0] - now.date()).days
        res['level'] = 'crit' if left <= 3 else 'warn' if left <= 6 else 'ok'
    res['first_gap'] = first
    return res


def link(v):
    if v['sched']:
        return 'https://studio.youtube.com/video/%s/edit' % v['id']
    return ('https://youtube.com/shorts/%s' if v['short'] else 'https://youtu.be/%s') % v['id']


def esc(s):
    return html.escape(s, quote=True)


def kind(v):
    return '쇼츠' if v['short'] else '롱폼'


def tip(v, name):
    st = '예약 · Studio에서 열기' if v['sched'] else '공개 · 조회 %s회' % format(v['views'], ',')
    return '%s %s %s %s\n%s\n%s' % (name, kind(v), fmt_day(v['at']), v['at'].strftime('%H:%M'), v['title'], st)


def days_left(d, now):
    n = (d - now.date()).days
    return '오늘' if n == 0 else '내일' if n == 1 else '%d일 뒤' % n


def render(data, now, hist=None):
    today = now.date()
    names = {k: n for k, n, _, _ in CHANNELS}
    start = today - datetime.timedelta(days=PAST_DAYS)
    last = max([v['at'].date() for k in data for v in data[k]['videos'] if v['sched']]
               + [today + datetime.timedelta(days=LEAD)])
    last = last + datetime.timedelta(days=6 - last.weekday())

    # ── 1. 오늘·내일 나가는 것
    def day_list(d):
        items = sorted([(v, k) for k in data for v in data[k]['videos'] if v['at'].date() == d],
                       key=lambda x: x[0]['at'])
        if not items:
            return '<li class="none">예약 없음</li>'
        return ''.join(
            '<li class="%s"><a href="%s" target="_blank" rel="noopener" title="%s">'
            '<span class="mono">%s</span><span class="sw"></span><b>%s</b> <span class="kd">%s</span>'
            '<span class="tt">%s</span>%s</a></li>'
            % (k, link(v), esc(tip(v, names[k])), v['at'].strftime('%H:%M'), esc(names[k]), kind(v),
               esc(v['title']), '' if v['sched'] else '<span class="done">공개됨</span>')
            for v, k in items)
    tomorrow = today + datetime.timedelta(days=1)
    now_block = ('<section class="now"><div><h2>오늘 <span>%s</span></h2><ul>%s</ul></div>'
                 '<div><h2>내일 <span>%s</span></h2><ul>%s</ul></div></section>'
                 % (fmt_day(today), day_list(today), fmt_day(tomorrow), day_list(tomorrow)))

    # ── 2. 채널 상태(채널당 한 줄)
    rows = []
    for key, name, _, cls in CHANNELS:
        c = data[key]
        if 'error' in c:
            rows.append('<div class="st %s"><div class="nm"><span class="dot"></span>%s</div>'
                        '<div class="err" style="grid-column:2/-1">불러오기 실패 — %s</div></div>'
                        % (cls, esc(name), esc(c['error'])))
            continue
        s = c['sum']

        def nxt(k):
            x = s[k]
            if x['next']:
                v = x['next']
                return ('<span class="mono">%s %s</span><small>예약 %d편 · 끝 %s</small>'
                        % (fmt_day(v['at']), v['at'].strftime('%H:%M'), x['n'], fmt_day(x['last'])))
            if not x['rhythm']:
                return '<span class="muted">—</span><small>최근 패턴 없음</small>'
            return '<span class="bad">예약 없음</span><small>평소 %s</small>' % pattern(x['rhythm'])

        if s['bad']:
            due = '<b class="lv crit">처리 실패 영상 있음</b>'
        elif s['first_gap']:
            (d, h), k = s['first_gap']
            due = ('<b class="lv %s">%s %s %02d:00</b><small>%s · 그 전에 업로드</small>'
                   % (s['level'], '롱폼' if k == 'long' else '쇼츠', fmt_day(d), h, days_left(d, now)))
        else:
            due = '<b class="lv ok">빈칸 없음</b><small>%s까지</small>' % fmt_day(last)
        rows.append(
            '<div class="st %s lv-%s"><div class="nm"><span class="dot"></span>%s'
            '<small>구독 %s</small></div>'
            '<div><em>다음 롱폼</em>%s</div><div><em>다음 쇼츠</em>%s</div>'
            '<div class="due"><em>첫 빈칸</em>%s</div></div>'
            % (cls, s['level'], esc(name), format(c['subs'], ','), nxt('long'), nxt('short'), due))

    # ── 3. 날짜 × 채널 표
    by = {}
    for key, *_ in CHANNELS:
        for v in data[key].get('videos', []):
            by.setdefault((v['at'].date(), key), []).append(v)
    trs = []
    d = start
    n_past = 0
    while d <= last:
        past = d < today
        n_past += past
        cls = ['past' if past else '', 'today' if d == today else '',
               'wk' if d.weekday() == 0 else '', 'we' if d.weekday() >= 5 else '']
        cells = []
        for key, _, _, ccls in CHANNELS:
            c = data[key]
            items = sorted(by.get((d, key), []), key=lambda v: v['at'])
            inner = ''.join(
                '<a class="ev %s%s" href="%s" target="_blank" rel="noopener" title="%s">'
                '<i>%s</i>%s</a>'
                % ('short' if v['short'] else 'long', ' pub' if not v['sched'] else '', link(v),
                   esc(tip(v, names[key])), '쇼' if v['short'] else '롱', v['at'].strftime('%H:%M'))
                for v in items)
            tdc = [ccls]
            if 'sum' in c and not past:
                s = c['sum']
                for k, lab in (('long', '롱'), ('short', '쇼')):
                    x = s[k]
                    hole = next((h for g, h in x['gaps'] if g == d), None)
                    if hole is not None and s['end'] and d <= s['end'].date():
                        inner += ('<span class="ev gap" title="평소 이 요일에 %s이 나가는데 비어 있음">'
                                  '<i>%s</i>빈칸</span>' % ('롱폼' if k == 'long' else '쇼츠', lab))
                if s['end'] is None or d > s['end'].date():
                    tdc.append('over')
            cells.append('<td class="%s">%s</td>' % (' '.join(tdc), inner))
        label = ('<span class="dm">%d/%d</span><span class="dw">%s</span>'
                 % (d.month, d.day, WD[d.weekday()]))
        if d == today:
            label += '<span class="tag">오늘</span>'
        trs.append('<tr class="%s"><th scope="row">%s</th>%s</tr>'
                   % (' '.join(x for x in cls if x), label, ''.join(cells)))
        if d == today - datetime.timedelta(days=1):
            trs.append('<tr class="toggle"><td colspan="5"><label for="showpast">'
                       '<span class="on">지난 %d일 접기</span><span class="off">지난 %d일 펼치기</span>'
                       '</label></td></tr>' % (PAST_DAYS, PAST_DAYS))
        d += datetime.timedelta(days=1)
    # 토글 줄은 지난 날들 '위'에 와야 펼칠 때 자연스럽다 → 맨 앞으로 옮긴다
    tog = [t for t in trs if t.startswith('<tr class="toggle"')]
    trs = tog + [t for t in trs if not t.startswith('<tr class="toggle"')]

    heads = ''.join('<th scope="col" class="%s"><span class="dot"></span>%s</th>' % (cls, esc(name))
                    for _, name, _, cls in CHANNELS)
    return TEMPLATE.format(
        updated=now.strftime('%Y-%m-%d %H:%M'), now_block=now_block, status=''.join(rows),
        heads=heads, rows=''.join(trs), rdays=RHYTHM_DAYS,
        stats=render_stats(data, hist or {}, now), comments=render_comments(data, now))


# ── 구독·조회 ───────────────────────────────────────────────
def load_hist():
    try:
        return json.load(open(HIST, encoding='utf-8'))
    except Exception:
        return {}


def save_hist(h, data, now):
    """오늘 스냅샷(구독 수 · 최근 공개 영상 조회수)을 남긴다. 오래된 건 버린다."""
    today = now.date().isoformat()
    snap = {}
    for k, c in data.items():
        if 'error' in c:
            continue
        snap[k] = {'subs': c['subs'],
                   'views': {v['id']: v['views'] for v in c['videos'] if not v['sched']
                             and v['at'] > now - datetime.timedelta(days=STAT_DAYS)}}
    h[today] = {**h.get(today, {}), **snap}
    cut = (now.date() - datetime.timedelta(days=STAT_DAYS + 5)).isoformat()
    h = {d: x for d, x in h.items() if d >= cut}
    tmp = HIST + '.tmp'
    json.dump(h, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False)
    os.replace(tmp, HIST)


def prev_views(h, key, now):
    """오늘 이전 가장 최근 스냅샷의 조회수 {id: views}, 그 날짜."""
    for d in sorted(h, reverse=True):
        if d < now.date().isoformat() and key in h[d]:
            return h[d][key].get('views', {}), datetime.date.fromisoformat(d)
    return {}, None


def subs_series(c, key, h, now):
    """날짜별 구독자 수. Analytics 일별 증감을 거꾸로 쌓아 복원하고, 집계 안 된 최근 며칠은 스냅샷·현재값으로 잇는다."""
    pts = {}
    dl = c.get('daily') or []
    if dl:
        last = dl[-1]['d']
        n = h.get(last.isoformat(), {}).get(key, {}).get('subs', c['subs'])
        for r in reversed(dl):
            pts[r['d']] = n
            n -= r['net']
    for d, x in h.items():
        dd = datetime.date.fromisoformat(d)
        if key in x and (not dl or dd > dl[-1]['d']):
            pts[dd] = x[key]['subs']
    pts[now.date()] = c['subs']
    lo = now.date() - datetime.timedelta(days=STAT_DAYS)
    return sorted((d, n) for d, n in pts.items() if d >= lo)


def spark(series, w=150, hgt=34):
    if len(series) < 2:
        return ''
    d0 = series[0][0]
    span = max((series[-1][0] - d0).days, 1)
    vs = [n for _, n in series]
    lo, hi = min(vs), max(vs)
    rng = max(hi - lo, 1)
    xy = ['%.1f,%.1f' % ((d - d0).days / span * (w - 4) + 2, hgt - 3 - (n - lo) / rng * (hgt - 6))
          for d, n in series]
    cx, cy = xy[-1].split(',')
    return ('<svg class="spark" viewBox="0 0 %d %d" width="%d" height="%d" aria-hidden="true">'
            '<polyline points="%s" fill="none" stroke="currentColor" stroke-width="1.6" '
            'stroke-linejoin="round" stroke-linecap="round"/>'
            '<circle cx="%s" cy="%s" r="2.4" fill="currentColor"/></svg>'
            % (w, hgt, w, hgt, ' '.join(xy), cx, cy))


def signed(n):
    return ('+%s' % format(n, ',')) if n > 0 else ('−%s' % format(-n, ',')) if n < 0 else '±0'


def ago(t, now):
    n = (now.date() - t.date()).days
    return '오늘' if n == 0 else '어제' if n == 1 else '%d일 전' % n


def render_stats(data, h, now):
    cards, prevs = [], []
    for key, name, _, cls in CHANNELS:
        c = data[key]
        if 'error' in c:
            continue
        ser = subs_series(c, key, h, now)

        def delta(days):
            ref = now.date() - datetime.timedelta(days=days)
            old = next((n for d, n in ser if d >= ref), None)
            return None if old is None or len(ser) < 2 else c['subs'] - old
        d7, d30 = delta(7), delta(STAT_DAYS)
        dl = c.get('daily') or []
        v7 = sum(r['views'] for r in dl[-7:]) if dl else None
        pv, pday = prev_views(h, key, now)
        if pday:
            prevs.append(pday)
        pub = sorted([v for v in c['videos'] if not v['sched']], key=lambda v: v['at'], reverse=True)

        def rows(vs):
            if not vs:
                return '<li class="none">없음</li>'
            out = []
            for v in vs:
                inc = '<span class="inc"></span>'
                if v['id'] in pv:
                    dv = v['views'] - pv[v['id']]
                    inc = '<span class="inc%s">%s</span>' % (' up' if dv > 0 else '', signed(dv))
                out.append('<li><a href="%s" target="_blank" rel="noopener" title="%s">'
                           '<span class="tt">%s</span><span class="ag">%s</span>'
                           '<span class="vw mono">%s</span>%s</a></li>'
                           % (link(v), esc(tip(v, name)), esc(v['title']), ago(v['at'], now),
                              format(v['views'], ','), inc))
            return ''.join(out)

        meta = []
        if d7 is not None:
            meta.append('7일 <b>%s</b>' % signed(d7))
        if d30 is not None:
            meta.append('%d일 <b>%s</b>' % (STAT_DAYS, signed(d30)))
        if v7 is not None:
            meta.append('채널 조회 7일 %s' % format(v7, ','))
        cards.append(
            '<article class="sc %s"><header><div><div class="nm"><span class="dot"></span>%s</div>'
            '<div class="big mono">%s<span>구독</span></div><small>%s</small></div>%s</header>'
            '<h3>최근 롱폼</h3><ul>%s</ul><h3>최근 쇼츠</h3><ul>%s</ul></article>'
            % (cls, esc(name), format(c['subs'], ','), ' · '.join(meta) or '추이 데이터 없음', spark(ser),
               rows([v for v in pub if not v['short']][:RECENT_LONG]),
               rows([v for v in pub if v['short']][:RECENT_SHORT])))
    since = (' · 초록 숫자 = %s 기록보다 늘어난 조회' % fmt_day(max(prevs))) if prevs else ''
    return ('<section class="stats"><h2 class="sh">구독 추이 · 최근 영상 조회<small>그래프 = 최근 %d일 구독자 · '
            'YouTube 통계는 2~3일 늦게 집계돼 그 사이는 매일 남긴 기록으로 잇습니다%s</small></h2>'
            '<div class="cards">%s</div></section>' % (STAT_DAYS, since, ''.join(cards)))


def render_comments(data, now):
    """시청자 댓글 — 최근 COMMENT_DAYS 일. 우리 채널들(plum·달빛)이 쓴 건 빼고, 내 답글 유무를 붙인다."""
    own = {data[k].get('cid') for k in data} - {None}
    cut = now - datetime.timedelta(days=COMMENT_DAYS)
    cards, total_no, total_held = [], 0, 0
    for key, name, _, cls in CHANNELS:
        c = data[key]
        if 'error' in c:
            continue
        cm = c.get('comments')
        if cm is None:
            cards.append('<article class="sc cm %s"><header><div class="nm"><span class="dot"></span>%s</div></header>'
                         '<p class="err">댓글 불러오기 실패</p></article>' % (cls, esc(name)))
            continue
        vs = sorted([x for x in cm['list'] if x['aid'] not in own and x['at'] >= cut],
                    key=lambda x: x['at'], reverse=True)
        no = sum(1 for x in vs if not x['answered'])
        total_no += no
        total_held += cm['held']
        lis = ''.join(
            '<li><a href="https://www.youtube.com/watch?v=%s&amp;lc=%s" target="_blank" rel="noopener" title="%s">'
            '<span class="ag">%s</span><span class="who">%s%s</span><span class="tx">%s</span>'
            '<span class="vt">%s</span><b class="%s">%s</b></a></li>'
            % (x['vid'], x['id'], esc(x['text']), ago(x['at'], now), esc(x['author']),
               ' <i>답글</i>' if x['reply'] else '', esc(x['text'].replace('\n', ' ')), esc(x['title']),
               'ok' if x['answered'] else 'no', '답함' if x['answered'] else '답 없음')
            for x in vs) or '<li class="none">최근 %d일 시청자 댓글 없음</li>' % COMMENT_DAYS
        meta = '%d개 · 답 없음 <b>%d</b>' % (len(vs), no)
        if cm['held']:
            meta += ' · <b class="bad">검토 대기 %d</b>' % cm['held']
        cards.append('<article class="sc cm %s"><header><div><div class="nm"><span class="dot"></span>%s</div>'
                     '<small>%s</small></div></header><ul>%s</ul></article>' % (cls, esc(name), meta, lis))
    head = '답 없는 댓글 %d개' % total_no
    if total_held:
        head += ' · 검토 대기 %d개(Studio 댓글 › 검토 대기에서만 보임)' % total_held
    return ('<section class="cmts"><h2 class="sh">시청자 댓글<small>최근 %d일 · %s · 누르면 그 댓글로 이동</small></h2>'
            '<div class="cards">%s</div></section>' % (COMMENT_DAYS, head, ''.join(cards)))


def pattern(r):
    hs = sorted(set(r.values()))
    return '%s %s' % (''.join(WD[w] for w in sorted(r)), '·'.join('%02d:00' % h for h in hs))


TEMPLATE = '''<title>업로드 예약 현황판</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root {{
  color-scheme: light;
  --bg: #f4f5f7; --paper: #ffffff; --ink: #161b26; --muted: #6b7384; --faint: #9aa1ae;
  --line: #e2e5ea; --line2: #cfd3da; --soft: #f8f9fa; --hatch: #eceef2;
  --today: #fffbe6; --today-line: #d9a400;
  --plum: #7b3f6e; --night: #2d4f8f; --gayo: #b0621a; --gieop: #b42318;
  --ok: #1f7a4d; --warn: #9a6200; --warn-bg: #fff4d6; --crit: #c0261a; --crit-bg: #fdecea;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    color-scheme: dark;
    --bg: #0f1218; --paper: #171b23; --ink: #e7eaf0; --muted: #98a0af; --faint: #6b7384;
    --line: #262c37; --line2: #343b48; --soft: #13171e; --hatch: #1f242d;
    --today: #262210; --today-line: #d4a800;
    --plum: #d59ac5; --night: #8fb0ec; --gayo: #eaa762; --gieop: #f2877d;
    --ok: #6fd3a0; --warn: #f0c35a; --warn-bg: #2e260f; --crit: #ff8f85; --crit-bg: #361b18;
  }}
}}
:root[data-theme="dark"] {{
  color-scheme: dark;
  --bg: #0f1218; --paper: #171b23; --ink: #e7eaf0; --muted: #98a0af; --faint: #6b7384;
  --line: #262c37; --line2: #343b48; --soft: #13171e; --hatch: #1f242d;
  --today: #262210; --today-line: #d4a800;
  --plum: #d59ac5; --night: #8fb0ec; --gayo: #eaa762; --gieop: #f2877d;
  --ok: #6fd3a0; --warn: #f0c35a; --warn-bg: #2e260f; --crit: #ff8f85; --crit-bg: #361b18;
}}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: var(--bg); color: var(--ink);
  font: 14px/1.45 "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; }}
a {{ color: inherit; }}
.wrap {{ max-width: 1120px; margin: 0 auto; padding: 20px 16px 48px; display: grid; gap: 18px; }}
.wrap > * {{ min-width: 0; }}
.mono, .dm, .ev {{ font-family: "IBM Plex Mono", Consolas, monospace; font-variant-numeric: tabular-nums; }}
.plum {{ --c: var(--plum); }} .night {{ --c: var(--night); }} .gayo {{ --c: var(--gayo); }} .gieop {{ --c: var(--gieop); }}
.dot {{ width: 8px; height: 8px; border-radius: 50%; background: var(--c); display: inline-block; flex: none; }}
small {{ display: block; color: var(--muted); font-size: 12px; font-weight: 400; }}
em {{ display: block; font-style: normal; color: var(--faint); font-size: 11.5px; letter-spacing: .02em; }}
.top {{ display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px;
  border-bottom: 1px solid var(--line2); padding-bottom: 10px; }}
h1 {{ margin: 0; font-size: 19px; font-weight: 700; letter-spacing: -0.01em; }}
.upd {{ color: var(--muted); font-size: 12px; }}

/* 오늘·내일 */
.now {{ display: grid; grid-template-columns: 1fr 1fr; gap: 0; background: var(--paper);
  border: 1px solid var(--line); }}
.now > div {{ padding: 12px 14px; min-width: 0; }}
.now > div + div {{ border-left: 1px solid var(--line); }}
.now h2 {{ margin: 0 0 6px; font-size: 13px; font-weight: 700; }}
.now h2 span {{ color: var(--muted); font-weight: 400; margin-left: 4px; }}
.now ul {{ list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }}
.now li a {{ display: grid; grid-template-columns: 44px 8px auto auto 1fr auto; align-items: center; gap: 8px;
  text-decoration: none; padding: 3px 0; font-size: 13px; }}
.now li a:hover .tt {{ color: var(--ink); }}
.now .sw {{ width: 3px; height: 14px; background: var(--c); }}
.now .kd {{ color: var(--muted); font-size: 12px; }}
.now .tt {{ color: var(--faint); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }}
.now .done {{ color: var(--faint); font-size: 11.5px; }}
.now li.none {{ color: var(--faint); font-size: 13px; }}
@media (max-width: 720px) {{
  .now {{ grid-template-columns: 1fr; }}
  .now > div + div {{ border-left: 0; border-top: 1px solid var(--line); }}
  .now .tt {{ display: none; }}
}}

/* 채널 상태 */
.status {{ background: var(--paper); border: 1px solid var(--line); }}
.st {{ display: grid; grid-template-columns: 1.1fr 1fr 1fr 1.3fr; gap: 12px; padding: 10px 14px;
  align-items: start; border-left: 3px solid transparent; }}
.st + .st {{ border-top: 1px solid var(--line); }}
.st.lv-crit {{ border-left-color: var(--crit); }}
.st.lv-warn {{ border-left-color: var(--warn); }}
.nm {{ display: grid; grid-template-columns: auto 1fr; column-gap: 8px; align-items: center; font-weight: 700; }}
.nm small {{ grid-column: 2; }}
.st .mono {{ font-size: 13px; }}
.bad {{ color: var(--crit); font-weight: 700; }}
.muted {{ color: var(--faint); }}
.lv {{ font-size: 13px; }}
.lv.crit {{ color: var(--crit); }} .lv.warn {{ color: var(--warn); }} .lv.ok {{ color: var(--ok); font-weight: 500; }}
.err {{ color: var(--crit); font-size: 13px; }}
.phead {{ display: grid; grid-template-columns: 1.1fr 1fr 1fr 1.3fr; gap: 12px; padding: 7px 14px 7px 17px;
  border-bottom: 1px solid var(--line2); color: var(--muted); font-size: 12px; }}
.st em {{ display: none; }}
@media (max-width: 720px) {{
  .phead {{ display: none; }}
  .st {{ grid-template-columns: 1fr 1fr; gap: 8px 12px; }}
  .st .nm {{ grid-column: 1 / -1; }}
  .st .due {{ grid-column: 1 / -1; }}
  .st em {{ display: block; }}
}}

/* 구독·조회 */
.sh {{ margin: 0 0 8px; font-size: 13px; font-weight: 700; }}
.sh small {{ display: inline; margin-left: 8px; }}
.cards {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }}
.sc {{ background: var(--paper); border: 1px solid var(--line); border-top: 3px solid var(--c); padding: 10px 12px; min-width: 0; }}
.sc header {{ display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; margin-bottom: 4px; }}
.sc header > div {{ min-width: 0; }}
.sc .big {{ font-size: 22px; font-weight: 500; line-height: 1.2; margin-top: 2px; }}
.sc .big span {{ font-family: "IBM Plex Sans KR", sans-serif; font-size: 12px; color: var(--muted); margin-left: 4px; }}
.sc small b {{ color: var(--ink); font-weight: 500; }}
.spark {{ color: var(--c); flex: none; max-width: 45%; height: auto; }}
.sc h3 {{ margin: 8px 0 2px; font-size: 11.5px; font-weight: 500; color: var(--faint); }}
.sc ul {{ list-style: none; margin: 0; padding: 0; }}
.sc li a {{ display: grid; grid-template-columns: minmax(0, 1fr) auto auto 38px; gap: 6px; align-items: baseline;
  text-decoration: none; font-size: 12.5px; padding: 2px 0; }}
.sc li a:hover .tt {{ text-decoration: underline; }}
.sc .tt {{ overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }}
.sc .ag {{ color: var(--faint); font-size: 11.5px; }}
.sc .vw {{ font-size: 12px; text-align: right; }}
.sc .inc {{ font-family: "IBM Plex Mono", Consolas, monospace; font-size: 11px; color: var(--faint); text-align: right; }}
.sc .inc.up {{ color: var(--ok); }}
.sc li.none {{ color: var(--faint); font-size: 12px; }}
@media (max-width: 1000px) {{ .cards {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }} }}
@media (max-width: 560px) {{ .cards {{ grid-template-columns: 1fr; }} .sh small {{ display: block; margin: 2px 0 0; }} }}

/* 시청자 댓글 */
.cm ul {{ max-height: 260px; overflow-y: auto; }}
.cm li a {{ grid-template-columns: 44px minmax(0, 7em) minmax(0, 1fr) minmax(0, 9em) auto; }}
.cm .who {{ color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
.cm .who i {{ font-style: normal; font-size: 10.5px; color: var(--faint); }}
.cm .tx {{ overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
.cm .vt {{ color: var(--faint); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
.cm b.no {{ color: var(--crit); font-size: 11.5px; }}
.cm b.ok {{ color: var(--ok); font-size: 11.5px; font-weight: 500; }}
.cm li a:hover .tx {{ text-decoration: underline; }}
@media (max-width: 560px) {{ .cm li a {{ grid-template-columns: 44px minmax(0, 1fr) auto; }} .cm .who, .cm .vt {{ display: none; }} }}

/* 표 */
.bar {{ display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; color: var(--muted); font-size: 12px; }}
.bar .ev {{ pointer-events: none; }}
.bar .key {{ display: inline-flex; align-items: center; gap: 6px; }}
.sw-over {{ display: inline-block; width: 22px; height: 12px; border: 1px solid var(--line2);
  background: repeating-linear-gradient(135deg, var(--hatch) 0 3px, transparent 3px 7px); }}
.tblwrap {{ background: var(--paper); border: 1px solid var(--line); overflow-x: auto; }}
table {{ width: 100%; border-collapse: collapse; table-layout: fixed; min-width: 520px; }}
thead th {{ position: sticky; top: 0; background: var(--paper); z-index: 2; text-align: left; font-size: 12.5px;
  font-weight: 700; padding: 8px; border-bottom: 1px solid var(--line2); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; }}
thead th .dot {{ margin-right: 6px; }}
col.dcol {{ width: 76px; }}
tbody th {{ position: sticky; left: 0; z-index: 1; background: var(--paper); text-align: left; font-weight: 500;
  padding: 4px 8px; white-space: nowrap; border-right: 1px solid var(--line); }}
.dm {{ font-size: 12.5px; }} .dw {{ margin-left: 4px; color: var(--muted); font-size: 11.5px; }}
tr.we .dw {{ color: var(--crit); }}
.tag {{ margin-left: 6px; font-size: 10.5px; font-weight: 700; padding: 0 4px; background: var(--today-line); color: #1c1600; }}
td {{ padding: 3px 6px; vertical-align: middle; border-left: 1px solid var(--line); height: 30px; }}
tbody tr {{ border-top: 1px solid var(--line); }}
tbody tr.wk {{ border-top: 1px solid var(--line2); }}
tbody tr.wk th, tbody tr.wk td {{ border-top: 1px solid var(--line2); }}
td.over {{ background: repeating-linear-gradient(135deg, var(--hatch) 0 3px, transparent 3px 7px); }}
tr.today th, tr.today td {{ background-color: var(--today); }}
tr.today th {{ box-shadow: inset 3px 0 0 var(--today-line); }}
tr.past th, tr.past td {{ background: var(--soft); }}
tr.past .ev {{ opacity: .6; }}
#showpast {{ position: absolute; opacity: 0; pointer-events: none; }}
tr.past {{ display: none; }}
#showpast:checked ~ .tblwrap tr.past {{ display: table-row; }}
tr.toggle td {{ height: auto; padding: 0; border-left: 0; }}
tr.toggle label {{ display: block; padding: 5px 10px; color: var(--muted); font-size: 12px; cursor: pointer; }}
tr.toggle label:hover {{ color: var(--ink); background: var(--soft); }}
tr.toggle .on {{ display: none; }}
#showpast:checked ~ .tblwrap tr.toggle .on {{ display: inline; }}
#showpast:checked ~ .tblwrap tr.toggle .off {{ display: none; }}
#showpast:focus-visible ~ .tblwrap tr.toggle label {{ outline: 2px solid var(--today-line); }}
.ev {{ display: inline-flex; align-items: center; gap: 4px; margin: 1px 4px 1px 0; padding: 1px 6px 1px 4px;
  font-size: 11.5px; line-height: 18px; text-decoration: none; border: 1px solid var(--c); white-space: nowrap; }}
.ev i {{ font-style: normal; font-family: "IBM Plex Sans KR", sans-serif; font-size: 11px; font-weight: 700; }}
.ev.long {{ background: var(--c); color: var(--paper); }}
.ev.short {{ color: var(--c); background: transparent; }}
.ev.gap {{ border: 1px dashed var(--crit); color: var(--crit); background: var(--crit-bg); }}
.ev:hover, .ev:focus-visible {{ outline: 2px solid var(--c); outline-offset: 1px; }}
.note {{ color: var(--faint); font-size: 12px; margin: 0; }}
</style>
<div class="wrap">
  <div class="top">
    <h1>plum · 달빛국악 예약 현황판</h1>
    <span class="upd">기준 {updated} KST</span>
  </div>
  {now_block}
  <section class="status">
    <div class="phead"><span>채널</span><span>다음 롱폼</span><span>다음 쇼츠</span><span>첫 빈칸 (이 날 전에 올릴 것)</span></div>
    {status}
  </section>
  {stats}
  {comments}
  <div>
    <input type="checkbox" id="showpast">
    <div class="bar" style="margin-bottom:8px">
      <span class="key"><span class="ev long plum"><i>롱</i>08:00</span>롱폼</span>
      <span class="key"><span class="ev short plum"><i>쇼</i>19:00</span>쇼츠</span>
      <span class="key"><span class="ev gap"><i>롱</i>빈칸</span>평소 나가는 요일인데 빈 날</span>
      <span class="key"><span class="sw-over"></span>예약 소진 이후</span>
      <span>· 누르면 예약은 Studio, 공개는 유튜브 · 제목은 마우스를 올리면</span>
    </div>
    <div class="tblwrap">
      <table>
        <colgroup><col class="dcol"><col><col></colgroup>
        <thead><tr><th scope="col">날짜</th>{heads}</tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  </div>
  <p class="note">"평소"는 유형별 마지막 편(예약 포함)에서 거꾸로 {rdays}일 동안 2번 이상 나온 요일과 가장 흔한 시각으로 추정합니다. 3일 이내 빈칸은 빨강, 7일 이내는 노랑. 예약 없는 비공개·[구판]은 뺐고, 3분 이하는 쇼츠로 봅니다. 새로 고침: py -3 tools\\yt_schedule_board.py (PC 로그온 때 자동)</p>
</div>
'''


def main():
    now = datetime.datetime.now(KST)
    data = {}
    for key, name, tok, _ in CHANNELS:
        try:
            data[key] = fetch(tok)
        except Exception as e:
            data[key] = {'error': str(e), 'videos': []}
            print(key, '실패:', e)
    failed = sum(1 for k in data if 'error' in data[k])
    if failed == len(CHANNELS):
        # 부팅 직후 네트워크가 아직 없으면 전부 실패한다 — 멀쩡한 기존 페이지를 에러 페이지로 덮지 않는다
        print('전 채널 실패 — 기존 페이지 유지')
        sys.exit(2)
    horizon = max([v['at'].date() for k in data for v in data[k]['videos'] if v['sched']]
                  + [now.date() + datetime.timedelta(days=LEAD)])
    horizon += datetime.timedelta(days=6 - horizon.weekday())
    for key, *_ in CHANNELS:
        c = data[key]
        if 'error' in c:
            continue
        c['sum'] = s = summarize(c, now, horizon)
        print('%-6s %s  예약 %d건 (끝 %s) · 상태 %s' % (key, c['title'], len(s['fut']),
                                                 fmt_day(s['end']) if s['end'] else '-', s['level']))
    hist = load_hist()
    open(OUT, 'w', encoding='utf-8').write(render(data, now, hist))
    save_hist(hist, data, now)
    print('→', OUT)
    if '--open' in sys.argv:
        webbrowser.open('file:///' + OUT.replace('\\', '/'))
    sys.exit(1 if failed else 0)   # 일부 실패면 1 → schedule_board.cmd 가 잠시 뒤 다시 시도


if __name__ == '__main__':
    main()
