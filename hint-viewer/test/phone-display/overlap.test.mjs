// v140 검증 — 단계 겹침·스냅샷 재생에서 미션/디테일이 올바르게 표시되는지
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire('file:///D:/test3/fantastrick-homepage/package.json')('playwright');

const ROOT = 'D:/test3/hint-phone';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png',
               '.json':'application/json', '.ttf':'font/ttf', '.woff2':'font/woff2', '.mp3':'audio/mpeg', '.ogg':'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(ROOT, p === '/' ? 'index.html' : p);
  fs.readFile(f, (e, buf) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;
const wait = ms => new Promise(r => setTimeout(r, ms));

const PIN = {
  p22:['streetmega','streetmega-2',22], s23:['safehouse','safemega-1',23], s25:['safehouse','safemega-1',25],
  s27:['safehouse','safemega-1',27], d23:['disinfectmega-1','disinfectmega-2',23],
  st23:['streetmega','streetmega-2',23], st24:['streetmega','streetmega-2',24],
  b23:['BAR','barmega-1',23], b26:['BAR','barmega-1',26], b31:['BAR','barmega-1',31],
  d34:['disinfectmega-1','disinfectmega-2',34], s24:['safehouse','safemega-1',24],
  s28:['safehouse','safemega-1',28], s30:['safehouse','safemega-1',30], end:['streetmega','streetmega-2',26],
};

const browser = await chromium.launch();
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log(`  PASS  ${name}`); } else { fail++; console.log(`  FAIL  ${name}  → ${detail}`); } };

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fail++; console.log('  [pageerror]', e.message); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.checkPinStatus === 'function');
  return { ctx, page };
}
const snap = page => page.evaluate(() => {
  const g = sel => { const el = document.querySelector(sel); const cs = getComputedStyle(el);
    return { src: (el.getAttribute('src')||'').replace('assets/phone-img/',''), display: cs.display,
             opacity: +cs.opacity, cls: el.className, visible: cs.display !== 'none' && +cs.opacity > 0.05 }; };
  return { mission: g('.mission-img'), details: g('.details-img'), location: g('.location-current'),
           sns: (document.getElementById('sns-button')||{}).src || '' };
});
const fire = (page, k) => page.evaluate(([s,a,p]) => window.checkPinStatus(s,a,p,'on'), PIN[k]);
const fmt = s => `mission[${s.mission.visible?'보임':'공백'} ${s.mission.src}] details[${s.details.visible?'보임':'공백'} ${s.details.src}]`;

// ── A. 안전가옥 ①→② 연속 태그 (예전엔 여기서 공백) ─────────────────────
{
  console.log('\n[A] 안전가옥 ①(pin23) → ②(pin25) 0.3초 간격');
  const { ctx, page } = await newPage();
  await fire(page,'p22'); await wait(300);
  await fire(page,'s23'); await wait(300);
  await fire(page,'s25');
  await wait(1500);
  let s = await snap(page); console.log('   1.5초 :', fmt(s));
  check('A1 mission2 표시 유지', s.mission.visible && s.mission.src === 'mission2.png', fmt(s));
  await wait(3000);
  s = await snap(page); console.log('   4.5초 :', fmt(s));
  check('A2 4.5초 뒤에도 유지', s.mission.visible && s.details.visible, fmt(s));
  await ctx.close();
}

// ── B. 같은 tick (릴레이가 두 핀을 한 메시지로 보낸 경우) ────────────────
{
  console.log('\n[B] pin23·pin25 동일 tick');
  const { ctx, page } = await newPage();
  await fire(page,'p22'); await wait(300);
  await page.evaluate(() => { window.checkPinStatus('safehouse','safemega-1',23,'on');
                              window.checkPinStatus('safehouse','safemega-1',25,'on'); });
  await wait(2000);
  const s = await snap(page); console.log('   2초 :', fmt(s));
  check('B1 mission2 표시', s.mission.visible && s.mission.src === 'mission2.png', fmt(s));
  await ctx.close();
}

// ── C. 게임 도중 재시작 → 스냅샷 재생 (연출 없이 최종 상태) ──────────────
{
  console.log('\n[C] 재시작 후 스냅샷 재생 (진행: 안전가옥 ⑥까지)');
  const { ctx, page } = await newPage();
  await page.evaluate(() => window._gmApplyTime(4000));   // 70분 이하 (안전가옥 ④ 조건)
  await page.evaluate(() => {
    const snapshot = [
      ['streetmega','streetmega-2',[22,23,24]],
      ['safehouse','safemega-1',[23,25,27,24,28,30]],
      ['disinfectmega-1','disinfectmega-2',[23,34]],
      ['BAR','barmega-1',[23,26,31]],
    ];
    snapshot.forEach(([slaveID, arduinoID, pins]) => {
      window.handleWebSocketMessage({ type:'slaveRegister', slaveID,
        arduinos:[{ arduinoID, pins: pins.map(p => ({ pin:p, state:'on' })) }] });
    });
  });
  await wait(500);
  let s = await snap(page); console.log('   0.5초 :', fmt(s), '| location', s.location.src);
  check('C1 즉시 최종 미션 표시', s.mission.visible && s.mission.src === 'mission9.png', fmt(s));
  check('C2 즉시 최종 디테일 표시', s.details.visible && s.details.src === 'details9-1.png', fmt(s));
  await wait(6000);
  s = await snap(page); console.log('   6.5초 :', fmt(s));
  check('C3 뒤늦게 옛 미션으로 안 바뀜', s.mission.src === 'mission9.png' && s.mission.visible, fmt(s));
  await ctx.close();
}

