// Cloudflare Worker — 락다운시티 GM 뷰어 브릿지
//  GET /       → 뷰어 HTML
//  GET /live   → 브라우저 wss ↔ iptime ws:8080 (observer) 브릿지
//
// 브라우저는 HTTPS라서 ws://(비암호)에 직접 못 붙는다(mixed-content).
// 이 Worker가 중간에서 wss(브라우저) ↔ ws(서버) 를 이어준다.
// 서버에 붙는 즉시 {"type":"observer"} 를 보내 읽기전용으로 등록한다.

import { PAGE_HTML } from './page.js';
import { STATEMACHINE_JS } from './statemachine-src.js';

// 8080 릴레이 서버 (iptime). wrangler.toml vars 로 덮어쓸 수 있음.
const DEFAULT_UPSTREAM = 'http://fantatgc.iptime.org:8080/';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/live') {
      return handleLive(request, env);
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(PAGE_HTML, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    if (url.pathname === '/statemachine.js') {
      return new Response(STATEMACHINE_JS, {
        headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    if (url.pathname === '/healthz') {
      return new Response('ok', { headers: { 'content-type': 'text/plain' } });
    }
    return new Response('Not found', { status: 404 });
  },
};

async function handleLive(request, env) {
  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('expected websocket', { status: 426 });
  }

  const upstreamUrl = (env && env.UPSTREAM_WS) || DEFAULT_UPSTREAM;

  // 서버(8080)로 아웃바운드 웹소켓 (fetch + Upgrade)
  let upstream;
  try {
    const resp = await fetch(upstreamUrl, { headers: { Upgrade: 'websocket' } });
    upstream = resp.webSocket;
    if (!upstream) {
      return new Response('upstream did not upgrade (status ' + resp.status + ')', { status: 502 });
    }
  } catch (e) {
    return new Response('upstream connect failed: ' + (e && e.message), { status: 502 });
  }

  // 브라우저 ↔ Worker 페어
  const pair = new WebSocketPair();
  const client = pair[0];
  const browser = pair[1];

  browser.accept();
  upstream.accept();

  // 서버에 master 등록 — 이 릴레이 서버는 다중 master 허용(broadcastToMasters가
  // type==='master' 전부에 뿌림). 실폰 master를 덮어쓰지 않으므로 kick 없음(읽기 안전).
  try { upstream.send(JSON.stringify({ type: 'master' })); } catch {}
  // 뷰어에 브릿지 준비 알림(서버가 ack 안 보내도 UI가 뜨도록)
  try { browser.send(JSON.stringify({ type: 'observer_ack', bridge: true })); } catch {}

  // 서버 → 브라우저
  upstream.addEventListener('message', (ev) => {
    try { browser.send(ev.data); } catch {}
  });
  upstream.addEventListener('close', (ev) => { try { browser.close(ev.code, ev.reason); } catch {} });
  upstream.addEventListener('error', () => { try { browser.close(1011, 'upstream error'); } catch {} });

  // 브라우저 → 서버 (제어 pin_change 패스스루)
  browser.addEventListener('message', (ev) => {
    try { upstream.send(ev.data); } catch {}
  });
  browser.addEventListener('close', (ev) => { try { upstream.close(ev.code, ev.reason); } catch {} });
  browser.addEventListener('error', () => { try { upstream.close(1011, 'browser error'); } catch {} });

  return new Response(null, { status: 101, webSocket: client });
}
