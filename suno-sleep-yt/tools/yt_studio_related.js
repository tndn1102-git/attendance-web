// YouTube Studio — 쇼츠의 "관련 동영상(Related video)" 을 본편으로 지정한다.
//   node tools/yt_studio_related.js <shortsId> <mainVideoId>
//
// ■ 왜 Studio 자동화인가
//   Data API 에 엔드포인트가 아예 없다(§9 · yt_upload.py 머리말에도 명시).
//   그런데 이게 없으면 쇼츠 시청자가 본편으로 갈 길이 없다 —
//   쇼츠 댓글의 링크는 플레이어에서 안 넘어간다(2026-06-03 실측).
//
// ■ ⚠️ 전제: **본편이 공개(public)된 뒤에만** 선택지에 뜬다.
//   비공개·예약 상태인 본편은 목록에 안 나온다. 쇼츠가 예약 상태인 것은 상관없다.
//
// ■ 구조 (2026-08-26 작성)
//   Studio 영상 편집 화면 → "관련 동영상" 섹션 → 동영상 선택 다이얼로그 →
//   URL/ID 로 검색 → 결과 클릭 → 완료 → 저장.
//   yt_studio_altered.js 와 같은 함정을 그대로 물려받는다:
//     · 자동화 인터스티셜(SKIP TO YOUTUBE STUDIO) 통과
//     · 폼이 길어 **뷰포트 밖 버튼은 클릭이 안 먹는다** → 먼저 스크롤
//     · "더보기(Show more)" 를 펼쳐야 하위 섹션이 보인다
const { chromium } = require('playwright');
const path = require('path');

