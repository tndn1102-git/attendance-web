// 시안 카드·추천 코스용 사진 수집 (한국관광공사 TourAPI KorService2)
// 조건: 음식점(39)·숙박(32)·쇼핑(38) 제외, 공공누리 Type1, 주소가 해당 도. 결과 = photos.json (출처 대장 겸용)
// 실행: node fetch-photos.mjs   (키는 ../../.env 의 TOUR_API_KEY)
import fs from 'fs';
const env = fs.readFileSync(new URL('../../.env', import.meta.url), 'utf8');
const KEY = (env.match(/^TOUR_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!KEY) throw new Error('TOUR_API_KEY 없음');
const OUT = new URL('./photos.json', import.meta.url);
const CACHE = new URL('./.photo-cache.json', import.meta.url);
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const ADDR = { jn: ['전남', '광주', '전라남도'], gb: ['경북', '대구', '경상북도'], cc: ['충북', '충남', '대전', '세종', '충청'], sg: ['서울', '경기', '인천'], jj: ['제주'], jb: ['전북', '전라북도'], gw: ['강원'], gn: ['경남', '부산', '울산', '경상남도'] };
const SKIP_TYPE = new Set(['39', '32', '38']);
let calls = 0;
async function search(kw) {
  if (cache[kw]) return cache[kw];
  const u = `https://apis.data.go.kr/B551011/KorService2/searchKeyword2?serviceKey=${KEY}&MobileOS=ETC&MobileApp=knara&_type=json&numOfRows=20&pageNo=1&arrange=O&keyword=${encodeURIComponent(kw)}`;
  calls++;
  const r = await fetch(u); const t = await r.text();
  let items = [];
  try { const j = JSON.parse(t); items = [].concat(j.response?.body?.items?.item || []); } catch { console.error('응답 이상', kw, t.slice(0, 120)); }
  cache[kw] = items.map(i => ({ id: i.contentid, type: i.contenttypeid, title: i.title, addr: i.addr1, img: i.firstimage, cp: i.cpyrhtDivCd }));
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  return cache[kw];
}
const STOP = new Set(['체험', '축제', '마을', '골목', '거리', '한상', '야경', '리액션', '굽기', '오르기', '한입', '직접', '공방', '마당', '한', '상']);
const toks = s => s.split(/[\s·()\/,]+/).filter(t => t.length >= 2 && !STOP.has(t));
function ok(i, doId) { return i.img && i.cp === 'Type1' && !SKIP_TYPE.has(String(i.type)) && ADDR[doId].some(a => (i.addr || '').startsWith(a) || (i.addr || '').includes(a + ' ')); }
async function find(doId, names) {
  const tried = new Set();
  for (const n of names) {
    const kws = [n, ...toks(n).sort((a, b) => b.length - a.length)];
    for (const kw of kws) {
      if (tried.has(kw) || kw.length < 2) continue; tried.add(kw);
      const hit = (await search(kw)).find(i => ok(i, doId));
      if (hit) return { ...hit, kw };
      if (tried.size >= 3) break;
    }
  }
  return null;
}
// 대상 = 시안 카드(DO) + 추천 코스(POOL)
const html = fs.readFileSync(new URL('./시안.html', import.meta.url), 'utf8');
const POOL = JSON.parse(fs.readFileSync(new URL('./pool.json', import.meta.url), 'utf8'));
const DO = Function('return ' + html.match(/const DO = (\[[\s\S]*?\n\]);/)[1])();
const res = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { cards: {}, pool: {} };
for (const d of DO) for (const s of ['s1', 's2', 's3']) for (const c of d[s]) {
  const key = d.id + '|' + c[1]; if (res.cards[key] !== undefined) continue;
  const p = POOL[d.id].find(x => toks(x.n).some(t => c[1].includes(t)));
  res.cards[key] = await find(d.id, [c[1], p?.n].filter(Boolean));
}
for (const id in POOL) for (const x of POOL[id]) {
  const key = id + '|' + x.n; if (res.pool[key] !== undefined) continue;
  res.pool[key] = await find(id, [x.n, x.city + ' ' + x.n]);
}
fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
const cnt = o => [Object.values(o).filter(Boolean).length, Object.keys(o).length];
console.log('API 호출', calls, '· 카드', cnt(res.cards).join('/'), '· 코스', cnt(res.pool).join('/'));
