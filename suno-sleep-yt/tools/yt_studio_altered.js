// YouTube Studio — 영상의 "변경된 콘텐츠 / 합성 콘텐츠" 표기를 켠다 (업로드 API 에 필드 없음)
// 사용: node tools/yt_studio_altered.js <videoId>
const { chromium } = require('playwright');
const path = require('path');

const VID = process.argv[2];
if (!VID) { console.error('필요: <videoId>'); process.exit(2); }
const PROFILE = process.env.PW_PROFILE || path.join(__dirname, '..', '.pw-profile');
const log = (...a) => console.log('[studio]', ...a);
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

  try {
    // 🔴 [2026-08-27] 채널 컨텍스트를 먼저 잡아야 한다.
    //   .pw-profile 이 다른 채널(plum)에 들어가 있으면 /video/<id>/edit 이
    //   'Oops, something went wrong.' 로 죽는다 — 계정이 같아도 그렇다.
    //   CHANNEL 환경변수로 채널 Studio 를 먼저 열어 컨텍스트를 전환한다.
    if (process.env.CHANNEL) {
      log('채널 컨텍스트 전환:', process.env.CHANNEL);
      await page.goto(`https://studio.youtube.com/channel/${process.env.CHANNEL}`, { waitUntil: 'domcontentloaded' });
      await sleep(7000);
      for (let i = 0; i < 3; i++) {
        const s0 = await page.$('text=/SKIP TO YOUTUBE STUDIO/i');
        if (!s0) break; await s0.click(); await sleep(5000);
      }
      await sleep(2000);
    }
    await page.goto(`https://studio.youtube.com/video/${VID}/edit`, { waitUntil: 'domcontentloaded' });
    await sleep(6000);

    // Studio 가 자동화 브라우저를 막는 인터스티셜 통과
    for (let i = 0; i < 3; i++) {
      const skip = await page.$('text=/SKIP TO YOUTUBE STUDIO/i') || await page.$('a:has-text("SKIP")');
      if (!skip) break;
      log('SKIP 클릭'); await skip.click(); await sleep(5000);
    }
    await sleep(4000);

    // 🐞 1차엔 바로 #toggle-button 을 찾아 눌렀는데 **안 눌렸다**(로그에 '더보기 펼침' 없음).
    //   Studio 는 폼이 길어서 버튼이 뷰포트 밖이면 클릭이 안 먹는다 → **먼저 아래로 스크롤**한다.
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 900);
      await sleep(600);
    }
    await sleep(1500);
    let opened = false;
    for (const s of ['#toggle-button', 'ytcp-button#toggle-button',
                     'ytcp-button:has-text("Show more")', 'ytcp-button:has-text("더보기")']) {
      const el = await page.$(s + ' >> visible=true');
      if (el) {
        await el.scrollIntoViewIfNeeded().catch(() => {});
        await sleep(500);
        await el.click({ force: true }).catch(() => {});
        opened = true; log('더보기 펼침:', s); await sleep(4000); break;
      }
    }
    if (!opened) log('⚠️ 더보기 버튼을 못 찾음 (이미 펼쳐져 있을 수도 있음)');
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 900); await sleep(500); }
    await sleep(2000);

    // 🐞 2차 실패 원인 (2026-08-08 진단):
    //   ① 앵커 문구 "Generates a realistic-looking scene…" 는 DOM 에 **있었다**. 그런데 그게
    //      **라디오 버튼보다 아래**(예시 설명 목록)에 있어서 "앵커 뒤의 Yes" 를 찾으면 못 잡는다.
    //   ② 앵커를 여러 개 돌리며 clicked 를 덮어써서 진짜 실패 이유(yes-not-found)가 가려졌다.
    //   → 처방: 앵커는 **섹션 존재 확인용**으로만 쓰고,
    //           클릭 대상은 **innerText 가 정확히 'Yes' 인 라디오**로 잡는다.
    //     (아동용 = "Yes, it's made for kids…" · 연령제한 = "Yes, restrict my video…" 이므로
    //      정확히 'Yes' 인 것은 합성 콘텐츠 하나뿐이다 — 실측으로 확인)
    const clicked = await page.evaluate(() => {
      const bad = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
      const leaves = [...document.querySelectorAll('body *')]
        .filter(e => !bad.has(e.tagName) && e.children.length === 0)
        .map(e => (e.textContent || '').trim());
      // 🐞 2026-10-03 Studio 문구 변경: "AI use / Was AI used to generate or edit… / Generate a realistic-looking scene" (Generates→Generate)
      const hasSection = leaves.some(t =>
        /Generates? a realistic-looking scene|altered or synthetic|Was AI used|^AI use$|합성|변경되거나/i.test(t));
      if (!hasSection) return 'section-not-found';

      const radios = [...document.querySelectorAll('tp-yt-paper-radio-button, ytcp-radio-button')];
      const exact = radios.filter(r => {
        const t = (r.innerText || '').trim();
        return t === 'Yes' || t === '예';
      });
      if (exact.length !== 1) return 'ambiguous-yes:' + exact.length;
      const yes = exact[0];
      if (yes.getAttribute('aria-checked') === 'true' || yes.hasAttribute('checked'))
        return 'already-yes';
      yes.scrollIntoView({ block: 'center' });
      yes.click();
      return 'ok';
    });
    log('합성 콘텐츠 라디오:', clicked);
    if (clicked !== 'ok') log('⚠️ 선택 실패 — 화면 구조 확인 필요');
    await sleep(2000);

    await sleep(2500);
    for (const s of ['#save >> visible=true', 'ytcp-button:has-text("저장") >> visible=true',
                     'ytcp-button:has-text("Save") >> visible=true']) {
      const el = await page.$(s);
      if (el && (await el.getAttribute('disabled')) === null) {
        await el.click(); log('저장 클릭'); break;
      }
    }
    await sleep(6000);
    await page.screenshot({ path: path.join(__dirname, '_studio_altered_result.png') });
    log('스크린샷: tools/_studio_altered_result.png');
  } catch (e) {
    try { await page.screenshot({ path: path.join(__dirname, '_studio_altered_error.png'), fullPage: true }); } catch {}
    console.error('[studio] ❌ 실패:', e.message);
    process.exitCode = 1;
  } finally {
    await ctx.close();
  }
})();