const SHORT = process.argv[2];
const MAIN = process.argv[3];
if (!SHORT || !MAIN) { console.error('필요: <shortsId> <mainVideoId>'); process.exit(2); }
const PROFILE = process.env.PW_PROFILE || path.join(__dirname, '..', '.pw-profile');
const log = (...a) => console.log('[related]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome',
    headless: !process.env.HEADFUL,
    viewport: { width: 1500, height: 980 },
    ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'],
    args: ['--disable-blink-features=AutomationControlled'],
  });
  await ctx.addInitScript(() => { try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); } catch (e) {} });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(60000);

  try {
    await page.goto(`https://studio.youtube.com/video/${SHORT}/edit`, { waitUntil: 'domcontentloaded' });
    await sleep(6000);
    for (let i = 0; i < 3; i++) {
      const skip = await page.$('text=/SKIP TO YOUTUBE STUDIO/i') || await page.$('a:has-text("SKIP")');
      if (!skip) break;
      log('SKIP 클릭'); await skip.click(); await sleep(5000);
    }
    await sleep(3000);

    // 폼을 펼치고 아래로 — 관련 동영상은 '더보기' 안쪽에 있다
    for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 900); await sleep(500); }
    for (const s of ['#toggle-button', 'ytcp-button#toggle-button',
                     'ytcp-button:has-text("Show more")', 'ytcp-button:has-text("더보기")']) {
      const el = await page.$(s + ' >> visible=true');
      if (el) { await el.click({ force: true }).catch(() => {}); log('더보기 펼침'); await sleep(3500); break; }
    }
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 900); await sleep(400); }
    await sleep(1500);

    // 관련 동영상 섹션의 버튼을 연다
    const opened = await page.evaluate(() => {
      // 🐞 2026-09-02 실측: "Related video"는 버튼이 아니라 ytcp-dropdown-trigger 다
      const btns = [...document.querySelectorAll('ytcp-dropdown-trigger, ytcp-button, button')];
      const hit = btns.find(b => /관련 동영상|Related video|동영상 선택|Select video/i.test(b.innerText || ''));
      if (!hit) return 'button-not-found';
      hit.scrollIntoView({ block: 'center' });
      hit.click();
      return 'ok';
    });
    log('관련 동영상 버튼:', opened);
    if (opened !== 'ok') throw new Error('관련 동영상 버튼을 못 찾음 — 화면 구조 확인');
    await sleep(4000);

    // 🔧 2026-09-02 실측 개편: 다이얼로그(ytcp-video-pick-dialog)는 내 채널 영상 목록 + #search-yours 검색창.
    //    본편 제목을 oEmbed(무인증·공개 영상)로 얻어 제목으로 검색하고 그 행을 클릭한다.
    const title = await new Promise((resolve, reject) => {
      require('https').get(`https://www.youtube.com/oembed?url=https://youtu.be/${MAIN}&format=json`, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d).title); } catch (e) { reject(new Error('oEmbed 파싱 실패(본편이 공개 상태인지 확인): ' + d.slice(0, 120))); } });
      }).on('error', reject);
    });
    log('본편 제목:', title);
    // 검색어 = 제목에서 이모지·기호를 뺀 구간 중 **한글 구간 우선** 가장 긴 것.
    // 🐞 2026-09-02: 가장 긴 것만 고르면 "Chill Cafe Music"(전 편 공통 꼬리)이 뽑혀
    //    다른 편 본편이 지정된다(실제 발생 — EP06 쇼츠에 EP08 이 붙었다).
    const segs = title.split(/[^\p{L}\p{N} ]+/u).map(s => s.trim()).filter(s => s.length >= 4);
    const ko = segs.filter(s => /[가-힣]/.test(s)).sort((a, b) => b.length - a.length);
    const q = ko[0] || segs.sort((a, b) => b.length - a.length)[0];
    log('검색어:', q);

    await page.waitForSelector('ytcp-video-pick-dialog', { timeout: 15000 });
    const box = await page.$('ytcp-video-pick-dialog #search-yours');
    if (!box) throw new Error('#search-yours 검색칸을 못 찾음');
    await box.fill(q);
    await sleep(3500);

    const picked = await page.evaluate((needle) => {
      const dlg = document.querySelector('ytcp-video-pick-dialog');
      if (!dlg) return 'no-dialog';
      const rows = [...dlg.querySelectorAll('[role="option"]')];
      const hit = rows.find(r => (r.innerText || '').includes(needle));
      if (!hit) return 'no-result: ' + rows.length + '행 중 매칭 0';
      hit.scrollIntoView({ block: 'center' });
      hit.click();
      return 'ok';
    }, q);
    log('검색 결과 선택:', picked);
    if (picked !== 'ok') throw new Error('행 선택 실패 — ' + picked);
    await sleep(2500);

    for (const s of ['ytcp-video-pick-dialog ytcp-button:has-text("완료")',
                     'ytcp-video-pick-dialog ytcp-button:has-text("Done")',
                     'ytcp-video-pick-dialog ytcp-button:has-text("Select")']) {
      const el = await page.$(s + ' >> visible=true');
      if (el) { await el.click().catch(() => {}); log('완료 클릭'); break; }
    }
    await sleep(3000);

    // 드롭다운 라벨이 None 에서 바뀌었는지 되읽기 (클릭했다≠반영됐다)
    const label = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('ytcp-dropdown-trigger')];
      const hit = btns.find(b => /관련 동영상|Related video/i.test(b.innerText || ''));
      return hit ? (hit.innerText || '').replace(/\n/g, ' / ') : '(트리거 못 찾음)';
    });
    log('선택 후 라벨:', label);
    if (/None|없음/i.test(label)) throw new Error('선택이 반영되지 않음: ' + label);
    if (!label.includes(q)) throw new Error('⛔ 엉뚱한 본편이 지정됨 — 라벨에 검색어가 없다: ' + label);

    for (const s of ['#save >> visible=true', 'ytcp-button:has-text("저장") >> visible=true',
                     'ytcp-button:has-text("Save") >> visible=true']) {
      const el = await page.$(s);
      if (el && (await el.getAttribute('disabled')) === null) { await el.click(); log('저장 클릭'); break; }
    }
    await sleep(5000);
    await page.screenshot({ path: path.join(__dirname, `_related_${SHORT}.png`) });
    log('스크린샷: tools/_related_' + SHORT + '.png');
  } catch (e) {
    try { await page.screenshot({ path: path.join(__dirname, `_related_err_${SHORT}.png`), fullPage: true }); } catch {}
    console.error('[related] ❌ 실패:', e.message);
    process.exitCode = 1;
  } finally {
    await ctx.close();
  }
})();
