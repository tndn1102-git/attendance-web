# -*- coding: utf-8 -*-
r"""
YouTube OAuth 2.0 인증 (표준 라이브러리만 사용, pip 설치 불필요)

사용법:
  1) Google Cloud Console에서 OAuth 클라이언트 ID(데스크톱 앱)를 만들고
     client_secret json을 D:\test3\suno-sleep-yt\tools\client_secret.json 으로 저장
  2) py -3 tools\yt_auth.py
  3) 브라우저가 뜨면 채널 소유 계정으로 로그인 → 허용
  → tools\yt_token.json 에 refresh token 저장 (이후 자동 갱신)

권한 범위: youtube (읽기+쓰기). 채널 브랜딩 수정·영상 공개범위 변경에 필요.
"""
import json, os, sys, io, urllib.parse, urllib.request, webbrowser, secrets, threading
from http.server import HTTPServer, BaseHTTPRequestHandler

# ⚠️ 이미 UTF-8 이면 다시 감싸지 말 것.
#    두 번 감싸면 앞 래퍼가 GC 되며 공용 buffer 를 닫아버려서
#    이후 print 가 전부 "ValueError: I/O operation on closed file" 로 죽는다.
#    (yt_rebrand.py 가 이걸로 실패했음)
if (getattr(sys.stdout, 'encoding', '') or '').lower().replace('-', '') != 'utf8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
SECRET = os.path.join(HERE, 'client_secret.json')
# ⚠️ 채널이 2개다(밤 Ember&Rain / 낮 plum music). 토큰은 채널당 1개 —
#    환경변수로 갈아끼운다. 기본값은 기존 그대로라 옛 스크립트는 영향 없음.
#      YT_TOKEN = 토큰 파일 경로   (예: yt_token_night.json)
#      YT_SCOPE = 공백 구분 스코프 (Analytics 쓰려면 yt-analytics.readonly 추가)
TOKEN = os.environ.get('YT_TOKEN') or os.path.join(HERE, 'yt_token.json')
if not os.path.isabs(TOKEN):
    TOKEN = os.path.join(HERE, TOKEN)
# 🔴 2026-09-02: 기본 스코프에 force-ssl 포함 — 빠지면 업로드는 되고 "댓글만 조용히 403" 난다.
#    EP03·EP04(08-18)에 이어 EP07·EP08(08-28·08-31)이 같은 함정으로 나흘+ 댓글 없이 공개됐다.
SCOPE = os.environ.get('YT_SCOPE') or ('https://www.googleapis.com/auth/youtube '
    'https://www.googleapis.com/auth/youtube.force-ssl '
    'https://www.googleapis.com/auth/yt-analytics.readonly')
AUTH_URI = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_URI = 'https://oauth2.googleapis.com/token'

_result = {}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        _result.update({k: v[0] for k, v in q.items()})
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        ok = 'code' in _result
        msg = '인증 완료. 이 창을 닫고 터미널로 돌아가세요.' if ok else '인증 실패: ' + _result.get('error', 'unknown')
        self.wfile.write(('<html><meta charset="utf-8"><body style="font-family:sans-serif;padding:60px;background:#111;color:#eee">'
                          '<h2>%s</h2></body></html>' % msg).encode('utf-8'))
    def log_message(self, *a):
        pass


def load_secret():
    if not os.path.exists(SECRET):
        sys.exit('client_secret.json 이 없습니다 -> %s\n'
                 'Google Cloud Console에서 OAuth 클라이언트 ID(데스크톱 앱)를 만들어 저장하세요.' % SECRET)
    d = json.load(open(SECRET, encoding='utf-8'))
    node = d.get('installed') or d.get('web')
    if not node:
        sys.exit('client_secret.json 형식이 예상과 다릅니다(installed/web 키 없음).')
    return node['client_id'], node['client_secret']


def post(url, data):
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    return json.load(urllib.request.urlopen(req))


