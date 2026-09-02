// 쇼츠 편집 페이지를 다시 열어 Related video 라벨을 되읽는다 (검증 전용, 수정 없음)
//   node tools/yt_verify_related.js <shortsId> [shortsId...]
const { chromium } = require('playwright');
const path = require('path');
const IDS = process.argv.slice(2);
if (!IDS.length) { console.error('필요: <shortsId>...'); process.exit(2); }
const PROFILE = process.env.PW_PROFILE || path.join(__dirname, '..', '.pw-profile');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome', headless: !process.env.HEADFUL, viewport: { width: 1500, height: 980 },
    ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'],
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(60000);
  let fail = 0;
  for (const id of IDS) {
    await page.goto('https://studio.youtube.com/video/' + id + '/edit', { waitUntil: 'domcontentloaded' });
    await sleep(7000);
    for (let i=0;i<3;i++){ const s=await page.$('text=/SKIP TO YOUTUBE STUDIO/i'); if(!s) break; await s.click(); await sleep(5000); }
    const label = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('ytcp-dropdown-trigger')];
      const hit = btns.find(b => /관련 동영상|Related video/i.test(b.innerText || ''));
      return hit ? (hit.innerText || '').replace(/\n/g, ' / ') : '(트리거 못 찾음)';
    });
    const ok = !/None|없음|못 찾음/i.test(label);
    if (!ok) fail++;
    console.log((ok ? '✅' : '❌'), id, '=>', label);
  }
  await ctx.close();
  process.exitCode = fail ? 1 : 0;
})();
