// v140 정상 플레이 회귀 — 단계마다 미션/디테일/위치/진행도가 규격대로 뜨는지
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
let fail = 0, pass = 0;
page.on('pageerror', e => { fail++; console.log('  [pageerror]', e.message); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.checkPinStatus === 'function');
await page.evaluate(() => window._gmApplyTime(4000));   // 안전가옥 ④ 조건(70분 이하)

const snap = () => page.evaluate(() => {
  const g = sel => { const el = document.querySelector(sel); const cs = getComputedStyle(el);
    return { src:(el.getAttribute('src')||'').replace('assets/phone-img/',''), vis: cs.display!=='none' && +cs.opacity>0.05 }; };
  return { mission:g('.mission-img'), details:g('.details-img'), location:g('.location-current'),
           inprogress:g('.inprogress-img'), sns:((document.getElementById('sns-button')||{}).src||'').split('/').pop() };
});
const fire = (s,a,p) => page.evaluate(([s,a,p]) => window.checkPinStatus(s,a,p,'on'), [s,a,p]);

// [핀, 라벨, 대기(ms), 기대값]  기대값 null = 그 칸은 검사 안 함, '' = 비어 있어야 함
const STEPS = [
  [['streetmega','streetmega-2',22], '게임 시작',        1000, {}],
  [['safehouse','safemega-1',23],    '안전가옥 ①',       1200, { mission:'', details:'' }],
  [['safehouse','safemega-1',25],    '안전가옥 ②',       1500, { mission:'mission2.png', details:'details2.png', location:'location2.png', inprogress:'inprogress2.png' }],
  [['safehouse','safemega-1',27],    '안전가옥 ③',       3800, { mission:'mission3.png', details:'details3-1.png', location:'location3.png', inprogress:'inprogress3.png' }],
  [['disinfectmega-1','disinfectmega-2',23], '소독실 단서', 3800, { mission:'mission3.png', details:'details3-2.png' }],
  [['streetmega','streetmega-2',23], '거리 ① (1차)',     3800, { mission:'mission4.png', details:'details4-1.png', location:'location4-2.png', inprogress:'inprogress4.png' }],
  [['streetmega','streetmega-2',24], '거리 ②',           3800, { mission:'mission4.png', details:'details4-2.png' }],
  [['BAR','barmega-1',23],           '엔비바 ①',         3800, { mission:'mission4.png', details:'details4-3.png', location:'location4-3.png' }],
  [['BAR','barmega-1',26],           '엔비바 ② (정리)',  1200, { mission:'', details:'' }],
  [['BAR','barmega-1',31],           '엔비바 ③',        22000, { mission:'mission6.png', details:'details6-1.png', location:'location6-1.png', inprogress:'inprogress5.png' }],
  [['streetmega','streetmega-2',23], '거리 ③ (2차)',     3800, { mission:'mission6.png', details:'details6-2.png', location:'location6-2.png' }],
  [['disinfectmega-1','disinfectmega-2',34], '소독실 미션', 3800, { mission:'mission6.png', details:'details6-3.png', location:'location6-3.png' }],
  [['safehouse','safemega-1',24],    '안전가옥 ④',      32000, { mission:'mission7.png', details:'details7.png', location:'location7.png', inprogress:'inprogress6.png', sns:'SNS-activate.png' }],
  [['streetmega','streetmega-2',23], '거리 ④ (3차)',     3800, { mission:'mission7.png', details:'details9-2.png' }],
  [['safehouse','safemega-1',28],    '안전가옥 ⑤',      17000, { mission:'mission8.png', details:'details8.png', location:'location8.png', inprogress:'inprogress7.png' }],
  [['safehouse','safemega-1',30],    '안전가옥 ⑥',      32000, { mission:'mission9.png', details:'details9-1.png', location:'location9-1.png', inprogress:'inprogress8.png', sns:'SNS-deactivate.png' }],
  [['doctor','doctormega-1',27],     '박사방 ①',         3800, { mission:'mission10.png', details:'details10-1.png', location:'location10.png', inprogress:'inprogress9.png' }],
  [['doctor','doctormega-1',24],     '박사방 ②',         3800, { mission:'mission10.png', details:'details10-2.png' }],
  [['doctor','doctormega-1',26],     '박사방 ③',        12000, { mission:'mission11.png', details:'details11.png', location:'location11.png', inprogress:'inprogress10.png' }],
];

for (const [pin, label, ms, exp] of STEPS) {
  await fire(...pin);
  await wait(ms);
  const s = await snap();
  const bad = [];
  for (const k of ['mission','details','location','inprogress']) {
    if (exp[k] == null) continue;
    if (exp[k] === '') { if (s[k].vis) bad.push(`${k}: 비어야 하는데 ${s[k].src} 보임`); }
    else if (s[k].src !== exp[k]) bad.push(`${k}: ${s[k].src} (기대 ${exp[k]})`);
    else if (k !== 'inprogress' && !s[k].vis) bad.push(`${k}: ${exp[k]} 인데 안 보임`);
  }
  if (exp.sns && s.sns !== exp.sns) bad.push(`sns: ${s.sns} (기대 ${exp.sns})`);
  if (bad.length) { fail++; console.log(`  FAIL  ${label}  → ${bad.join(' / ')}`); }
  else { pass++; console.log(`  PASS  ${label.padEnd(14)} ${s.mission.src} + ${s.details.src}`); }
}

// 엔딩
await fire('streetmega','streetmega-2',26);
await wait(2000);
const e = await snap();
if (e.mission.vis || e.details.vis) { fail++; console.log('  FAIL  엔딩 → 미션이 남아 있음'); }
else { pass++; console.log('  PASS  엔딩'); }

console.log(`\n정상 플레이 회귀: ${pass} PASS / ${fail} FAIL`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
