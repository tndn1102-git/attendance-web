// K의 나라(팔도 여행 편) 빌드: app.html + content.json + i18n/*.json → game/index.html
//   node game-src/build.mjs            게임 빌드
//   node game-src/build.mjs --strings  번역할 한국어 원문 목록을 i18n/source.json 으로 (번역 작업용)
import fs from 'fs'; import path from 'path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const SRC = path.join(ROOT, 'game-src'), I18N = path.join(SRC, 'i18n');
const app = fs.readFileSync(path.join(SRC, 'app.html'), 'utf8');
const C = JSON.parse(fs.readFileSync(path.join(SRC, 'content.json'), 'utf8'));
const LANGS = ['en', 'ja', 'zh', 'es'];

function collect() {
  const set = new Set();
  const add = s => { if (typeof s === 'string' && /[가-힣]/.test(s)) set.add(s); };
  for (const m of app.matchAll(/\bL\('((?:[^'\\]|\\.)*)'/g)) add(m[1].replace(/\\'/g, "'"));
  // 코드 안 변수로 넘기는 원문
  ['뷰티', '먹방', '음식', '관광', '여행', '전통', '방송국형', '다큐형', '라이브형', '브이로그형', '첫째 날', '둘째 날', '오전', '점심', '오후', '저녁',
   '그 뒤 이야기 ›', '나랑 잘 맞은 곳은? ›', '실제로 가 보기 ›', '내 채널 결산 ›', '마지막 한 장면 ›'].forEach(add);
  for (const d of C.DO) { add(d.name); add(d.sub); for (const k of ['s1', 's2', 's3']) for (const c of d[k]) { add(c[0]); add(c[1]); } }
  C.S4TEXT.forEach(t => add(t[0]));
  for (const k in C.E24) for (const q in C.E24[k]) C.E24[k][q].forEach(add);
  for (const k in C.E_LOCAL) C.E_LOCAL[k].forEach(add);
  for (const k in C.E_SP) C.E_SP[k].forEach(add);
  Object.values(C.TYPE21).forEach(add); C.CH_NAMES.forEach(add); C.DREAMS.forEach(add); C.MANAGER_LINES.forEach(add);
  for (const k in C.GAMES) { add(C.GAMES[k][1]); add(C.GAMES[k][2]); }
  for (const id in C.POOL) for (const x of C.POOL[id]) { add(x.n); add(x.city); add(x.line); }
  return [...set];
}

if (process.argv.includes('--strings')) {
  fs.mkdirSync(I18N, { recursive: true });
  const list = collect();
  fs.writeFileSync(path.join(I18N, 'source.json'), JSON.stringify(list, null, 1));
  console.log('번역할 원문', list.length, '개 → game-src/i18n/source.json');
  process.exit(0);
}

// 번역 합치기: i18n/<lang>.json = { "한국어 원문": "번역" }
const I = {}; const miss = {};
for (const l of LANGS) {
  const f = path.join(I18N, l + '.json'); if (!fs.existsSync(f)) { miss[l] = 'no file'; continue; }
  const t = JSON.parse(fs.readFileSync(f, 'utf8')); let n = 0;
  for (const [k, v] of Object.entries(t)) if (v) { (I[k] = I[k] || {})[l] = v; n++; }
  miss[l] = n;
}
const strings = collect();
const lacking = Object.fromEntries(LANGS.map(l => [l, strings.filter(s => !(I[s] && I[s][l])).length]));
const json = o => JSON.stringify(o).replace(/</g, '\\u003c');
let out = app.replace('/*CONTENT*/null/*/CONTENT*/', json(C)).replace('/*I18N*/{}/*/I18N*/', json(I));
fs.writeFileSync(path.join(ROOT, 'game/index.html'), out);
console.log(`game/index.html ${(out.length / 1024).toFixed(0)}KB · 원문 ${strings.length} · 번역 없는 원문 수`, lacking);
