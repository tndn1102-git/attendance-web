// 팔도 여행 편 끝까지 자동 플레이 시험 (헤드리스 크롬 + CDP, 추가 패키지 없음)
//   node game-src/e2e.mjs [lang]     → 콘솔 오류·화면 캡처(game-src/.e2e/)·플레이 기록 출력
// 전제: node server.js 가 8787 에서 떠 있음
import { spawn } from 'child_process'; import fs from 'fs'; import path from 'path'; import os from 'os';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const LANG = process.argv[2] || 'ko';
const OUT = path.join(ROOT, 'game-src/.e2e', LANG); fs.mkdirSync(OUT, { recursive: true });
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const port = 9300 + Math.floor(Math.random() * 500);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'knara-e2e-'));
const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=412,915', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const wait = new Map(); const errors = [];
async function connect() {
  for (let i = 0; i < 50; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = l.find(t => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {} await sleep(200); }
  throw new Error('크롬 연결 실패');
}
function send(method, params = {}) { return new Promise((res, rej) => { const i = ++id; wait.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }); }
async function ev(expr) { const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; }
let shotN = 0;
async function shot(name) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, String(++shotN).padStart(2, '0') + '_' + name + '.png'), Buffer.from(r.data, 'base64')); }
try {
  ws = new WebSocket(await connect());
  await new Promise(r => ws.onopen = r);
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { const w = wait.get(d.id); wait.delete(d.id); d.error ? w.rej(new Error(d.error.message)) : w.res(d.result); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map(a => a.value || a.description).join(' ')); };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  for (const dd of ['sg', 'gn']) { await send('Page.navigate', { url: `${process.env.BASE || "http://localhost:8787"}/game/?lang=${LANG}&demo=do:${dd}` }); await sleep(2200); await shot('cards_view_' + dd); const ow = await ev('return document.documentElement.scrollWidth'); if (ow > 412) errors.push('가로 넘침 ' + dd + ' ' + ow); }
  await send('Page.navigate', { url: `${process.env.BASE || "http://localhost:8787"}/game/?lang=${LANG}&staff` }); await sleep(2500);
  const H = `const w=ms=>new Promise(r=>setTimeout(r,ms)); const q=s=>document.querySelector(s); const pd=(el,t)=>el.dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:100,clientY:100,pointerId:1}));`;
  await shot('poster');
  await ev(H + `q('#go').click(); await w(300); q('[data-n]').click(); await w(900); q('[data-i]').click(); await w(400);`); await shot('map');
  const log = [];
  const cards = idd => ev(H + `q('[data-id="${idd}"]').click(); await w(300);
    document.querySelectorAll('[data-k="s1"]')[0].click(); await w(200);
    const s2=document.querySelectorAll('[data-k="s2"]'); s2[0].click(); await w(150); if(q('#s2ok')) q('#s2ok').click(); await w(200);
    document.querySelectorAll('[data-k="s3"]')[0].click(); await w(400);
    if(q('#slok')) q('#slok').click(); else document.querySelectorAll('[data-k="s4"]')[1].click(); await w(800); return document.querySelector('.gname')?.textContent;`);
  const fin = () => ev(H + `for(let i=0;i<160&&!q('#next');i++) await w(300); return q('.stars')?.textContent||q('.big')?.textContent;`);
  const next = () => ev(H + `q('#next').click(); await w(300);`);
  // 8도 각각 다른 놀이
  const plays = {
    jn: `for(let i=0;i<3;i++){ q('#tap').click(); await w(500);}`,
    gb: `for(let i=0;i<26;i++){ q('#bt').click(); await w(60);}`,
    cc: ``, // 받기: 기다리면 끝
    sg: ``, // 순서 기억: 8초 제한으로 저절로 끝남
    jj: `for(let i=0;i<3;i++){ const hb=q('#hb'); pd(hb,'pointerdown'); await w(1400); pd(hb,'pointerup'); await w(300);}`,
    jb: `const rp=q('#rp'); pd(rp,'pointerdown'); for(let i=0;i<120;i++){ rp.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:100+(i%2?40:-40),clientY:100,pointerId:1})); await w(15);} pd(rp,'pointerup');`,
    gw: `for(let i=0;i<40;i++){ const u=q('.hole.up'); if(u) u.click(); await w(250);}`,
    gn: ``,
  };
  for (const d of ['jn', 'gb', 'cc', 'sg', 'jj', 'jb', 'gw', 'gn']) {
    const g = await cards(d); if (d === 'jn' || d === 'jj') await shot('cards_' + d);
    await sleep(300); await shot('game_' + d);
    await ev(H + plays[d]); const r = await fin(); log.push(`${d} ${g} → ${r}`);
    if (d === 'jn') await shot('upload_' + d);
    await next();
  }
  await shot('map_done');
  await ev(H + `q('#fin').click(); await w(300); const up=q('#up'); pd(up,'pointerdown'); await w(1700); await w(2600);`);
  for (let i = 0; i < 6; i++) { await sleep(i === 1 ? 3600 : 400); await shot('ending' + i); if (i < 5) await ev(H + `q('#enext').click(); await w(300);`); }
  const end = await ev(H + `return {title: EN.R.e[0], key: EN.R.key, pin: !!q('#pin'), links: document.querySelectorAll('a[target=_blank]').length}`);
  await ev(H + `q('#pin').value='2026'; q('#pinok').click(); await w(400);`); await shot('goods');
  await ev(H + `q('#dex2').click(); await w(300);`); await shot('dex');
  const sid = await ev(`return (window.KStat&&KStat.sid)||sessionStorage.getItem('ks_sid')||null`);
  console.log(JSON.stringify({ lang: LANG, log, end, sid, errors }, null, 1));
} catch (e) { console.error('실패:', e.message, errors); try { await shot('FAIL'); console.error('화면:', await ev('return document.querySelector("#scr").innerText.slice(0,300)')); } catch {} process.exitCode = 1; }
finally { try { ws && ws.close(); } catch {} ch.kill(); }
