// 힌트폰: 종료 신호를 받으면 타이머가 "끝까지" 멈춰 있는지 (v142)
//
// 예전 문제: showEndingScreen() 이 clearInterval 만 하고 timerInterval·endTime 을 그대로 뒀다.
//   · endTime 이 남아 있어서 restoreTimer()(ws 재연결마다 호출)가 타이머를 도로 켰다  → "중간에 다시 간다"
//   · timerInterval 이 truthy 로 남아 _gmApplyTime 이 "진행 중"으로 오해하고 startTimer() 를 불렀다
//   · 같은 이유로 __time__ 보고도 계속 나가 뷰어 시계까지 되살렸다              → "뷰어도 다시 간다"
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

const browser = await chromium.launch();
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n} → ${d}`); } };

async function phone() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => { fail++; console.log('  [pageerror]', e.message); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.checkPinStatus === 'function');
  return { ctx, page,
    state: () => page.evaluate(() => ({
      stopped: timerStopped, hasInterval: timerInterval !== null, endTime: endTime,
      sec: timeRemaining, shown: (document.getElementById('timer') || {}).textContent })),
    run: fn => page.evaluate(fn),
  };
}

// ── 엔딩 ────────────────────────────────────────────────────────────────
console.log('\n[엔딩] 종료 신호 → 타이머 확정 정지');
{
  const p = await phone();
  await p.run(() => { timeRemaining = 3000; startTimer(); });
  let s = await p.state();
  check('(준비) 타이머가 돌고 있다', s.hasInterval && !s.stopped, JSON.stringify(s));

  await p.run(() => checkPinStatus('streetmega', 'streetmega-2', 26, 'on'));
  s = await p.state();
  check('엔딩 → 확정 정지 표시', s.stopped === true, JSON.stringify(s));
  check('★ timerInterval 을 null 로 비운다 (truthy 로 남으면 "진행 중"으로 오해받는다)', !s.hasInterval, JSON.stringify(s));
  check('★ endTime 도 비운다 (남으면 restoreTimer 가 되살린다)', s.endTime === null, JSON.stringify(s));

  const before = (await p.state()).sec;
  await wait(2500);
  s = await p.state();
  check('2.5초 뒤에도 남은시간 그대로', s.sec === before, `${before} → ${s.sec}`);

  // ws 재연결 (게임이 끝난 뒤에도 계속 일어난다)
  await p.run(() => restoreTimer());
  await wait(1500);
  s = await p.state();
  check('★★ ws 재연결(restoreTimer)에도 다시 흐르지 않는다', !s.hasInterval && s.sec === before, JSON.stringify(s));

  // GM 시간 적용 / 다른 폰에서의 자동 동기화
  await p.run(() => _gmApplyTime(1234));
  await wait(1500);
  s = await p.state();
  check('★★ 시간 적용·자동동기화에도 다시 흐르지 않는다', !s.hasInterval, JSON.stringify(s));
  await wait(1200);
  const s2 = await p.state();
  check('적용된 값에서 카운트다운이 시작되지 않는다', s2.sec === s.sec, `${s.sec} → ${s2.sec}`);
  check('__time__ 보고도 멈춘다 (조건이 timerInterval 이므로)', !s2.hasInterval, JSON.stringify(s2));

  // 다시 시작 시도 자체를 막는다
  await p.run(() => startTimer());
  await wait(1200);
  s = await p.state();
  check('startTimer() 를 직접 불러도 무시된다', !s.hasInterval, JSON.stringify(s));

  await p.ctx.close();
}

// ── TIME OUT (자연 종료) ────────────────────────────────────────────────
console.log('\n[TIME OUT] 0초 도달도 되돌릴 수 없어야 한다');
{
  const p = await phone();
  await p.run(() => { timeRemaining = 1; startTimer(); });
  await wait(2500);
  let s = await p.state();
  check('0초 도달 → 확정 정지', s.stopped === true && !s.hasInterval, JSON.stringify(s));
  check('TIME OUT 표시', /TIME OUT/.test(s.shown || ''), s.shown);
  await p.run(() => restoreTimer());
  await wait(1200);
  s = await p.state();
  check('★ ws 재연결에도 되살아나지 않는다', !s.hasInterval, JSON.stringify(s));
  await p.ctx.close();
}

// ── 초기화하면 풀린다 (다음 팀) ─────────────────────────────────────────
console.log('\n[초기화] 다음 팀을 위해 확정 정지가 풀려야 한다');
{
  const p = await phone();
  await p.run(() => { timeRemaining = 3000; startTimer(); });
  await p.run(() => checkPinStatus('streetmega', 'streetmega-2', 26, 'on'));
  check('(준비) 엔딩으로 정지', (await p.state()).stopped === true, '');
  await p.run(() => window.resetScreen());
  let s = await p.state();
  check('초기화 → 확정 정지 해제 + 1:40:00', s.stopped === false && s.sec === 6000, JSON.stringify(s));
  await p.run(() => startTimer());
  await wait(1200);
  s = await p.state();
  check('★ 초기화 뒤에는 타이머가 정상 동작', s.hasInterval && s.sec < 6000, JSON.stringify(s));
  await p.ctx.close();
}

console.log(`\n타이머 확정 정지: ${pass} PASS / ${fail} FAIL`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