def authorize():
    cid, csec = load_secret()
    srv = HTTPServer(('127.0.0.1', 0), Handler)
    port = srv.server_address[1]
    redirect = 'http://127.0.0.1:%d/' % port
    state = secrets.token_urlsafe(16)
    url = AUTH_URI + '?' + urllib.parse.urlencode({
        'client_id': cid, 'redirect_uri': redirect, 'response_type': 'code',
        'scope': SCOPE, 'access_type': 'offline', 'prompt': 'consent', 'state': state,
    })
    # 승인 URL을 파일로도 남긴다 — 백그라운드 실행 시 stdout 이 안 잡히는 경우가 있어서
    # (실제로 겪음: 콜백 포트를 알 수 없어 사용자가 옛 탭에서 승인 → 코드가 유실됨)
    with open(os.path.join(HERE, '_auth_url.txt'), 'w', encoding='utf-8') as f:
        f.write(url + '\n')
    print('브라우저에서 승인하세요. 창이 안 뜨면 아래 주소를 직접 여세요:\n', url)
    threading.Thread(target=webbrowser.open, args=(url,), daemon=True).start()
    srv.handle_request()
    if _result.get('state') != state:
        sys.exit('state 불일치 — 중단합니다.')
    if 'code' not in _result:
        sys.exit('인증 코드 수신 실패: %s' % _result)
    tok = post(TOKEN_URI, {'code': _result['code'], 'client_id': cid, 'client_secret': csec,
                           'redirect_uri': redirect, 'grant_type': 'authorization_code'})
    tok['client_id'], tok['client_secret'] = cid, csec
    json.dump(tok, open(TOKEN, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('저장 완료 ->', TOKEN)
    return tok


def access_token():
    """유효한 access token 반환 (없으면 인증, 만료면 refresh)."""
    if not os.path.exists(TOKEN):
        return authorize()['access_token']
    t = json.load(open(TOKEN, encoding='utf-8'))
    if 'refresh_token' not in t:
        return authorize()['access_token']
    new = post(TOKEN_URI, {'refresh_token': t['refresh_token'], 'client_id': t['client_id'],
                           'client_secret': t['client_secret'], 'grant_type': 'refresh_token'})
    t.update(new)
    json.dump(t, open(TOKEN, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return t['access_token']


def api(method, endpoint, params=None, body=None):
    """OAuth 인증된 YouTube Data API 호출."""
    url = 'https://www.googleapis.com/youtube/v3/' + endpoint
    if params:
        url += '?' + urllib.parse.urlencode(params)
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', 'Bearer ' + access_token())
    if data:
        req.add_header('Content-Type', 'application/json; charset=utf-8')
    try:
        r = urllib.request.urlopen(req)
        raw = r.read()
        return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.stderr.write('HTTP %s %s\n%s\n' % (e.code, e.reason, e.read().decode('utf-8', 'replace')[:900]))
        raise


def upload_media(endpoint, filepath, mime='image/png', params=None):
    """미디어 업로드(uploadType=media). 예: channelBanners/insert"""
    p = dict(params or {})
    p['uploadType'] = 'media'
    url = 'https://www.googleapis.com/upload/youtube/v3/' + endpoint + '?' + urllib.parse.urlencode(p)
    data = open(filepath, 'rb').read()
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Authorization', 'Bearer ' + access_token())
    req.add_header('Content-Type', mime)
    req.add_header('Content-Length', str(len(data)))
    try:
        r = urllib.request.urlopen(req)
        raw = r.read()
        return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.stderr.write('HTTP %s %s\n%s\n' % (e.code, e.reason, e.read().decode('utf-8', 'replace')[:900]))
        raise


if __name__ == '__main__':
    authorize()
    me = api('GET', 'channels', {'part': 'snippet,statistics', 'mine': 'true'})
    for c in me.get('items', []):
        print('인증된 채널: %s | %s | 구독 %s | 영상 %s' % (
            c['snippet']['title'], c['snippet'].get('customUrl', '-'),
            c['statistics'].get('subscriberCount'), c['statistics'].get('videoCount')))
