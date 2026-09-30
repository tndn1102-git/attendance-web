// Mureka feed/list 전 페이지 수집 (읽기 전용) — node tools/_mureka_feed_all.js <out.json>
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const OUT = process.argv[2] || 'tools/_mureka_feed_all.json';
const PROFILE = process.env.PW_PROFILE || path.join(__dirname, '..', '.pw-profile');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, { channel: 'chrome', headless: true,
    ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'], args: ['--disable-blink-features=AutomationControlled'] });
  const page = ctx.pages()[0] || await ctx.newPage();
  let req = null;
  page.on('request', r => { if (/api\/pgc\/feed\/list/.test(r.url()) && !req) req = { url: r.url(), method: r.method(), headers: r.headers(), post: r.postData() }; });
  await page.goto('https://www.mureka.ai/create', { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 20 && !req; i++) await sleep(1000);
  await sleep(2000);
  console.log('req', req && req.method, req && req.url, req && req.post);
  const res = await page.evaluate(async (req) => {
    const all = []; let last = null;
    for (let p = 0; p < 60; p++) {
      let url = req.url, body = req.post;
      if (last) {
        if (req.method === 'GET') url += '&last_id=' + last;
        else { const b = JSON.parse(body || '{}'); b.last_id = last; body = JSON.stringify(b); }
      }
      const h = Object.assign({}, req.headers); delete h['content-length'];
      const r = await fetch(url, { method: req.method, headers: h, body: req.method === 'GET' ? undefined : body, credentials: 'include' });
      const j = await r.json(); const d = j.data || {};
      all.push(...(d.list || [])); if (!d.more || !d.last_id || d.last_id === last) break; last = d.last_id;
      const t = (d.list || []).slice(-1)[0]; if (t && t.generate_at < 1787600000) break; // ~08-25 이전이면 중단
    }
    return all;
  }, req);
  fs.writeFileSync(OUT, JSON.stringify(res), 'utf8'); console.log('feeds', res.length);
  await ctx.close();
})();
