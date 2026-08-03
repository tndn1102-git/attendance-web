// 라이브 v141 로 "재시작한 태블릿이 살아 있는 태블릿에서 시간을 복구한다" 확인.
// 매장 릴레이(8080)에는 붙지 않는다 — 실제 태블릿에 영향이 가면 안 되므로
// 페이지의 ws 만 가짜로 바꿔 끼우고, 릴레이는 이 스크립트가 대신 중계한다.
import { createRequire } from 'node:module';
const { chromium } = createRequire('file:///D:/test3/fantastrick-homepage/package.json')('playwright');

const URL = 'http://fantastrick.co.kr/hint-phone/index.html';
const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n} → ${d}`); } };

async function phone(label) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fail++; console.log(`  [${label} pageerror]`, e.message); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof handleWebSocketMessage === 'function' && typeof _gmRequestTime === 'function');
  // 진짜 8080 에 붙지 않도록 ws 를 가짜로 교체 (websocket.js 의 최상위 let ws 에 대입)
  await page.evaluate(() => { window.__sent = []; ws = { readyState: 1, send: s => window.__sent.push(JSON.parse(s)) }; });
  return { ctx, page, label,
    run: fn => page.evaluate(fn),
    sent: () => page.evaluate(() => { const s = window.__sent.slice(); window.__sent.length = 0; return s; }),
    recv: m => page.evaluate(msg => handleWebSocketMessage(msg), m),
    state: () => page.evaluate(() => ({ sec: timeRemaining, synced: _gmTimeSynced, running: !!timerInterval, id: _gmPhoneId })),
  };
}
// 릴레이 흉내: simPin → 모든 master 에게 update 로 브로드캐스트
async function relay(from, to) {
  const msgs = await from.sent();
  for (const m of msgs.filter(x => x.type === 'simPin')) {
    for (const t of to) await t.recv({ type: 'update', slaveID: m.slaveID, arduinoID: m.arduinoID, updates: [{ pin: m.pin, state: m.state }] });
  }
  return msgs;
}

console.log('라이브 파일로 폰 2대 구동 (매장 릴레이에는 접속하지 않음)\n');
const A = await phone('A');   // 정상 진행 중인 태블릿
const B = await phone('B');   // 게임 도중 재시작된 태블릿

// A: 게임 시작을 라이브로 봄 → 신뢰. 남은시간 30:00 으로 진행 중
await A.recv({ type: 'update', slaveID: 'streetmega', arduinoID: 'streetmega-2', updates: [{ pin: 22, state: 'on' }] });
await A.run(() => { timeRemaining = 1800; startTimer(); });
let a = await A.state();
check('A: 라이브 시작을 봤으므로 시간 신뢰', a.synced === true, JSON.stringify(a));

// B: 재시작 직후 스냅샷 재생 (pin22 가 이미 켜져 있던 상태)
await B.recv({ type: 'slaveRegister', slaveID: 'streetmega', arduinos: [{ arduinoID: 'streetmega-2', pins: [{ pin: 22, state: 'on' }] }] });
await wait(500);
let b = await B.state();
check('B: 재시작 복구본이라 시간은 못 믿는 상태', b.synced === false, JSON.stringify(b));
check('B: 타이머는 1:40:00 부터 잘못 돌고 있음', b.running && b.sec > 5000, JSON.stringify(b));

// B 가 물어보고 → A 가 답하고 → B 가 받아쓴다
await A.sent(); await B.sent();
await B.run(() => _gmRequestTime());
const req = await relay(B, [A]);
check('B → __timereq__ 전송', req.some(m => m.slaveID === '__timereq__'), JSON.stringify(req));
const res = await relay(A, [B]);
check('A → __timeres__ 응답 (tS- 신뢰표시)',
  res.some(m => m.slaveID === '__timeres__' && String(m.arduinoID).indexOf('tS-') === 0), JSON.stringify(res));

b = await B.state();
console.log(`\n  B 의 남은시간: ${b.sec}초 (A 는 약 1800초)`);
check('★ B 가 A 의 시간으로 자동 복구', Math.abs(b.sec - 1800) <= 3, JSON.stringify(b));
check('★ 복구 뒤 B 도 신뢰 상태', b.synced === true, JSON.stringify(b));
const after = await B.sent();
check('자동 동기화는 ack 를 보내지 않는다', !after.some(m => m.slaveID === '__timeack__'), JSON.stringify(after));

// A 는 흔들리지 않는다
a = await A.state();
check('A 는 영향 없음', Math.abs(a.sec - 1800) <= 3 && a.synced === true, JSON.stringify(a));

console.log(`\n라이브 시간 동기화: ${pass} PASS / ${fail} FAIL`);
await browser.close();
process.exit(fail ? 1 : 0);
