// Mureka 라이브러리에서 "제목 매칭"으로 클립을 내려받는 복구/다운로드 전용 도구 (2026-09-02).
//   node tools/mureka_download.js <mureka-prompts 파일> --out <폴더> [--takes 1]
//
// ■ 왜 이 모양인가 (전부 실측)
//   · mureka_web.js 는 생성 제출 후 대기가 끊기면 재개 수단이 없다(pw-profile 충돌 사고).
//   · 라이브러리는 **가상화 리스트** — 한 번에 ~13행만 DOM에 있다. 전체 스캔 불가.
//   · 라이브러리 검색창은 fill()도 타이핑+Enter도 **무반응**(React 제어 + 동작 안 함). 쓰지 말 것.
//   → 정답 = **스크롤하며 마운트된 행을 그 자리에서 다운로드**. 키 = 제목|길이 로 중복 방지.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const PROMPTFILE = args.find(a => !a.startsWith('--'));
const OUT = args[args.indexOf('--out') + 1];
const TAKES = args.includes('--takes') ? parseInt(args[args.indexOf('--takes') + 1], 10) : 1;
if (!PROMPTFILE || !OUT) { console.error('필요: <프롬프트> --out <폴더>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const PROFILE = process.env.PW_PROFILE || path.join(__dirname, '..', '.pw-profile');
const log = (...a) => console.log('[mureka-dl]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const jf = path.join(require('os').tmpdir(), 'mureka_dl_songs.json');
execFileSync('py', ['-3', path.join(__dirname, 'mureka_gen.py'), PROMPTFILE, '--emit-json', jf],
             { encoding: 'utf8' });
let songs = JSON.parse(fs.readFileSync(jf, 'utf8'));
if (songs.songs) songs = songs.songs;
const wantPerSong = TAKES * 2;
log('곡', songs.length, '개 · 곡당 클립', wantPerSong, '개 목표');

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome', headless: !process.env.HEADFUL, viewport: { width: 1500, height: 980 },
    ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'],
    args: ['--disable-blink-features=AutomationControlled'],
    acceptDownloads: true,
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(60000);
  await page.goto('https://www.mureka.ai/create', { waitUntil: 'domcontentloaded' });
  await sleep(9000);

  // 마운트된 클립: 행(.search-result-item) 하나 = 곡 하나, 그 안에 클립(.song-audio-item)이 **2개** (2026-09-02 실측)
  //   [{rowIdx, subIdx, title, dur}]
  async function mounted() {
    return page.evaluate(() => {
      const out = [];
      [...document.querySelectorAll('.search-result-item')].forEach((r, rowIdx) => {
        const title = ((r.innerText || '').split(String.fromCharCode(10)).map(s => s.trim()).filter(Boolean)[0]) || '';
        [...r.querySelectorAll('.song-audio-item')].forEach((s, subIdx) => {
          const dur = ((s.innerText || '').match(/\b\d{1,2}:\d{2}\b/) || [])[0] || '';
          out.push({ rowIdx, subIdx, title, dur });
        });
      });
      return out;
    });
  }

  async function downloadRowIdx(rowIdx, subIdx, outPath) {
    await page.evaluate(([i, k]) => {
      const r = document.querySelectorAll('.search-result-item')[i];
      const s = r.querySelectorAll('.song-audio-item')[k];
      s.scrollIntoView({ block: 'center' });
      s.querySelector('.audio-item-more-btn-download').click();
    }, [rowIdx, subIdx]);
    await sleep(2500);
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 120000 }),
      page.evaluate(() => {
        const items = [...document.querySelectorAll('li, div, span, p')]
          .filter(e => (e.innerText || '').trim() === 'Download MP3' && e.offsetParent !== null);
        if (!items.length) throw new Error('Download MP3 메뉴 없음');
        items[items.length - 1].click();
      }),
    ]);
    await dl.saveAs(outPath);
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(1200);
  }

  const wanted = new Map(songs.map((s, i) => [norm(s.title), { i, title: s.title, got: 0 }]));
  const seenKeys = new Set();
  const manifest = [];
  const totalWant = songs.length * wantPerSong;

  // 기존 매니페스트가 있으면 이어받는다 (같은 클립 재다운로드 방지)
  const mfPath = path.join(OUT, '_mureka_web_manifest.json');
  if (fs.existsSync(mfPath)) {
    for (const m of JSON.parse(fs.readFileSync(mfPath, 'utf8'))) {
      if (!m.file) continue;
      manifest.push(m);
      seenKeys.add(norm(m.title) + '|0|' + (m.dur || ''));   // 기존 파일은 전부 subIdx 0(테이크A)이었다
      const w = wanted.get(norm(m.title));
      if (w) w.got++;
    }
    log('이어받기:', manifest.length, '클립은 이미 있음');
  }

  // 라이브러리 스크롤 컨테이너를 찾아 픽셀 단위로 훑는다 (scrollIntoView 점프는 중간 창을 건너뛴다 — 실측)
  async function scrollTo(top) {
    return page.evaluate(t => {
      const el = document.querySelector('.search-result-item');
      if (!el) return -1;
      let c = el.parentElement;
      while (c && c.scrollHeight <= c.clientHeight + 10) c = c.parentElement;
      if (!c) return -1;
      c.scrollTop = t;
      return c.scrollTop;
    }, top);
  }
  // 선로드: 바닥까지 스크롤 → 추가 페이지 로드 대기 → scrollHeight 가 안 늘 때까지 반복
  async function containerHeight() {
    return page.evaluate(() => {
      const el = document.querySelector('.search-result-item');
      if (!el) return -1;
      let c = el.parentElement;
      while (c && c.scrollHeight <= c.clientHeight + 10) c = c.parentElement;
      return c ? c.scrollHeight : -1;
    });
  }
  let lastH = -2;
  for (let k = 0; k < 20; k++) {
    await scrollTo(999999);
    await sleep(3000);
    const h = await containerHeight();
    log('선로드: scrollHeight', h);
    if (h === lastH) break;
    lastH = h;
  }
  await scrollTo(0);
  await sleep(1500);

  let stale = 0;
  let pos = 0;
  while (manifest.filter(m => m.file).length < totalWant && stale < 3) {
    const rows = await mounted();
    let acted = false;
    for (const r of rows) {
      const w = wanted.get(norm(r.title));
      if (!w || w.got >= wantPerSong) continue;
      const key = norm(r.title) + '|' + r.subIdx + '|' + r.dur;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      w.got++;
      const fileNo = w.i * wantPerSong + w.got;
      const safe = w.title.replace(/[\\/:*?"<>|]/g, '_');
      const file = path.join(OUT, `${String(fileNo).padStart(2, '0')}_${safe}.mp3`);
      try {
        // idx 는 방금 읽은 스냅샷 기준 — 행마다 다시 읽어 클릭 직전 idx 를 재확인한다
        const fresh = await mounted();
        const hit = fresh.find(x => norm(x.title) === norm(r.title) && x.dur === r.dur && x.subIdx === r.subIdx);
        if (!hit) { log('  (스크롤로 사라짐, 다음 패스에서)', r.title, r.dur); w.got--; seenKeys.delete(key); continue; }
        await downloadRowIdx(hit.rowIdx, hit.subIdx, file);
        log('받음:', path.basename(file), `(${r.dur})`);
        manifest.push({ index: fileNo, title: w.title, dur: r.dur, file });
        acted = true;
      } catch (e) {
        log('! 실패:', w.title, r.dur, e.message);
        manifest.push({ index: fileNo, title: w.title, dur: r.dur, error: e.message });
        acted = true;
      }
    }
    if (!acted) {
      pos += 300;
      const got = await scrollTo(pos);
      await sleep(1200);
      if (got >= 0 && got < pos - 5) {      // 끝에 닿음 → 처음부터 한 번 더 (최대 stale 3회전)
        stale++;
        pos = 0;
        await scrollTo(0);
        await sleep(1200);
      }
    } else {
      // 다운로드 후 스크롤 위치가 흔들릴 수 있으니 현재 위치를 복원
      await scrollTo(pos);
      await sleep(600);
    }
  }

  manifest.sort((a, b) => a.index - b.index);
  fs.writeFileSync(path.join(OUT, '_mureka_web_manifest.json'), JSON.stringify(manifest, null, 1), 'utf8');
  const ok = manifest.filter(x => x.file).length;
  for (const [, w] of wanted) if (w.got < wantPerSong) log(`⚠️ ${w.title}: ${w.got}/${wantPerSong}클립`);
  log(`완료: ${ok}/${totalWant} → ${OUT}`);
  await ctx.close();
  process.exitCode = ok === totalWant ? 0 : 1;
})();
