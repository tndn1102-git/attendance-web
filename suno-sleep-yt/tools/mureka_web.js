// Mureka 웹 UI 자동화 — 곡 생성·다운로드 (2026-09-02 신설, EP08 첫 사용)
//   node tools/mureka_web.js probe                          : 로그인·페이지 상태 정찰(스크린샷)
//   node tools/mureka_web.js shot <url> <out.png>           : 특정 URL 스크린샷
// 공통: 사람 속도(행동 사이 1.5~4초 랜덤), 스텔스 설정은 auto_gemini_bg.js 와 동일 계열.
const { chromium } = require('playwright');
const path = require('path');

const PROFILE = process.env.PW_PROFILE || path.join(__dirname, '..', '.pw-profile-b');
const log = (...a) => console.log('[mureka]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const human = () => sleep(1500 + Math.random() * 2500);

async function launch() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome',
    headless: !process.env.HEADFUL,
    viewport: { width: 1440, height: 900 },
    ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'],
    args: ['--disable-blink-features=AutomationControlled'],
  });
  await ctx.addInitScript(() => { try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); } catch (e) {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(60000);
  return { ctx, page };
}

(async () => {
  const cmd = process.argv[2] || 'probe';
  const { ctx, page } = await launch();
  try {
    if (cmd === 'probe') {
      await page.goto('https://www.mureka.ai/', { waitUntil: 'domcontentloaded' });
      await sleep(8000);
      await page.screenshot({ path: 'tools/_mureka_probe_home.png' });
      log('home url =', page.url());
      // 로그인 흔적: 아바타/크레딧/Sign in 버튼
      const signin = await page.$('text=/sign in|log in|로그인/i');
      log('signin-button =', signin ? 'VISIBLE(미로그인)' : 'none(로그인 상태일 수 있음)');
      await human();
      await page.goto('https://www.mureka.ai/song-create', { waitUntil: 'domcontentloaded' }).catch(e => log('song-create 이동 실패:', e.message));
      await sleep(8000);
      await page.screenshot({ path: 'tools/_mureka_probe_create.png' });
      log('create url =', page.url());
    } else if (cmd === 'login') {
      await page.goto('https://www.mureka.ai/', { waitUntil: 'domcontentloaded' });
      await sleep(8000);
      const btn = await page.$('text=/try free now|sign in|log in/i');
      if (!btn) { log('로그인 버튼 없음 — 이미 로그인?'); await page.screenshot({ path: 'tools/_mureka_login0.png' }); return; }
      await human(); await btn.click(); await sleep(6000);
      await page.screenshot({ path: 'tools/_mureka_login1.png' });
      // 구글 로그인 버튼 찾기 (팝업이 뜰 수 있어 대기)
      const g = await page.$('text=/google/i');
      if (g) {
        await human();
        const pop = ctx.waitForEvent('page', { timeout: 20000 }).catch(() => null);
        await g.click();
        const p2 = await pop;
        await sleep(7000);
        const tgt = p2 || page;
        await tgt.screenshot({ path: 'tools/_mureka_login2.png' }).catch(e => log('shot2 실패:', e.message));
        log('oauth url =', tgt.url());
        // 계정 선택 화면이면 목록을 찍는다
        const accounts = await tgt.$$eval('div[data-identifier]', els => els.map(e => e.getAttribute('data-identifier'))).catch(() => []);
        log('계정 후보 =', JSON.stringify(accounts));
        if (process.env.PICK_ACCOUNT) {
          const sel = await tgt.$(`div[data-identifier="${process.env.PICK_ACCOUNT}"]`);
          if (sel) { await human(); await sel.click(); await sleep(9000);
            await page.screenshot({ path: 'tools/_mureka_login3.png' });
            log('선택 후 url =', page.url()); }
        }
      } else {
        log('구글 버튼 못 찾음');
      }
    } else if (cmd === 'shot') {
      const url = process.argv[3], out = process.argv[4] || 'tools/_mureka_shot.png';
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await sleep(8000);
      await page.screenshot({ path: out, fullPage: false });
      log('shot →', out, '| url =', page.url());
    }
  } finally {
    await ctx.close();
  }
})();
