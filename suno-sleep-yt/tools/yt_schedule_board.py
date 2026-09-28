# -*- coding: utf-8 -*-
r"""
4채널 업로드 예약 현황판 — plum music · 달빛국악 · 추억 감성가요 · 기업잔혹사

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
    ('gayo',  '추억 감성가요', os.path.join(HERE, 'yt_token_gayo.json'),   'gayo'),
    ('gieop', '기업잔혹사',   r'D:\test3\gieopjanhoksa\config\token.json', 'gieop'),
]
PAST_DAYS = 7      # 지난 며칠까지 보여줄지
SHORTS_MAX = 180   # 이 초 이하면 쇼츠


def access_token(path):
    d = json.load(open(path, encoding='utf-8'))
    body = urllib.parse.urlencode({'client_id': d['client_id'], 'client_secret': d['client_secret'],
                                   'refresh_token': d['refresh_token'],
                                   'grant_type': 'refresh_token'}).encode()
    return json.load(urllib.request.urlopen('https://oauth2.googleapis.com/token', body))['access_token']


def get(at, ep, params):
    url = 'https://www.googleapis.com/youtube/v3/%s?%s' % (ep, urllib.parse.urlencode(params))
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + at})
    return json.load(urllib.request.urlopen(req))


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
    return {'title': ch['snippet']['title'], 'subs': int(ch['statistics'].get('subscriberCount') or 0),
            'videos': out}


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


def render(data, now):
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
        heads=heads, rows=''.join(trs), rdays=RHYTHM_DAYS)


def pattern(r):
    hs = sorted(set(r.values()))
    return '%s %s' % (''.join(WD[w] for w in sorted(r)), '·'.join('%02d:00' % h for h in hs))


TEMPLATE = '''<title>4채널 예약 현황판</title>
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
    <h1>4채널 예약 현황판</h1>
    <span class="upd">기준 {updated} KST</span>
  </div>
  {now_block}
  <section class="status">
    <div class="phead"><span>채널</span><span>다음 롱폼</span><span>다음 쇼츠</span><span>첫 빈칸 (이 날 전에 올릴 것)</span></div>
    {status}
  </section>
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
        <colgroup><col class="dcol"><col><col><col><col></colgroup>
        <thead><tr><th scope="col">날짜</th>{heads}</tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  </div>
  <p class="note">"평소"는 유형별 마지막 편(예약 포함)에서 거꾸로 {rdays}일 동안 2번 이상 나온 요일과 가장 흔한 시각으로 추정합니다. 3일 이내 빈칸은 빨강, 7일 이내는 노랑. 예약 없는 비공개·[구판]은 뺐고, 3분 이하는 쇼츠로 봅니다. 새로 고침: py -3 tools\\yt_schedule_board.py</p>
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
    open(OUT, 'w', encoding='utf-8').write(render(data, now))
    print('→', OUT)
    if '--open' in sys.argv:
        webbrowser.open('file:///' + OUT.replace('\\', '/'))
    sys.exit(1 if failed else 0)   # 일부 실패면 1 → schedule_board.cmd 가 잠시 뒤 다시 시도


if __name__ == '__main__':
    main()
