// 합성 콘텐츠(AI use) 표기가 **실제로 저장됐는지** 확인만 한다 (클릭 안 함).
//   node tools/yt_verify_altered.js <videoId> [<videoId> ...]
//
// ■ 왜 따로 만드나
//   yt_studio_altered.js 는 "라디오를 클릭했다"까지만 보고한다. 저장 버튼이 disabled 였거나
//   저장 전에 페이지가 닫혔으면 **ok 를 찍고도 반영이 안 된다.**
//   8편을 자동으로 돌린 뒤 눈으로 다 볼 수는 없으니 상태만 읽어서 확인한다.
const { chromium } = require('playwright');
const path = require('path');

const IDS = process.argv.slice(2);
if (!IDS.length) { console.error('필요: <videoId> [...]'); process.exit(2); }
const PROFILE = process.env.PW_PROFILE || path.join(__dirname, '..', '.pw-profile');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome',
    headless: !process.env.HEADFUL,
    viewport: { width: 1500, height: 980 },
    ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'],
    args: ['--disable-blink-features=AutomationControlled', ...(process.env.SHOWWIN ? [] : ['--window-position=-32000,-32000'])],
  });
  await ctx.addInitScript(() => { try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); } catch (e) {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(60000);
  let bad = 0;

  for (const vid of IDS) {
    let state = 'error';
    try {
      await page.goto(`https://studio.youtube.com/video/${vid}/edit`, { waitUntil: 'domcontentloaded' });
      await sleep(5500);
      for (let i = 0; i < 3; i++) {
        const skip = await page.$('text=/SKIP TO YOUTUBE STUDIO/i') || await page.$('a:has-text("SKIP")');
        if (!skip) break;
        await skip.click(); await sleep(4500);
      }
      for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 900); await sleep(450); }
      for (const s of ['#toggle-button', 'ytcp-button:has-text("Show more")', 'ytcp-button:has-text("더보기")']) {
        const el = await page.$(s + ' >> visible=true');
        if (el) { await el.click({ force: true }).catch(() => {}); await sleep(3500); break; }
      }
      for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 900); await sleep(400); }
      await sleep(1200);
      state = await page.evaluate(() => {
        const radios = [...document.querySelectorAll('tp-yt-paper-radio-button, ytcp-radio-button')];
        const exact = radios.filter(r => ['Yes', '예'].includes((r.innerText || '').trim()));
        if (exact.length !== 1) return 'ambiguous:' + exact.length;
        const y = exact[0];
        return (y.getAttribute('aria-checked') === 'true' || y.hasAttribute('checked')) ? 'YES' : 'NO';
      });
    } catch (e) {
      state = 'error:' + e.message.slice(0, 40);
    }
    if (state !== 'YES') bad++;
    console.log(`[verify] ${vid}  ${state === 'YES' ? '✅ AI 표시 ON' : '⛔ ' + state}`);
  }
  await ctx.close();
  console.log(`\n[verify] ${IDS.length - bad}/${IDS.length} 확인됨`);
  if (bad) process.exitCode = 1;
})();
