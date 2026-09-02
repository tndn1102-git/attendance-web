// Mureka feed/list API 응답을 캡처해 파일로 저장 (다운로드는 mureka_fetch_dl.py 가 담당)
//   node tools/mureka_fetch_feed.js <출력.json>
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.argv[2] || 'tools/_mureka_feed.json';
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
  let saved = false;
  page.on('response', async res => {
    if (!/api\/pgc\/feed\/list/.test(res.url())) return;
    try {
      const body = await res.text();
      fs.writeFileSync(OUT, body, 'utf8');
      saved = true;
    } catch (e) {}
  });
  await page.goto('https://www.mureka.ai/create', { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 20 && !saved; i++) await sleep(1000);
  await sleep(2000);
  console.log(saved ? ('저장 → ' + OUT) : '⚠️ feed/list 응답을 못 봤다');
  await ctx.close();
  process.exitCode = saved ? 0 : 1;
})();
