// Mureka 웹 생성 제출 전용 (2026-09-02 재작성 — 원본 mureka_web.js 가 다른 세션에 의해 스텁으로 덮여 유실).
//   node tools/mureka_generate.js <mureka-prompts 파일> [--model V7.6] [--dry-run] [--start N] [--end N]
//
// 제출만 한다. 다운로드는 feed/list API 방식(§_NEXT-Mureka-가입준비.md)으로 별도 진행.
// 셀렉터·함정은 전부 2026-08-30/09-02 실측 문서 기반:
//   · placeholder 로 잡는다(클래스는 재생성됨) · React 제어라 fill 후 되읽어 길이 대조(fillChecked)
//   · 모델 선택 = 상단 현재 모델 라벨 클릭 → 드롭다운에서 텍스트 일치 항목 클릭
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const PROMPTFILE = args.find(a => !a.startsWith('--'));
const MODEL = args.includes('--model') ? args[args.indexOf('--model') + 1] : 'V7.6';
// 곡별 Vocal Gender 버튼 (기본 = 자동감지: STYLE 에 'no female vocals' 있으면 Male)
const MALE_ARG = args.includes('--male-songs') ? args[args.indexOf('--male-songs') + 1].split(',').map(Number) : null;
const DRY = args.includes('--dry-run');
const START = args.includes('--start') ? parseInt(args[args.indexOf('--start') + 1], 10) : 1;
const END = args.includes('--end') ? parseInt(args[args.indexOf('--end') + 1], 10) : 999;
if (!PROMPTFILE) { console.error('필요: <프롬프트 파일>'); process.exit(2); }
const PROFILE = process.env.PW_PROFILE || path.join(__dirname, '..', '.pw-profile');
const log = (...a) => console.log('[mureka-gen]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const jf = path.join(require('os').tmpdir(), 'mureka_gen_songs.json');
execFileSync('py', ['-3', path.join(__dirname, 'mureka_gen.py'), PROMPTFILE, '--emit-json', jf], { encoding: 'utf8' });
let songs = JSON.parse(fs.readFileSync(jf, 'utf8'));
if (songs.songs) songs = songs.songs;
songs.forEach((s, i) => { s._no = i + 1; });
songs = songs.filter(s => s._no >= START && s._no <= END);
log('곡', songs.length, '개 · model', MODEL, DRY ? '· DRY-RUN' : '');

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome', headless: !process.env.HEADFUL, viewport: { width: 1500, height: 980 },
    ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'],
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(60000);
  await page.goto('https://www.mureka.ai/create', { waitUntil: 'domcontentloaded' });
  await sleep(9000);

  // Custom 탭 확인
  const custom = page.locator('text=Custom').first();
  if (await custom.count()) await custom.click().catch(() => {});
  await sleep(1500);

  // 모델 선택
  // ⚠️ 라이브러리 행에도 "V7.6" 배지가 있어 텍스트만으로 잡으면 엉뚱한 걸 누른다(실측) —
  //    좌측 폼 영역(x<740) + 라이브러리 행(.search-result-item) 밖으로 한정한다.
  const inForm = `e => { const r = e.getBoundingClientRect(); return r.x < 740 && r.width > 0 && !e.closest('.search-result-item'); }`;
  const curModel = await page.evaluate(() => {
    const ok = e => { const r = e.getBoundingClientRect(); return r.x < 740 && r.width > 0 && !e.closest('.search-result-item'); };
    const els = [...document.querySelectorAll('div,span')].filter(e => /^V[\d.]+(-all)?$/.test((e.innerText || '').trim()) && e.offsetParent !== null && ok(e));
    return els.length ? els[0].innerText.trim() : null;
  });
  log('현재 모델:', curModel);
  if (curModel !== MODEL) {
    // ⚠️ el-dropdown 은 JS el.click() 으로 안 열린다 — 실마우스 좌표 클릭 필수(2026-09-02 실측)
    const trig = await page.evaluate(() => {
      const ok = e => { const r = e.getBoundingClientRect(); return r.x < 740 && r.width > 0 && !e.closest('.search-result-item'); };
      const els = [...document.querySelectorAll('div,span')].filter(e => /^V[\d.]+(-all)?$/.test((e.innerText || '').trim()) && e.offsetParent !== null && ok(e));
      if (!els.length) return null;
      const r = els[0].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!trig) throw new Error('모델 트리거를 못 찾음');
    await page.mouse.click(trig.x, trig.y);
    await sleep(2500);
    const opt = await page.evaluate(m => {
      const items = [...document.querySelectorAll('span,div')]
        .filter(e => (e.innerText || '').trim() === m && e.offsetParent !== null &&
                     !e.closest('.search-result-item') && e.getBoundingClientRect().x < 740);
      if (!items.length) return null;
      const r = items[items.length - 1].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + 10 };
    }, MODEL);
    if (!opt) throw new Error('모델 드롭다운에서 ' + MODEL + ' 못 찾음');
    await page.mouse.click(opt.x, opt.y);
    log('모델 선택: ok (좌표 클릭)');
    await sleep(2500);
    const after = await page.evaluate(() => {
      const ok = e => { const r = e.getBoundingClientRect(); return r.x < 740 && r.width > 0 && !e.closest('.search-result-item'); };
      const els = [...document.querySelectorAll('div,span')].filter(e => /^V[\d.]+(-all)?$/.test((e.innerText || '').trim()) && e.offsetParent !== null && ok(e));
      return els.length ? els[0].innerText.trim() : null;
    });
    log('전환 후 모델:', after);
    if (after !== MODEL) throw new Error('모델 전환 반영 안 됨: ' + after);
  }

  async function fillChecked(loc, text, name) {
    await loc.click();
    await loc.fill(text);
    await sleep(700);
    const got = await loc.inputValue();
    if (got.length !== text.length) throw new Error(`${name} 입력 불일치: ${got.length}/${text.length}자`);
  }

  let submitted = 0;
  for (const s of songs) {
    const lyricsBox = page.locator('textarea[placeholder^="Enter lyrics here"]').first();
    const styleBox = page.locator('textarea[placeholder^="Enter style, mood"]').first();
    const titleBox = page.locator('input[placeholder="Enter song title"]').first();
    const male = MALE_ARG ? MALE_ARG.includes(s._no)
                          : /no female vocals/i.test((s.prompt || '') + (s.lyrics || ''));
    log(`제출 ${submitted + 1}/${songs.length} · ${s.title} (${male ? 'Male' : 'Female'})`);
    // Vocal Gender 버튼 — 좌측 폼 안의 Female/Male 텍스트 실마우스 클릭
    const gpos = await page.evaluate(g => {
      const items = [...document.querySelectorAll('div,span,button')]
        .filter(e => (e.innerText || '').trim() === g && e.offsetParent !== null &&
                     e.getBoundingClientRect().x < 740 && !e.closest('.search-result-item'));
      if (!items.length) return null;
      const r = items[items.length - 1].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, male ? 'Male' : 'Female');
    if (!gpos) throw new Error('Vocal Gender 버튼을 못 찾음');
    await page.mouse.click(gpos.x, gpos.y);
    await sleep(800);
    await fillChecked(lyricsBox, s.lyrics, '가사');
    await fillChecked(styleBox, s.prompt, '스타일');   // emit-json 필드명 = prompt (STYLE+꼬리 병합본)
    await fillChecked(titleBox, (s.title || '').slice(0, 50), '제목');
    if (DRY) { log('  [dry-run] Create 안 누름'); continue; }
    await page.locator('button:has-text("Create")').first().click();
    await sleep(6000);
    submitted++;
  }
  log(`제출 완료: ${submitted}건 (클립 ${submitted * 2}개 생성 중)`);
  await ctx.close();
})();
