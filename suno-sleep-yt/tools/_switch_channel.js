// youtube.com 활성 채널을 지정 채널로 전환만 한다 (yt_pin_switch.js 로직 재사용)
// PW_PROFILE=... node tools/_switch_channel.js "plum music"
const { chromium } = require('playwright');
const path = require('path');
const CHNAME = process.argv[2] || 'plum music';
const PROFILE = process.env.PW_PROFILE || path.join(__dirname, '..', '.pw-profile');
const log = (...a) => console.log('[switch]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome', headless: !process.env.HEADFUL,
    viewport: { width: 1500, height: 980 },
    ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'],
    args: ['--disable-blink-features=AutomationControlled'],
  });
  await ctx.addInitScript(() => { try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); } catch (e) {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(60000);
  // 이름 비교는 정규화 문자열 포함 여부로 (공백·보이지 않는 문자에 안전)
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9가-힣&]/g, '');
  const WANT = norm(CHNAME);
  const RE = { test: s => norm(s).includes(WANT) };
  async function activeChannel() {
    const av = await page.$('#avatar-btn') || await page.$('button#avatar-btn');
    if (!av) return '';
    await av.click(); await sleep(2500);
    const t = ((await page.textContent('#account-name').catch(() => '')) || '').trim();
    await page.keyboard.press('Escape').catch(() => {}); await sleep(1200);
    return t;
  }
  try {
    await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
    await sleep(6000);
    let active = await activeChannel();
    log('현재 활성 채널:', active || '(못 읽음)');
    for (let attempt = 1; attempt <= 3 && !RE.test(active); attempt++) {
      log(`전환 시도 ${attempt}/3`);
      const av = await page.$('#avatar-btn');
      if (!av) throw new Error('아바타 버튼 없음(로그아웃?)');
      await av.click(); await sleep(3000);
      let opened = false;
      for (const it of await page.$$('ytd-compact-link-renderer, tp-yt-paper-item, a#endpoint')) {
        const t = ((await it.innerText().catch(() => '')) || '').trim();
        if (/계정 전환|Switch account/i.test(t)) { await it.click(); opened = true; break; }
      }
      if (!opened) throw new Error('계정 전환 항목 없음');
      await sleep(4000);
      const seen = []; let clicked = false;
      for (const a of await page.$$('ytd-account-item-renderer')) {
        const t = ((await a.innerText().catch(() => '')) || '').trim();
        if (t) seen.push(t.split('\n')[0]);
        if (!RE.test(t)) continue;
        const target = (await a.$('#endpoint')) || (await a.$('a')) || (await a.$('tp-yt-paper-item')) || a;
        await target.click({ force: true }); clicked = true; break;
      }
      if (!clicked) throw new Error('채널 못 찾음. 보임: ' + JSON.stringify(seen));
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await sleep(9000);
      active = await activeChannel();
      log('전환 후:', active || '(못 읽음)');
    }
    if (!RE.test(active)) throw new Error('전환 반영 안 됨: ' + active);
    log('✅ 전환 완료:', active);
  } catch (e) {
    await page.screenshot({ path: path.join(__dirname, '_switch_err.png') }).catch(()=>{});
    console.error('[switch] ❌', e.message);
    process.exitCode = 1;
  } finally { await ctx.close(); }
})();