// ── D. 안전가옥 ⑤(15초 대기) 도중 ⑥ 태그 → 옛 미션이 튀어나오면 안 됨 ────
{
  console.log('\n[D] 안전가옥 ⑤(pin28, 15초) 도중 ⑥(pin30, 30초) 태그');
  const { ctx, page } = await newPage();
  await fire(page,'p22'); await fire(page,'s23'); await fire(page,'s25');
  await fire(page,'s28');
  await wait(5000);
  await fire(page,'s30');
  await wait(12000);                       // pin28 +17초 = 옛 v8 표시 시점이 지난 뒤
  let s = await snap(page); console.log('   pin28+17초 :', fmt(s));
  check('D1 옛 mission8 이 안 뜬다', s.mission.src !== 'mission8.png', fmt(s));
  await wait(20000);                       // pin30 +32초
  s = await snap(page); console.log('   pin30+32초 :', fmt(s));
  check('D2 최종 mission9 표시', s.mission.visible && s.mission.src === 'mission9.png', fmt(s));
  await ctx.close();
}

// ── E. 엔비바 ③(20초 대기) 도중 거리 ③(디테일만) → 둘 다 살아야 함 ──────
{
  console.log('\n[E] 엔비바 ③(pin31, 20초) 도중 거리 ③(street pin23 2차)');
  const { ctx, page } = await newPage();
  for (const k of ['p22','s23','s25','s27','st23','st24','b23','b26']) await fire(page,k);
  await wait(3000);
  await fire(page,'b31');                  // v6 : 20초 뒤 mission6 + details6-1 + location6-1
  await wait(4000);
  await fire(page,'st23');                 // v6_2 : 2초 뒤 details6-2 + location6-2
  await wait(4000);
  let s = await snap(page); console.log('   pin23+4초  :', fmt(s), '| location', s.location.src);
  check('E1 디테일 6-2 표시', s.details.visible && s.details.src === 'details6-2.png', fmt(s));
  await wait(15000);                       // pin31 +23초 (v6 표시 시점 통과)
  s = await snap(page); console.log('   pin31+23초 :', fmt(s), '| location', s.location.src);
  check('E2 메인 미션 6 은 정상 표시', s.mission.visible && s.mission.src === 'mission6.png', fmt(s));
  check('E3 디테일이 6-1 로 되돌아가지 않음', s.details.src === 'details6-2.png', fmt(s));
  check('E4 location 이 6-2 유지', s.location.src === 'location6-2.png', s.location.src);
  await ctx.close();
}

// ── F. 안전가옥 ④(30초 대기) 가 취소돼도 SNS 개방은 반드시 일어난다 ──────
{
  console.log('\n[F] 안전가옥 ④(pin24, 30초) 도중 ⑤(pin28) 태그 → SNS 개방 보장');
  const { ctx, page } = await newPage();
  await page.evaluate(() => window._gmApplyTime(4000));
  for (const k of ['p22','s23','s25','s27','st23','st24','b23','b26','b31','d34']) await fire(page,k);
  await wait(1000);
  await fire(page,'s24');                  // v7 : 30초 뒤 표시 + SNS 개방
  await wait(3000);
  await fire(page,'s28');                  // v8 : v7 의 화면 표시를 덮는다
  await wait(29000);
  const s = await snap(page);
  console.log('   SNS 버튼 :', s.sns.split('/').pop());
  check('F1 SNS 버튼 활성화됨', /SNS-activate/.test(s.sns), s.sns);
  await ctx.close();
}

// ── G. 엔딩 뒤에 옛 미션이 다시 뜨지 않는다 ─────────────────────────────
{
  console.log('\n[G] 박사방 ③(10초 대기) 도중 엔딩');
  const { ctx, page } = await newPage();
  for (const k of ['p22','s23','s25','s27','st23','b23','b26','b31','d34','s28','s30','d23']) await fire(page,k);
  await wait(1000);
  await fire(page,'d34');
  await page.evaluate(() => window.checkPinStatus('doctor','doctormega-1',27,'on'));
  await wait(3000);
  await page.evaluate(() => window.checkPinStatus('doctor','doctormega-1',26,'on'));  // v11 : 10초 뒤
  await wait(2000);
  await fire(page,'end');                  // 엔딩
  await wait(12000);
  const s = await snap(page); console.log('   엔딩+12초 :', fmt(s));
  check('G1 엔딩 화면에 미션이 다시 안 뜬다', !s.mission.visible && !s.details.visible, fmt(s));
  await ctx.close();
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
