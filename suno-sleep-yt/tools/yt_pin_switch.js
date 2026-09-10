// youtube.com 의 활성 채널을 브랜드 채널로 전환한 뒤 내 댓글을 고정한다.
// 사용: node tools/yt_pin_switch.js <videoId> "<채널명>"
//
// ⚠ 왜 전환이 필요한가 (2026-08-08 실측):
//   Studio 는 URL 에 채널ID가 있어 소유자로 붙지만, youtube.com 은 **계정의 기본 채널**로 붙는다.
//   그래서 watch 페이지 댓글 ⋮ 메뉴에 소유자 항목(고정)이 안 뜨고 'Report' 하나만 나온다.
//   → 아바타 → 계정 전환 → 브랜드 채널 선택 후에야 고정이 보인다.
const { chromium } = require('playwright');
const path = require('path');

const VID = process.argv[2];
const CHNAME = process.argv[3] || '추억 감성가요';
if (!VID) { console.error('필요: <videoId> [채널명]'); process.exit(2); }
const PROFILE = path.join(__dirname, '..', '.pw-profile');
const log = (...a) => console.log('[pin]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome', headless: !process.env.HEADFUL,
    viewport: { width: 1500, height: 980 },
    ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'],
    args: ['--disable-blink-features=AutomationControlled', ...(process.env.SHOWWIN ? [] : ['--window-position=-32000,-32000'])],
  });
  await ctx.addInitScript(() => { try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); } catch (e) {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(60000);

  const shot = n => page.screenshot({ path: path.join(__dirname, '_pin_' + n + '.png') }).catch(() => {});

  const RE = new RegExp(CHNAME.replace(/\s+/g, '\\s*'));
// ⚠ 댓글 작성자 표기는 **핸들**(@plumplaylist)이라 채널명 RE 로는 못 잡는다.
//   4번째 인자 또는 PIN_AUTHOR 로 넘긴다. 기본값은 기존 동작 유지.
const AUTHOR_RE = new RegExp(process.argv[4] || process.env.PIN_AUTHOR || '추억\\s*감성가요|@chueokgamsung', 'i');

  // 현재 활성 채널을 읽는다 (아바타 메뉴를 열었다 닫음)
  async function activeChannel() {
    const av = await page.$('#avatar-btn') || await page.$('button#avatar-btn');
    if (!av) return '';
    await av.click();
    await sleep(2500);
    const t = ((await page.textContent('#account-name').catch(() => '')) || '').trim();
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(1200);
    return t;
  }

  try {
    // ── 1) 현재 활성 채널 확인 ──────────────────────────────
    await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
    await sleep(6000);

    let active = await activeChannel();
    log('현재 활성 채널:', active || '(못 읽음)');

    // ── 2) 계정 전환 (반영될 때까지 최대 3회) ────────────────
    // ⚠ 클릭이 먹은 것처럼 보여도 실제로는 안 바뀔 때가 있다(1차 실패 원인).
    //   반드시 전환 **후에 다시 읽어서** 확인할 것.
    for (let attempt = 1; attempt <= 3 && !RE.test(active); attempt++) {
      log(`계정 전환 시도 ${attempt}/3`);
      const av = await page.$('#avatar-btn');
      if (!av) throw new Error('아바타 버튼을 못 찾음 (로그아웃 상태?)');
      await av.click();
      await sleep(3000);

      let opened = false;
      for (const it of await page.$$('ytd-compact-link-renderer, tp-yt-paper-item, a#endpoint')) {
        const t = ((await it.innerText().catch(() => '')) || '').trim();
        if (/계정 전환|Switch account/i.test(t)) { await it.click(); opened = true; break; }
      }
      if (!opened) throw new Error('「계정 전환」 항목을 못 찾음');
      await sleep(4000);

      // 계정 행은 컨테이너가 아니라 **안쪽 클릭 타깃**을 눌러야 먹는다
      const seen = [];
      let clicked = false;
      for (const a of await page.$$('ytd-account-item-renderer')) {
        const t = ((await a.innerText().catch(() => '')) || '').trim();
        if (t) seen.push(t.split('\n')[0]);
        if (!RE.test(t)) continue;
        const target = (await a.$('#endpoint')) || (await a.$('a')) || (await a.$('tp-yt-paper-item')) || a;
        await target.click({ force: true });
        clicked = true;
        break;
      }
      if (!clicked) throw new Error('채널을 목록에서 못 찾음. 보이는 계정: ' + JSON.stringify(seen));

      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await sleep(9000);
      active = await activeChannel();
      log('전환 후 활성 채널:', active || '(못 읽음)');
    }

    if (!RE.test(active)) {
      await shot('switch');
      throw new Error(`계정 전환이 반영되지 않음 (현재: ${active}). tools/_pin_switch.png 확인`);
    }

    // ── 3) watch 페이지에서 고정 ─────────────────────────
    await page.goto(`https://www.youtube.com/watch?v=${VID}`, { waitUntil: 'domcontentloaded' });
    await sleep(8000);
    await page.keyboard.press('k').catch(() => {});
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, 900);
      await sleep(1100);
      if (await page.$('ytd-comment-thread-renderer')) break;
    }
    const threads = await page.$$('ytd-comment-thread-renderer');
    log('댓글 스레드', threads.length, '개');
    if (!threads.length) throw new Error('댓글이 로드되지 않음');

    let mine = null;
    for (const t of threads) {
      const author = await t.$eval('#author-text', e => e.innerText.trim()).catch(() => '');
      if (AUTHOR_RE.test(author)) { mine = t; log('내 댓글 발견:', author); break; }
    }
    if (!mine) throw new Error('내 댓글을 못 찾음');

    await mine.scrollIntoViewIfNeeded();
    await sleep(1500);
    await mine.hover().catch(() => {});
    await sleep(1000);
    const menu = await mine.$('#action-menu button, ytd-menu-renderer button');
    if (!menu) throw new Error('댓글 ⋮ 버튼을 못 찾음');
    await menu.click();
    await sleep(3000);

    const items = await page.$$('ytd-menu-service-item-renderer, tp-yt-paper-item');
    const labels = [];
    let done = false;
    // 🐞 [2026-09-10] 옛 정규식 /고정|Pin/i 는 "Unpin"·"고정 해제"도 잡았다.
    //   EP09 제작 때 채널 전환용으로 이 스크립트를 이미 고정된 영상에 돌렸다가 **고정을 풀어버렸다**
    //   (_switch.log "메뉴 클릭: Unpin"). → 해제 항목이 보이면 이미 고정된 것이니 아무것도 누르지 않는다.
    let already = false;
    for (const it of items) {
      const t = ((await it.innerText().catch(() => '')) || '').trim();
      if (t) labels.push(t);
      if (/unpin|고정\s*해제/i.test(t)) { already = true; continue; }
      if (/^(고정|pin)$/i.test(t)) { await it.click(); done = true; log('메뉴 클릭:', t); break; }
    }
    if (!done && already) {
      await page.keyboard.press('Escape').catch(() => {});
      log('✅ 이미 고정돼 있다 — 아무것도 누르지 않음');
      return;
    }
    if (!done) { await shot('menu'); throw new Error('고정 항목 없음. 메뉴: ' + JSON.stringify(labels)); }

    await sleep(2500);
    for (const s of ['button:has-text("고정")', 'button:has-text("PIN")', 'button:has-text("Pin")',
                     'yt-button-renderer:has-text("고정")']) {
      const b = await page.$(s + ' >> visible=true');
      if (b) { await b.click(); log('확인 클릭'); break; }
    }
    await sleep(5000);
    await shot('result');
    log('✅ 완료. 스크린샷: tools/_pin_result.png');
  } catch (e) {
    await shot('error');
    console.error('[pin] ❌ 실패:', e.message);
    process.exitCode = 1;
  } finally {
    await ctx.close();
  }
})();
