// "폰 2대 + 뷰어가 하나의 상태를 공유" 검증
//  H. 시간 세팅(v139): 서버 무수정 경로 '__settime__' + 적용 확인 ack
//  A. 폰 패치(websocket.v139.js): 페이지 로드당 1번만 __reset__ 통보 (재연결에는 안 보냄)
//  B. 뷰어(page.js): __reset__ 수신 시 진행·타이머·SNS/DM·카운터가 모두 준비상태로 되돌아감
//  C. 폰↔폰: 한 대 초기화 → 다른 대도 초기화(무한루프 없음) / 터치 활성화 → 다른 대에 전파
//  D. 뷰어: 폰별 보고를 대수로 집계 (2대 중 몇 대 활성)
import vm from 'vm';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const PHONE_SRC = readFileSync(join(root, 'phone-patch', 'websocket.v141.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error('  ✗ ' + msg); } };

/* ---------- 공용 스텁 ---------- */
function fakeEl(id, onAppend) {
  const set = new Set(), listeners = [], kids = new Map();
  const el = {
    id, textContent: '', value: '', className: '', style: {}, onclick: null, src: '',
    _children: [],
    classList: {
      add: c => set.add(c), remove: c => set.delete(c),
      toggle: (c, on) => { on ? set.add(c) : set.delete(c); }, contains: c => set.has(c),
    },
    // 선택자별로 자식을 하나씩 만들어 기억한다 (el.querySelector('.n').textContent 검사용)
    querySelector(sel) { if (!kids.has(sel)) kids.set(sel, fakeEl(sel, onAppend)); return kids.get(sel); },
    appendChild(child) { el._children.push(child); if (onAppend) onAppend(child); },
    addEventListener(type, fn) { listeners.push({ type, fn }); },
    // 클릭 1회 발생 → 등록 순서대로 리스너 호출. app.js 핸들러 차단 여부를 ev 로 관찰한다.
    _click() {
      const ev = { stopped: false, stopImmediatePropagation() { this.stopped = true; } };
      listeners.filter(l => l.type === 'click').forEach(l => l.fn(ev));
      return ev;
    },
    // 붙어 있는 자식들의 내용 (브라우저의 innerHTML 읽기 대용)
    get _html() { return el._children.map(c => c.innerHTML || c.textContent || '').join(' '); },
  };
  // innerHTML = '' 로 비우면 자식도 사라지는 실제 동작을 흉내낸다
  let _inner = '';
  Object.defineProperty(el, 'innerHTML', {
    get() { return _inner; },
    set(v) { _inner = v; if (!v) el._children.length = 0; },
  });
  return el;
}
function fakeDoc() {
  const map = new Map();
  // appendChild 로 붙인 요소는 id 로 조회되도록 등록한다 (동적으로 만든 힌트 개수 표시 검사용)
  const reg = child => { if (child && child.id) map.set(child.id, child); };
  const mk = id => fakeEl(id, reg);
  const doc = {
    _map: map,
    getElementById: id => { if (!map.has(id)) map.set(id, mk(id)); return map.get(id); },
    querySelector: () => mk('q'),
    createElement: t => mk(t),
    addEventListener() {},
  };
  doc.head = mk('head');
  doc.body = mk('body');
  return doc;
}
// setTimeout/setInterval 을 붙잡아 두는 가짜 타이머 (예약이 실제로 취소되는지, 주기 콜백을 수동으로 돌리기 위함)
function fakeTimers() {
  const pending = new Map(), intervals = [];
  let seq = 0;
  return {
    pending, intervals,
    setTimeout: (fn, ms) => { const id = ++seq; pending.set(id, { fn, ms }); return id; },
    clearTimeout: id => { pending.delete(id); },
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return ++seq; },
    clearInterval: () => {},
    // 주기 ms 인 인터벌 콜백을 1회 실행
    runIntervals: ms => intervals.filter(i => i.ms === ms).forEach(i => i.fn()),
  };
}

/* ---------- 가짜 힌트폰 1대 ---------- */
function makePhone(sessionStore) {
  const sockets = [], loadHandlers = [];
  const store = sessionStore || new Map();   // 새로고침을 견디는 sessionStorage (인스턴스 간 공유 가능)
  const reloads = { n: 0 };
  class FakeWS {
    constructor(url) {
      this.url = url; this.readyState = 1; this.sent = [];
      this.onopen = this.onmessage = this.onclose = this.onerror = null;
      sockets.push(this);
    }
    send(s) { this.sent.push(JSON.parse(s)); }
    close() {}
  }
  FakeWS.OPEN = 1;
  const t = fakeTimers();
  const doc = fakeDoc();
  const resetCalls = { n: 0 };
  const sandbox = {
    WebSocket: FakeWS, document: doc, console: { log() {}, error() {} },
    setTimeout: t.setTimeout, clearTimeout: t.clearTimeout,
    setInterval: t.setInterval, clearInterval: t.clearInterval,
    Math, JSON, Date,
    BroadcastChannel: class { constructor() { this.onmessage = null; } },
    location: { reload() { reloads.n++; } },
    sessionStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    // app.js 쪽 전역 (패치는 typeof 가드로 접근한다)
    isSNSActivated: false, isSNSDMActivated: false,
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = (ev, fn) => { if (ev === 'load') loadHandlers.push(fn); };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(PHONE_SRC, ctx);
  // app.js 가 나중에 로드되며 전역 함수를 정의하는 상황 재현 → 그 뒤에 load 핸들러가 감싼다
  sandbox.window.resetScreen = function () { resetCalls.n++; };
  sandbox.__detailCalls = 0;
  sandbox.window.showHintDetail = function () { sandbox.__detailCalls++; };
  sandbox.window.showHintInput = function () {};
  sandbox.window.showHintSolution = function () {};
  sandbox.window.showHintDetailFromSolution = function () {};
  sandbox.window.resetHintModal = function () {};
  sandbox.window.showHint = function () {};
  loadHandlers.forEach(fn => fn());

  const p = {
    ctx, sandbox, doc, sockets, timers: t, resetCalls, reloads, store,
    // 좌측 하단 숨은 영역 탭 (기본 10회 = 새로고침 제스처)
    tap(n = 1) { let ev; for (let i = 0; i < n; i++) ev = doc.getElementById('refreshTouchArea')._click(); return ev; },
    // 대기 중인 setTimeout 중 주어진 지연(ms)짜리를 실행
    fireTimeout(ms) { t.pending.forEach((v, k) => { if (v.ms === ms) { t.pending.delete(k); v.fn(); } }); },
    id: () => vm.runInContext('_gmPhoneId', ctx),
    connect() { vm.runInContext('connectWebSocket()', ctx); const s = sockets[sockets.length - 1]; s.onopen(); return s; },
    ws: () => sockets[sockets.length - 1],
    sent: () => sockets[sockets.length - 1].sent,
    recv(msg) { vm.runInContext('handleWebSocketMessage(' + JSON.stringify(msg) + ')', ctx); },
    // 터치로 켜는 것 = app.js 가 전역 플래그를 직접 바꾸는 것
    touchSNS() { sandbox.isSNSActivated = true; },
    touchDM() { sandbox.isSNSDMActivated = true; },
    openDMTab() { sandbox.isSNSDMActivated = false; },  // clickDM(): 알림 플래그 소비
    tickPropagate() { t.runIntervals(1000); },
    tickStatus() { t.runIntervals(5000); },
  };
  return p;
}
// 릴레이 서버(패치본) 흉내: master 가 보낸 simPin → 모든 master 에게 update 로 브로드캐스트
function relay(senders, receivers) {
  const out = [];
  senders.forEach(s => {
    s.sent().filter(m => m.type === 'simPin').forEach(m => {
      out.push({ type: 'update', slaveID: m.slaveID, arduinoID: m.arduinoID, updates: [{ pin: m.pin, state: m.state }] });
    });
    s.sent().length = 0;
  });
  out.forEach(m => receivers.forEach(r => r.recv(m)));
  return out;
}

/* ---------- 가짜 GM 뷰어 1개 (page.js 의 인라인 스크립트를 그대로 돌린다) ---------- */
const SM_CODE = readFileSync(join(root, 'src', 'statemachine.js'), 'utf8');
const PAGE_CODE = (() => {
  const pageMod = readFileSync(join(root, 'src', 'page.js'), 'utf8');
  const html = vm.runInNewContext(pageMod.replace('export const PAGE_HTML', 'PAGE_HTML') + '; PAGE_HTML', {});
  const i = html.lastIndexOf('<script>');
  return html.slice(i + '<script>'.length, html.lastIndexOf('</script>'));
})();
function makeViewer() {
  class FakeWS {
    constructor() { this.readyState = 1; this.sent = []; }
    send(s) { this.sent.push(JSON.parse(s)); }
    close() {}
  }
  FakeWS.OPEN = 1;
  const t = fakeTimers();
  const doc = fakeDoc();
  const sandbox = {
    WebSocket: FakeWS, document: doc, console: { log() {}, error() {} },
    location: { protocol: 'http:', host: '127.0.0.1:8787' },
    setTimeout: t.setTimeout, clearTimeout: t.clearTimeout,
    setInterval: t.setInterval, clearInterval: t.clearInterval,
    alert() {}, confirm: () => true, Date, Map, JSON,
  };
  sandbox.self = sandbox; sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(SM_CODE, ctx);        // LDC 정의
  vm.runInContext(PAGE_CODE, ctx);      // 뷰어 스크립트
  const msg = o => vm.runInContext('handleMessage(' + JSON.stringify(o) + ')', ctx);
  return {
    ctx, sandbox, doc, timers: t, msg,
    get: expr => vm.runInContext(expr, ctx),
    upd: (slaveID, arduinoID, pin, state = 'on') =>
      msg({ type: 'update', slaveID, arduinoID, updates: [{ pin, state }] }),
    reset: () => msg({ type: 'update', slaveID: '__reset__', arduinoID: 'boot-zzzz', updates: [{ pin: 1, state: 'on' }] }),
    // 슬레이브가 5초마다 다시 뿌리는 전체 핀 스냅샷
    snapshot: (slaveID, arduinoID, pin, state) =>
      msg({ type: 'slaveRegister', slaveID, arduinos: [{ arduinoID, pins: [{ pin, state }] }] }),
  };
}

/* ================= A. 폰 패치: 초기화 통보 1회 ================= */
(function phonePatch() {
  const p = makePhone();

  // 1) 최초 연결 = 폰 부팅(프로그램 초기화) → master 등록 + __reset__(pin 1) 1회
  const s1 = p.connect();
  const resets1 = s1.sent.filter(m => m.slaveID === '__reset__');
  ok(s1.sent[0] && s1.sent[0].type === 'master', 'A1 첫 메시지는 master 등록');
  ok(resets1.length === 1, 'A2 부팅 시 __reset__ 통보 1회');
  ok(resets1[0] && resets1[0].type === 'simPin' && resets1[0].pin === 1 && resets1[0].state === 'on',
    'A3 __reset__ 은 simPin/pin=1/on 형식');
  ok(resets1[0].arduinoID === 'boot-' + p.id(), 'A4 __reset__ 에 폰 식별자 포함');

  // 2) 재연결(네트워크 끊김 복구) → __reset__ 재전송 없음 (게임 중 화면이 지워지면 안 됨)
  const s2 = p.connect();
  ok(s2.sent.filter(m => m.slaveID === '__reset__').length === 0,
    'A5 ★ 재연결에는 __reset__ 를 다시 보내지 않는다');
  ok(s2.sent.some(m => m.type === 'master'), 'A6 재연결 시 master 재등록은 유지');

  // 3) resetScreen() 헬퍼도 초기화로 통보(pin 2), 원래 동작은 그대로 수행
  s2.sent.length = 0;
  p.sandbox.window.resetScreen();
  const resets2 = s2.sent.filter(m => m.slaveID === '__reset__');
  ok(p.resetCalls.n === 1, 'A7 resetScreen 원래 동작 보존');
  ok(resets2.length === 1 && resets2[0].pin === 2, 'A8 resetScreen() → __reset__(pin 2) 통보');

  // 4) 게임 핀은 그대로, __ 접두 채널은 게임 로직에 안 들어감
  const checked = [];
  p.sandbox.checkPinStatus = (s, a, pin, st) => checked.push([s, a, pin, st]);
  p.recv({ type: 'update', slaveID: '__time__', arduinoID: 't', updates: [{ pin: 100, state: 'on' }] });
  ok(checked.length === 0, 'A9 폰은 내부채널을 게임 로직에 넣지 않는다');
  p.recv({ type: 'update', slaveID: 'streetmega', arduinoID: 'streetmega-2', updates: [{ pin: 22, state: 'on' }] });
  ok(checked.length === 1 && checked[0][2] === 22, 'A10 실제 게임 핀은 정상 전달');

  // 5) 상태 보고에 폰 식별자
  s2.sent.length = 0;
  p.tickStatus();
  const st = s2.sent.find(m => m.slaveID === '__status__');
  ok(st && st.arduinoID === 'snsdm-' + p.id(), 'A11 __status__ 에 폰 식별자 포함');
})();

/* ================= C. 폰 2대 공유 상태 ================= */
(function twoPhones() {
  const A = makePhone(), B = makePhone();
  A.connect(); B.connect();
  ok(A.id() !== B.id(), 'C1 두 폰의 식별자가 다르다');

  // --- 초기화 전파: A 부팅 통보 → B 도 "새로고침"으로 초기화, 되쏘지 않음(무한루프 방지) ---
  B.sent().length = 0;
  const bcast = relay([A], [A, B]);        // A 의 부팅 통보를 서버가 모든 master 에 뿌림
  ok(bcast.some(m => m.slaveID === '__reset__'), 'C2 A 의 __reset__ 이 브로드캐스트됨');
  ok(B.reloads.n === 1, 'C3 ★ B 도 새로고침으로 초기화된다');
  ok(B.resetCalls.n === 0, 'C4 ★ resetScreen(소프트리셋)은 더 이상 쓰지 않는다 — 스냅샷 재생 때문');
  ok(B.store.get('_gmResetSent') === '1', 'C5 ★ B 는 "재통보 금지" 플래그를 남기고 새로고침');
  const B2 = makePhone(B.store);           // 새로고침된 B
  B2.connect();
  ok(B2.sent().filter(m => m.slaveID === '__reset__').length === 0,
    'C6 ★★ 새로고침된 B 는 되쏘지 않는다 (폰끼리 무한 초기화 방지)');
  ok(A.reloads.n === 0, 'C7 ★ A 는 자기 에코로 다시 새로고침되지 않는다');

  // --- 터치 활성화 전파: A 에서 SNS 15탭 → B 도 활성 ---
  A.sent().length = 0; B.sent().length = 0;
  A.touchSNS();
  A.tickPropagate();
  const ctl = A.sent().filter(m => m.slaveID === '__snsctl__');
  ok(ctl.length === 1 && ctl[0].pin === 1, 'C9 ★ A 의 터치 활성화가 __snsctl__ 로 전파됨');
  relay([A], [A, B]);
  ok(B.sandbox.isSNSActivated === true, 'C10 ★ B 도 SNS 활성화됨 (상태 공유)');
  ok(B.doc.getElementById('sns-button').src === 'assets/phone-img/SNS-activate.png', 'C11 B 화면도 활성 이미지');

  // --- 되쏘기 없음: 원격으로 켜진 B 는 다시 전파하지 않는다 ---
  B.sent().length = 0;
  B.tickPropagate();
  ok(B.sent().filter(m => m.slaveID === '__snsctl__').length === 0,
    'C12 ★★ 원격으로 켜진 폰은 되쏘지 않는다 (핑퐁 방지)');

  // --- 꺼짐은 전파하지 않는다 (DM 을 읽으면 그 폰만 알림이 꺼지는 게 정상) ---
  A.touchDM(); A.tickPropagate(); relay([A], [A, B]);
  ok(B.sandbox.isSNSDMActivated === true, 'C13 DM 활성화도 전파됨');
  B.sent().length = 0;
  B.openDMTab();              // B 플레이어가 DM 탭 열람 → B 만 꺼짐
  B.tickPropagate();
  ok(B.sent().filter(m => m.slaveID === '__snsctl__').length === 0,
    'C14 ★ 꺼짐은 전파하지 않는다 (한쪽이 읽었다고 다른 폰 알림을 지우면 안 됨)');
  ok(A.sandbox.isSNSDMActivated === true, 'C15 A 의 DM 알림은 그대로 남아 있다');

  // --- 이미 켜져 있는 비트는 다시 쏘지 않는다 (DM 켰다고 SNS 까지 되쏘면 낭비) ---
  const C = makePhone(); C.connect();
  C.touchSNS(); C.tickPropagate();      // SNS 먼저 켜서 기준선 맞춤
  C.sent().length = 0;
  C.touchDM();  C.tickPropagate();      // 이제 DM 만 추가로 켬
  const ctl2 = C.sent().filter(m => m.slaveID === '__snsctl__');
  ok(ctl2.length === 1 && ctl2[0].pin === 2, 'C16 ★ 새로 켜진 비트만 전파 (SNS 되쏘기 없음)');
})();

/* ================= F. 슬레이브 스냅샷 재생 차단 (폰) =================
   슬레이브는 5초마다 재등록하며 전체 핀 스냅샷을 다시 뿌린다.
   그대로 checkPinStatus 에 먹이면 초기화 직후 진행이 통째로 재생돼
   화면이 겹치고 게임이 저절로 시작된다. */
(function snapshotReplay() {
  // 의도한 초기화(10탭·원격)로 인한 새로고침 = sessionStorage 에 표식이 남아 있는 부팅
  const store = new Map([['_gmResetSent', '1']]);
  const P = makePhone(store); P.connect();
  const hits = [];
  P.sandbox.checkPinStatus = (s, a, pin, st) => hits.push(s + '/' + pin + ':' + st);
  const snap = (state) => P.recv({
    type: 'slaveRegister', slaveID: 'streetmega',
    arduinos: [{ arduinoID: 'streetmega-2', pins: [{ pin: 22, state }] }],
  });

  snap('on');                       // 부팅 후 첫 스냅샷 = 이미 걸려 있던 핀
  ok(hits.length === 0, 'F1 ★★ 초기화 새로고침 뒤 첫 스냅샷은 무시 (자동 시작·화면 겹침 방지)');
  snap('on'); snap('on');           // 5초마다 같은 스냅샷 반복
  ok(hits.length === 0, 'F2 ★★ 반복되는 동일 스냅샷도 무시된다');
  snap('off');
  ok(hits.length === 1 && hits[0] === 'streetmega/22:off', 'F3 ★ 값이 바뀌면 반영된다');
  snap('on');
  ok(hits.length === 2 && hits[1] === 'streetmega/22:on', 'F4 ★ off→on 은 새 조작 → 반영');

  // 실제 조작(update)은 언제나 반영
  hits.length = 0;
  P.recv({ type: 'update', slaveID: 'safehouse', arduinoID: 'safemega-1', updates: [{ pin: 23, state: 'on' }] });
  P.recv({ type: 'update', slaveID: 'safehouse', arduinoID: 'safemega-1', updates: [{ pin: 23, state: 'on' }] });
  ok(hits.length === 2, 'F5 update(실제 조작)는 항상 반영된다');

  // update 로 알게 된 상태는 스냅샷 재생 판정에도 쓰인다
  hits.length = 0;
  P.recv({ type: 'slaveRegister', slaveID: 'safehouse',
    arduinos: [{ arduinoID: 'safemega-1', pins: [{ pin: 23, state: 'on' }] }] });
  ok(hits.length === 0, 'F6 ★ update 직후 같은 값 스냅샷은 재생 안 함');
})();

/* ================= H. 사고 새로고침은 진행을 따라잡는다 =================
   게임 중 폰이 죽었다 살아난 경우(배터리·앱 종료·오탭). 이때는 스냅샷으로 복구해야 한다.
   의도한 초기화와는 sessionStorage 표식 유무로 구분된다. */
(function accidentalReload() {
  const P = makePhone();            // 표식 없음 = 사고 새로고침
  P.connect();
  const hits = [];
  P.sandbox.checkPinStatus = (s, a, pin, st) => hits.push(s + '/' + pin + ':' + st);
  const snap = (slaveID, arduinoID, pin, state) => P.recv({
    type: 'slaveRegister', slaveID, arduinos: [{ arduinoID, pins: [{ pin, state }] }],
  });

  snap('streetmega', 'streetmega-2', 22, 'on');
  snap('safehouse', 'safemega-1', 23, 'on');
  ok(hits.length === 2, 'H1 ★★ 사고 새로고침이면 첫 스냅샷으로 진행을 따라잡는다');
  ok(hits[0] === 'streetmega/22:on' && hits[1] === 'safehouse/23:on', 'H2 걸려 있던 핀이 그대로 반영');

  hits.length = 0;
  snap('streetmega', 'streetmega-2', 22, 'on');   // 5초 뒤 같은 스냅샷
  snap('safehouse', 'safemega-1', 23, 'on');
  ok(hits.length === 0, 'H3 ★ 따라잡은 뒤엔 반복 스냅샷을 무시한다 (되살아남 방지)');

  snap('safehouse', 'safemega-1', 23, 'off');
  snap('safehouse', 'safemega-1', 23, 'on');
  ok(hits.length === 2, 'H4 그 뒤 실제 변화는 정상 반영');

  // 사고 새로고침은 초기화가 아니므로 부팅 통보는 그대로 나간다(다른 폰·뷰어도 맞춰짐)
  ok(P.sent().filter(m => m.slaveID === '__reset__').length === 1, 'H5 사고 새로고침도 부팅 통보는 보낸다');
})();

/* ================= J. 힌트 사용 개수 (폰) =================
   LC001~LC021 을 비트마스크로. 같은 힌트 재조회는 카운트 안 오르고, 폰 2대가 개수를 공유한다. */
(function hintCountPhone() {
  const A = makePhone(), B = makePhone();
  A.connect(); B.connect();
  relay([A, B], [A, B]);            // 부팅 통보 정리
  A.sent().length = 0; B.sent().length = 0;
  const cntA = () => vm.runInContext('_gmHintCount()', A.ctx);
  const cntB = () => vm.runInContext('_gmHintCount()', B.ctx);
  // app.js 의 showHintDetail(코드번호) 을 감싼 래퍼가 카운트 지점
  const viewHint = (p, num) => p.sandbox.window.showHintDetail(num);

  ok(cntA() === 0, 'J1 처음엔 0회');
  viewHint(A, 7);
  ok(cntA() === 1, 'J2 힌트를 보면 1회');
  viewHint(A, 7);
  ok(cntA() === 1, 'J3 ★ 같은 힌트를 다시 봐도 카운트는 그대로 (고유 힌트만)');
  viewHint(A, 12);
  ok(cntA() === 2, 'J4 다른 힌트를 보면 2회');

  const sent = A.sent().filter(m => m.slaveID === '__hint__');
  ok(sent.length === 2 && sent[0].pin === 7 && sent[1].pin === 12,
    'J5 ★ 새로 본 힌트만 __hint__ 로 알린다 (중복은 안 보냄)');

  relay([A], [A, B]);
  ok(cntB() === 2, 'J6 ★★ 다른 폰도 같은 개수가 된다 (2대 공유)');
  ok(A.doc.getElementById('gmHintUsed').querySelector('.n').textContent === '2', 'J7 폰 화면에 2 표시');

  // 범위 밖 코드는 무시
  viewHint(A, 0); viewHint(A, 22); viewHint(A, 99);
  ok(cntA() === 2, 'J8 LC001~LC021 밖은 집계하지 않는다');

  // 새로고침으로 목록을 잃은 폰은 다른 폰의 5초 마스크로 자동 복구
  const B2 = makePhone(); B2.connect();
  ok(vm.runInContext('_gmHintCount()', B2.ctx) === 0, 'J9 새로 켠 폰은 0회에서 시작');
  A.sent().length = 0;
  A.tickStatus();                    // 5초 주기 보고
  const mask = A.sent().find(m => m.slaveID === '__hintmask__');
  ok(mask && mask.pin === ((1 << 6) | (1 << 11)), 'J10 힌트 목록을 비트마스크로 보낸다');
  relay([A], [B2]);
  ok(vm.runInContext('_gmHintCount()', B2.ctx) === 2, 'J11 ★★ 마스크로 개수가 자동 복구된다');

  // 상세화면에선 개수 표시를 숨기고, 입력화면으로 돌아오면 다시 보인다
  ok(A.doc.getElementById('gmHintUsed').style.display === 'none', 'J12 힌트 상세화면에선 숨김');
  A.sandbox.window.showHintInput();
  ok(A.doc.getElementById('gmHintUsed').style.display === 'inline-flex', 'J13 입력화면으로 돌아오면 다시 표시');

  // 원래 app.js 동작은 보존
  ok(A.sandbox.__detailCalls === 6, 'J14 app.js 의 showHintDetail 원래 동작은 그대로 호출된다');
})();

/* ================= K. 힌트 사용 개수 (뷰어) ================= */
(function hintCountViewer() {
  const V = makeViewer();
  const hint = num => V.msg({ type: 'update', slaveID: '__hint__', arduinoID: 'h-aaaa', updates: [{ pin: num, state: 'on' }] });
  const maskMsg = m => V.msg({ type: 'update', slaveID: '__hintmask__', arduinoID: 'hm-aaaa', updates: [{ pin: m, state: 'on' }] });

  ok(V.doc.getElementById('hintNum').textContent === '0', 'K1 처음엔 0회');
  ok(V.doc.getElementById('hintEmpty').style.display === 'block', 'K2 "아직 안 씀" 안내 표시');

  hint(3); hint(7);
  ok(V.doc.getElementById('hintNum').textContent === '2', 'K3 ★ 힌트 2개 집계');
  const codesHtml = V.doc.getElementById('hintCodes')._html;
  ok(codesHtml.indexOf('LC003') !== -1 && codesHtml.indexOf('LC007') !== -1, 'K4 ★ 어떤 코드였는지 표시');
  ok(V.doc.getElementById('hintEmpty').style.display === 'none', 'K5 안내 문구는 사라짐');
  hint(7);
  ok(V.doc.getElementById('hintNum').textContent === '2', 'K6 ★ 같은 코드 재수신은 개수를 안 올린다');

  ok(V.doc.getElementById('hintNum').className === '', 'K7 2회까지는 기본색');
  hint(12);
  ok(V.doc.getElementById('hintNum').className === 'warn', 'K8 ★ 3회부터 노랑');
  hint(14); hint(16);
  ok(V.doc.getElementById('hintNum').className === 'alert', 'K9 ★ 5회부터 빨강');

  // 뷰어를 늦게 열어도 마스크로 개수는 맞는다
  const V2 = makeViewer();
  maskMsg.call(null, 0);            // 0 은 무시
  const V2mask = m => V2.msg({ type: 'update', slaveID: '__hintmask__', arduinoID: 'hm-aaaa', updates: [{ pin: m, state: 'on' }] });
  V2mask((1 << 0) | (1 << 2) | (1 << 6));
  ok(V2.doc.getElementById('hintNum').textContent === '3', 'K10 ★ 늦게 접속해도 마스크로 개수 복구');

  // 초기화하면 0으로
  V.reset();
  ok(V.doc.getElementById('hintNum').textContent === '0' &&
     V.doc.getElementById('hintCodes')._children.length === 0, 'K11 ★★ 초기화 시 개수·목록 모두 리셋');
  ok(V.doc.getElementById('hintNum').className === '', 'K12 색상도 기본으로');

  // 내부 채널이 게임 진행으로 새어들어가지 않는지
  const snap = V.get('JSON.stringify(S.P)');
  hint(5); maskMsg(7);
  ok(V.get('JSON.stringify(S.P)') === snap, 'K13 힌트 채널은 진행에 기록되지 않는다');
})();

/* ================= I. 자기 에코 판별은 정확 비교 ================= */
(function echoExactMatch() {
  const P = makePhone(); P.connect();
  const myId = P.id();

  // 다른 폰인데 arduinoID 가 내 식별자를 "포함"하는 경우 → 남으로 봐야 한다
  P.recv({ type: 'update', slaveID: '__reset__', arduinoID: 'boot-' + myId + 'x', updates: [{ pin: 1, state: 'on' }] });
  ok(P.reloads.n === 1, 'I1 ★★ 식별자가 부분적으로 겹쳐도 다른 폰으로 인식해 초기화된다');

  // 정확히 내 것 → 자기 에코이므로 초기화하지 않는다
  const P2 = makePhone(); P2.connect();
  P2.recv({ type: 'update', slaveID: '__reset__', arduinoID: 'boot-' + P2.id(), updates: [{ pin: 1, state: 'on' }] });
  ok(P2.reloads.n === 0, 'I2 ★ 자기 에코로는 새로고침하지 않는다');
})();

/* ================= E. 좌측 하단 10탭 = 즉시 전파 후 새로고침 ================= */
(function tenTap() {
  const A = makePhone(), B = makePhone();
  A.connect(); B.connect();
  relay([A, B], [A, B]);            // 서로의 부팅 통보 정리
  A.sent().length = 0; B.sent().length = 0;
  A.reloads.n = 0; B.reloads.n = 0; // 위 부팅 통보로 생긴 새로고침은 이번 검증 대상이 아니다
  A.store.clear(); B.store.clear();

  // 9탭까지는 아무 일도 없어야 한다
  A.tap(9);
  ok(A.sent().length === 0, 'E1 9탭까지는 통보 없음');
  ok(A.reloads.n === 0, 'E2 9탭까지는 새로고침도 없음');

  // 10번째 탭 → 새로고침 "전에" 먼저 통보
  const ev = A.tap(1);
  const sent = A.sent().filter(m => m.slaveID === '__reset__');
  ok(sent.length === 1 && sent[0].pin === 1, 'E3 ★ 10탭 즉시 __reset__ 전송');
  ok(A.reloads.n === 0, 'E4 ★ 통보가 나가기 전엔 새로고침하지 않는다');
  ok(ev.stopped === true, 'E5 ★ app.js 의 즉시 reload 핸들러를 차단');

  // 다른 폰은 이 시점에 이미 초기화된다 (연결모드 버튼을 누르기 전)
  relay([A], [A, B]);
  ok(B.reloads.n === 1, 'E6 ★★ 연결모드 누르기 전에 다른 폰이 초기화됨');

  // 서버 에코가 도착하면 그 즉시 새로고침
  ok(A.reloads.n === 1, 'E7 ★ 서버 에코 확인 후 새로고침');
  ok([...A.timers.pending.values()].every(v => v.ms !== 1500), 'E8 새로고침 후 폴백 타이머는 취소됨');

  // 새로고침 후 재접속(연결모드 버튼) → 중복 통보 없음
  const A2 = makePhone(A.store);    // sessionStorage 를 물려받은 = 같은 탭의 새로고침
  A2.connect();
  ok(A2.sent().filter(m => m.slaveID === '__reset__').length === 0,
    'E9 ★★ 새로고침 후 웹소켓모드 눌러도 중복 통보 안 함');
  ok(A2.sent().some(m => m.type === 'master'), 'E10 재접속 자체는 정상');

  // 그 다음 평범한 새로고침(10탭 아님)은 다시 통보한다
  const A3 = makePhone(A2.store);
  A3.connect();
  ok(A3.sent().filter(m => m.slaveID === '__reset__').length === 1,
    'E11 ★ 10탭이 아닌 새로고침은 평소대로 통보');
})();

/* ---- E-b. 연결이 끊겨 있을 때 10탭 ----
   초기화 직후 두 폰은 "연결모드" 화면(=미접속)에 있다. 그 상태에서 10탭하는 일이 실제로 생긴다. */
(function tenTapOffline() {
  const P = makePhone();            // ws 연결 안 함
  P.tap(10);
  ok(P.reloads.n === 0, 'E12 에코를 못 받으면 바로 새로고침하지 않는다');
  P.fireTimeout(1500);
  ok(P.reloads.n === 1, 'E13 ★ 연결이 없어도 1.5초 폴백으로 새로고침된다');
  ok(!P.store.get('_gmResetSent'),
    'E14 ★★ 못 보냈으면 "통보 생략" 플래그를 남기지 않는다');
  const P2 = makePhone(P.store);    // 새로고침 후 웹소켓모드 눌러 접속
  P2.connect();
  ok(P2.sent().filter(m => m.slaveID === '__reset__').length === 1,
    'E15 ★★ 재접속 시 부팅 통보로 초기화가 전파된다 (초기화가 통째로 유실되지 않음)');
})();

/* ---- E-c. 탭 카운트는 2초 쉬면 리셋된다 ---- */
(function tapWindow() {
  const P = makePhone(); P.connect(); P.sent().length = 0;
  P.tap(5);
  P.fireTimeout(2000);              // 2초 무입력 → 카운트 리셋
  P.tap(5);
  ok(P.sent().filter(m => m.slaveID === '__reset__').length === 0,
    'E16 5탭+쉼+5탭 은 초기화가 아니다 (오탭 방지)');
})();

/* ================= B/D. 뷰어 ================= */
(function viewer() {
  const V = makeViewer();
  const { msg, get, upd, doc, sandbox, timers: t } = V;
  ok(!!sandbox.LDC, 'B0 상태머신(LDC) 로드');

  /* --- D. 폰 2대 집계 --- */
  upd('__status__', 'snsdm-aaaa', 1);   // 폰 A: SNS 만 켜짐
  upd('__status__', 'snsdm-bbbb', 0);   // 폰 B: 아무것도 안 켜짐
  ok(doc.getElementById('snsStat').textContent === '● 활성 1/2대', 'D1 ★ SNS "1/2대" 집계');
  ok(doc.getElementById('dmStat').textContent === '○ 비활성 0/2대', 'D2 ★ DM "0/2대" 집계');
  ok(/폰 2대 보고 중/.test(doc.getElementById('snsdmAge').textContent), 'D3 ★ "폰 2대 보고 중" 표시');
  upd('__status__', 'snsdm-bbbb', 3);   // 폰 B 도 SNS+DM 켜짐
  ok(doc.getElementById('snsStat').textContent === '● 활성 2/2대', 'D4 두 대 모두 활성이면 2/2대');
  ok(doc.getElementById('dmStat').textContent === '● 활성 1/2대', 'D5 DM 은 한 대만 → 1/2대 (정상)');

  /* --- B. 초기화 --- */
  upd('streetmega', 'streetmega-2', 22);        // 게임 시작 (+137초 타이머 예약)
  upd('safehouse', 'safemega-1', 23);           // 안전가옥 ①
  upd('__time__', '__t__', 4200);               // 폰 시간 보고 70:00
  vm.runInContext('msgCount=42; document.getElementById("msgCount").textContent="42";', V.ctx);

  ok(get('S.P.streetmegaPin22') === true && get('S.P.safehousePin23') === true, 'B1 진행 기록됨');
  ok(get('phoneSyncArmed') === false && get('autoStarted') === true, 'B2 폰 시간보고로 타이머 실측 동기화');
  ok(get('tRemain') === 4200, 'B3 타이머가 폰 값(4200s)으로 맞춰짐');
  ok(get('snsdmLastTs') > 0 && get('phones.size') === 2, 'B4 폰 2대 상태 보관 중');

  const pendingBefore = t.pending.size;
  msg({ type: 'update', slaveID: '__reset__', arduinoID: 'boot-aaaa', updates: [{ pin: 1, state: 'on' }] });

  ok(!get('S.P.streetmegaPin22') && !get('S.P.safehousePin23'), 'B5 ★ 진행 상태머신 초기화');
  ok(get('LDC.currentStageIndex(S)') === -1, 'B6 ★ 단계 = 대기');
  ok(get('tRemain') === 6000 && get('tInt') === null && get('tEnd') === null, 'B7 ★ 타이머 1:40:00 정지 상태');
  ok(get('autoStarted') === false && get('phoneSyncArmed') === false, 'B8 ★ 타이머 자동시작 플래그 해제');
  ok(get('phoneSyncTimer') === null && t.pending.size < pendingBefore, 'B9 ★ 예약된 137초 시작 취소됨');
  ok(get('snsdmLastTs') === 0 && get('phones.size') === 0, 'B10 ★ 폰별 SNS/DM 보고 비움');
  ok(doc.getElementById('snsStat').textContent === '○ 확인 중…' &&
     doc.getElementById('dmStat').textContent === '○ 확인 중…', 'B11 ★ SNS/DM 표시 "확인 중"');
  ok(doc.getElementById('snsdmAge').textContent === '폰 상태 보고 대기…', 'B12 ★ 상태 보고 안내 초기화');
  ok(doc.getElementById('syncDot').textContent === '○ 폰 신호 없음', 'B13 ★ 폰 시간 동기 표시 초기화');
  ok(get('msgCount') === 0 && doc.getElementById('msgCount').textContent === '0', 'B14 ★ 수신 카운터 0');
  ok(doc.getElementById('tSet').value === '', 'B15 시간 입력칸 비움');
  ok(/초기화/.test(doc.getElementById('toast').textContent), 'B16 GM 에게 초기화 알림 표시');
  ok(doc.getElementById('clock').textContent === '1:40:00', 'B17 시계 표시도 1:40:00');

  // 초기화 후 남아 있던 137초 콜백이 뒤늦게 터져도 타이머가 살아나면 안 됨
  t.pending.forEach(p => { try { p.fn(); } catch (e) {} });
  ok(get('tInt') === null && get('autoStarted') === false, 'B18 ★ 지연 콜백이 타이머를 되살리지 않음');

  // 초기화 후 새 게임을 정상 추적하는지 (준비상태 = 죽은 화면이 아님)
  upd('streetmega', 'streetmega-2', 22);
  ok(get('S.P.streetmegaPin22') === true, 'B19 ★ 초기화 후 새 게임 정상 추적');

  // resetScreen 경로(pin 2)도 동일하게 초기화
  msg({ type: 'update', slaveID: '__reset__', arduinoID: 'boot-bbbb', updates: [{ pin: 2, state: 'on' }] });
  ok(!get('S.P.streetmegaPin22'), 'B20 pin 2(resetScreen)도 전체 초기화');
  ok(/resetScreen/.test(doc.getElementById('toast').textContent), 'B21 초기화 사유가 구분되어 표시');

  // 내부 채널이 상태머신으로 새어들어가지 않는지 (핀 번호 1·2 오인 방지)
  const snap = get('JSON.stringify(S.P)');
  msg({ type: 'update', slaveID: '__reset__', arduinoID: 'boot-aaaa', updates: [{ pin: 1, state: 'on' }] });
  msg({ type: 'update', slaveID: '__snsctl__', arduinoID: 'ctl-aaaa', updates: [{ pin: 1, state: 'on' }] });
  ok(get('JSON.stringify(S.P)') === snap, 'B22 내부채널은 진행에 기록되지 않음');

  // 폰 1대만 보고할 땐 대수 표기 없이 간결하게
  upd('__status__', 'snsdm-cccc', 1);
  ok(doc.getElementById('snsStat').textContent === '● 활성', 'D6 폰 1대면 대수 표기 생략');

})();

/* ================= G. 스냅샷 재생 차단 (뷰어) =================
   슬레이브가 5초마다 재등록하며 뿌리는 전체 핀 스냅샷을 그대로 먹으면
   초기화해도 5초 뒤 진행이 다시 채워져 "초기화가 안 되는" 것처럼 보인다. */
(function viewerSnapshot() {
  const V = makeViewer();
  const snap = st => V.snapshot('streetmega', 'streetmega-2', 22, st);

  snap('on');                                  // 게임 도중 뷰어를 열었을 때처럼 처음 보는 핀
  ok(V.get('S.P.streetmegaPin22') === true, 'G1 처음 보는 핀은 반영 — 게임 중 뷰어 열어도 따라잡음');

  V.reset();
  ok(!V.get('S.P.streetmegaPin22'), 'G2 초기화 직후엔 진행이 비어 있다');
  snap('on'); snap('on'); snap('on');           // 5초마다 오는 스냅샷 3번
  ok(!V.get('S.P.streetmegaPin22'), 'G3 ★★ 초기화 후 스냅샷이 진행을 되살리지 않는다');
  ok(V.get('LDC.currentStageIndex(S)') === -1, 'G4 ★★ 단계도 "대기" 그대로');
  ok(V.get('tInt') === null && V.get('tRemain') === 6000, 'G5 ★★ 타이머도 되살아나지 않는다');

  snap('off'); snap('on');                      // 새 팀이 실제로 소품을 다시 건드림
  ok(V.get('S.P.streetmegaPin22') === true, 'G6 ★ 핀이 실제로 off→on 되면 정상 반영');

  // slaveList(접속 스냅샷)도 같은 규칙
  V.reset();
  V.msg({ type: 'slaveList', slaves: [{ slaveID: 'streetmega', arduinos: [{ arduinoID: 'streetmega-2', pins: [{ pin: 22, state: 'on' }] }] }] });
  ok(!V.get('S.P.streetmegaPin22'), 'G7 ★ slaveList 스냅샷도 진행을 되살리지 않는다');
})();

/* ================= H. 시간 세팅 (v139) =================
   매장 릴레이 서버에는 timeSync 블록이 빠져 있다(simPin 만 패치됨) →
   뷰어는 simPin '__settime__' 채널로 보내고, 폰은 그걸로 시간을 맞춘 뒤 적용 확인을 회신한다. */
(function timeSet() {
  // app.js 의 타이머 전역을 흉내낸 폰 (running=타이머가 이미 돌고 있는가)
  function phoneWithTimer(running) {
    const p = makePhone();
    vm.runInContext(
      'var timeRemaining=6000; var timerInterval=' + (running ? '1' : 'null') + ';' +
      'var __startCalls=0; var __drawCalls=0;' +
      'var startTimer=function(){ __startCalls++; };' +
      'var updateTimerDisplay=function(){ __drawCalls++; };', p.ctx);
    p.connect();
    p.ws().sent.length = 0;
    return p;
  }
  const setTime = (p, sec) => p.recv({ type: 'update', slaveID: '__settime__', arduinoID: 'gm', updates: [{ pin: sec, state: 'on' }] });

  /* --- 폰: 게임 진행 중 --- */
  const A = phoneWithTimer(true);
  setTime(A, 5100);                                   // 85:00
  ok(vm.runInContext('timeRemaining', A.ctx) === 5100, 'H1 ★ __settime__ 로 폰 남은시간 반영 (서버 무수정 경로)');
  ok(vm.runInContext('__startCalls', A.ctx) === 1, 'H2 진행 중이면 startTimer() 로 endTime 재계산');
  const ack = A.ws().sent.find(m => m.slaveID === '__timeack__');
  ok(ack && ack.type === 'simPin' && ack.pin === 5100, 'H3 ★ 적용 확인(ack)을 simPin 으로 회신');
  ok(ack.arduinoID === 'ack-' + A.id(), 'H4 ack 에 폰 식별자 포함 (뷰어가 대수를 셀 수 있게)');

  /* --- 폰: 아직 시작 전 (대기화면) --- */
  const B = phoneWithTimer(false);
  setTime(B, 5400);
  ok(vm.runInContext('timeRemaining', B.ctx) === 5400, 'H5 시작 전에도 값은 반영된다');
  ok(vm.runInContext('__startCalls', B.ctx) === 0,
    'H6 ★★ 시작 전에는 타이머를 켜지 않는다 (켜면 pin22+137초 전에 시간이 깎인다)');
  ok(vm.runInContext('__drawCalls', B.ctx) >= 1, 'H7 대신 표시만 갱신');

  /* --- 서버가 나중에 패치되는 경우: timeSync 경로도 같은 동작 --- */
  const C = phoneWithTimer(true);
  C.recv({ type: 'timeSync', seconds: 600 });
  ok(vm.runInContext('timeRemaining', C.ctx) === 600, 'H8 timeSync 경로도 동일하게 동작(호환 유지)');
  ok(C.ws().sent.some(m => m.slaveID === '__timeack__'), 'H9 timeSync 로 받아도 ack 회신');

  /* --- 게임 로직 오염 없음 --- */
  const D = phoneWithTimer(true);
  const hit = [];
  D.sandbox.checkPinStatus = (s, a, pin, st) => hit.push(pin);
  setTime(D, 3000);
  ok(hit.length === 0, 'H10 __settime__ 은 게임 상태머신에 들어가지 않는다');

  /* --- 뷰어: 전송 형식 --- */
  const V = makeViewer();
  const sent = () => V.get('ws').sent;
  sent().length = 0;
  V.doc.getElementById('tSet').value = '85:00';
  V.get('applyTimeInput()');
  const st = sent().find(m => m.slaveID === '__settime__');
  ok(st && st.type === 'simPin' && st.pin === 5100 && st.state === 'on',
    'H11 ★ 뷰어가 simPin __settime__ 로 보낸다 (서버 패치 불필요)');
  ok(sent().some(m => m.type === 'timeSync' && m.seconds === 5100),
    'H12 timeSync 도 함께 보낸다 (서버가 패치돼 있으면 그 경로로도 도달)');
  ok(V.get('tRemain') === 5100, 'H13 뷰어 시계도 즉시 85:00');

  /* --- 뷰어: 방금 넣은 값이 "출발 중이던" 폰 보고에 덮이지 않는다 --- */
  V.upd('__time__', '__t__', 4200);                    // 적용 직후 도착한 옛 보고
  ok(V.get('tRemain') === 5100, 'H14 ★ 적용 직후(2.5초) 폰 보고는 무시 — 입력값이 지워지지 않는다');
  V.get('timeApplyAt=0');                              // 보호창 종료
  V.upd('__time__', '__t__', 4200);
  ok(V.get('tRemain') === 4200, 'H15 보호창이 끝나면 다시 폰 실측을 따른다 (사실 반영)');

  /* --- 뷰어: 적용 확인 표시 --- */
  V.upd('__timeack__', 'ack-aaaa', 5100);
  ok(/✔ 폰 1대 적용/.test(V.doc.getElementById('ackDot').textContent), 'H16 ★ 폰 1대 적용 확인 표시');
  V.upd('__timeack__', 'ack-bbbb', 5100);
  ok(/✔ 폰 2대 적용/.test(V.doc.getElementById('ackDot').textContent), 'H17 ★ 2대 모두 적용되면 2대로 집계');
  ok(!V.get('S.P.streetmegaPin22'), 'H18 ack·settime 에코는 진행에 영향 없음');

  /* --- 뷰어: 회신이 없으면 "조용한 실패"가 아니라 실패라고 말한다 --- */
  const W = makeViewer();
  W.get('ws').sent.length = 0;
  W.doc.getElementById('tSet').value = '70:00';
  W.get('applyTimeInput()');
  W.timers.pending.forEach((v, k) => { if (v.ms === 3000) { W.timers.pending.delete(k); v.fn(); } });
  ok(/폰 적용 실패/.test(W.doc.getElementById('ackDot').textContent),
    'H19 ★★ 3초 내 회신 없으면 실패를 표시 (이번 사고의 재발 방지)');
})();

/* ================= I. 태블릿 시간 자동 동기화 (v141) =================
   폰이 게임 도중 재시작되면 진행은 스냅샷으로 따라잡지만 타이머는 1:40:00 부터 다시 셌다.
   살아 있는 다른 폰에서 받아온다. 핵심은 "신뢰(synced)" — 재시작한 폰끼리 틀린 값을
   주고받으면 둘 다 확신하는 오답이 된다. 응답도 채택도 synced 인 쪽만 한다. */
(function timeAutoSync() {
  // running = 타이머가 이미 돌고 있는가. synced 는 기본 false(= 막 부팅한 상태)
  function phone(running) {
    const p = makePhone();
    vm.runInContext(
      'var timeRemaining=6000; var timerInterval=' + (running ? '1' : 'null') + ';' +
      'var __startCalls=0;' +
      'var startTimer=function(){ __startCalls++; };' +
      'var updateTimerDisplay=function(){};', p.ctx);
    p.sandbox.checkPinStatus = () => {};
    p.connect();
    p.ws().sent.length = 0;
    return p;
  }
  const synced = p => vm.runInContext('_gmTimeSynced', p.ctx);
  const remain = p => vm.runInContext('timeRemaining', p.ctx);
  const livePin = (p, pin) => p.recv({ type: 'update', slaveID: 'streetmega', arduinoID: 'streetmega-2', updates: [{ pin, state: 'on' }] });
  const snapPin = (p, pin) => p.recv({ type: 'slaveRegister', slaveID: 'streetmega', arduinos: [{ arduinoID: 'streetmega-2', pins: [{ pin, state: 'on' }] }] });

  /* --- 신뢰 판정 --- */
  const L = phone(false);
  ok(synced(L) === false, 'I1 부팅 직후에는 시간을 못 믿는 상태');
  livePin(L, 22);
  ok(synced(L) === true, 'I2 ★ 게임 시작(pin22)을 라이브로 보면 시간을 믿는다');

  const R = phone(true);                 // 게임 도중 재시작된 폰
  snapPin(R, 22);
  ok(synced(R) === false,
    'I3 ★★ 스냅샷 재생으로 들어온 pin22 는 신뢰하지 않는다 (재시작 복구본의 1:40:00 을 퍼뜨리면 안 됨)');

  /* --- 모르면 물어본다 --- */
  const Q = phone(true);
  Q.fireTimeout(300);                    // 접속 직후 요청
  const req = Q.sent().find(m => m.slaveID === '__timereq__');
  ok(req && req.type === 'simPin' && req.arduinoID === 'req-' + Q.id(),
    'I4 ★ 시간을 모르면 접속하자마자 다른 폰에 물어본다');
  Q.sent().length = 0;
  Q.timers.runIntervals(10000);
  ok(Q.sent().some(m => m.slaveID === '__timereq__'),
    'I5 다른 태블릿이 나중에 켜져도 맞도록 10초마다 다시 물어본다');

  /* --- 아는 폰만 답한다 --- */
  const A = phone(true); livePin(A, 22); A.sent().length = 0;
  vm.runInContext('timeRemaining=3600;', A.ctx);
  A.recv({ type: 'update', slaveID: '__timereq__', arduinoID: 'req-zzzz', updates: [{ pin: 1, state: 'on' }] });
  const res = A.sent().find(m => m.slaveID === '__timeres__');
  ok(res && res.pin === 3600 && res.arduinoID === 'tS-' + A.id(),
    'I6 ★ 믿을 만한 폰은 즉시 응답 (arduinoID 에 신뢰표시 tS-)');

  const U = phone(true); U.sent().length = 0;
  U.recv({ type: 'update', slaveID: '__timereq__', arduinoID: 'req-zzzz', updates: [{ pin: 1, state: 'on' }] });
  ok(!U.sent().some(m => m.slaveID === '__timeres__'),
    'I7 ★★ 자기도 모르는 폰은 답하지 않는다 (틀린 값이 확산되면 둘 다 오답이 된다)');

  /* --- 받아쓰기 --- */
  const B = phone(true); B.sent().length = 0;
  B.recv({ type: 'update', slaveID: '__timeres__', arduinoID: 'tS-aaaa', updates: [{ pin: 3600, state: 'on' }] });
  ok(remain(B) === 3600, 'I8 ★ 다른 폰의 값을 받아 시간 복구');
  ok(vm.runInContext('__startCalls', B.ctx) === 1, 'I9 진행 중이면 startTimer() 로 endTime 재계산');
  ok(synced(B) === true, 'I10 받아쓴 뒤에는 이 폰도 믿을 수 있다');
  ok(!B.sent().some(m => m.slaveID === '__timeack__'),
    'I11 ★ 자동 동기화는 ack 를 보내지 않는다 (뷰어에 가짜 "폰 적용" 이 뜨면 안 됨)');
  B.sent().length = 0;
  B.timers.runIntervals(10000);
  ok(!B.sent().some(m => m.slaveID === '__timereq__'), 'I12 맞춘 뒤에는 더 묻지 않는다');

  const C = phone(true);
  C.recv({ type: 'update', slaveID: '__timeres__', arduinoID: 'tU-aaaa', updates: [{ pin: 3600, state: 'on' }] });
  ok(remain(C) === 6000, 'I13 ★★ 상대도 모르는 값(tU-)은 받지 않는다');

  const D = phone(true);
  D.recv({ type: 'update', slaveID: '__timeres__', arduinoID: 'tU-' + D.id(), updates: [{ pin: 1234, state: 'on' }] });
  ok(remain(D) === 6000, 'I14 자기 에코는 받지 않는다');

  const E = phone(true); livePin(E, 22);   // 이미 믿을 만한 폰
  E.recv({ type: 'update', slaveID: '__timeres__', arduinoID: 'tS-aaaa', updates: [{ pin: 10, state: 'on' }] });
  ok(remain(E) === 6000, 'I15 ★ 이미 아는 폰은 남의 보고에 흔들리지 않는다');

  /* --- 예비 경로: 물어보지 않아도 10초 주기 보고로 맞춰진다 --- */
  const F = phone(true);
  F.recv({ type: 'update', slaveID: '__time__', arduinoID: 'tS-aaaa', updates: [{ pin: 2400, state: 'on' }] });
  ok(remain(F) === 2400 && synced(F) === true, 'I16 __time__ 주기보고만으로도 자동 동기화된다');

  /* --- 주기 보고에 신뢰표시가 실린다 --- */
  const G = phone(true); G.sent().length = 0;
  G.timers.runIntervals(10000);
  const rep = G.sent().find(m => m.slaveID === '__time__');
  ok(rep && rep.arduinoID === 'tU-' + G.id(), 'I17 못 믿는 폰의 보고는 tU- 로 표시된다');
  livePin(G, 22); G.sent().length = 0; G.timers.runIntervals(10000);
  const rep2 = G.sent().find(m => m.slaveID === '__time__');
  ok(rep2 && rep2.arduinoID === 'tS-' + G.id(), 'I18 믿을 만해지면 tS- 로 바뀐다');

  /* --- 실제 2대 연동 (릴레이 경유) --- */
  const P1 = phone(true); livePin(P1, 22); vm.runInContext('timeRemaining=1800;', P1.ctx);
  const P2 = phone(true);                                   // 재시작된 폰
  P1.sent().length = 0; P2.sent().length = 0;
  P2.fireTimeout(300);                                      // P2: "나 모른다"
  relay([P2], [P1]);                                        // 서버가 모든 master 에게 전달
  relay([P1], [P2]);                                        // P1 의 응답
  ok(remain(P2) === 1800 && synced(P2) === true,
    'I19 ★★ 재시작한 태블릿이 살아 있는 태블릿에서 시간을 자동 복구 (서버 수정 없이)');

  /* --- 뷰어 --- */
  const V = makeViewer();
  V.upd('__time__', 'tS-aaaa', 4200);
  ok(V.get('tRemain') === 4200, 'I20 뷰어는 믿을 만한 폰(tS-) 보고로 시계를 맞춘다');
  V.upd('__time__', 'tU-bbbb', 6000);
  ok(V.get('tRemain') === 4200,
    'I21 ★★ 뷰어는 못 믿는 폰(tU-) 보고로 시계를 바꾸지 않는다 (재시작 폰의 1:40:00 에 끌려가면 안 됨)');
  ok(/미동기화/.test(V.doc.getElementById('syncDot').textContent), 'I22 대신 미동기화라고 알린다');

  const V2 = makeViewer();
  V2.upd('__time__', 'tS-aaaa', 4200);
  V2.upd('__time__', 'tS-bbbb', 4198);
  ok(/2대 일치/.test(V2.doc.getElementById('syncDot').textContent), 'I23 두 폰이 같으면 "2대 일치"');
  V2.upd('__time__', 'tS-bbbb', 3000);
  ok(/불일치/.test(V2.doc.getElementById('syncDot').textContent),
    'I24 ★ 두 폰 시간이 어긋나면 뷰어가 경고한다');

  const V3 = makeViewer();
  V3.upd('__time__', '__t__', 4200);
  ok(V3.get('tRemain') === 4200, 'I25 v140 이하 폰(__t__)의 보고도 그대로 반영 (하위호환)');
})();

console.log(fail === 0
  ? `\n✅ 공유상태 검증 통과 (${pass}/${pass})`
  : `\n❌ 실패 ${fail}건 / 통과 ${pass}건`);
process.exit(fail ? 1 : 0);
