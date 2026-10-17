// card-replace.json → 시안.html(DO 카드 이름·한 줄) + pool.json(코스) 반영, 이어서 POOL·PHOTOS 다시 주입
// 실행: node apply-replace.cjs [card-replace2.json]
const fs = require('fs'), path = require('path');
const dir = __dirname, F = path.join(dir, '시안.html');
const rep = JSON.parse(fs.readFileSync(path.join(dir, process.argv[2] || 'card-replace.json'), 'utf8'));
let s = fs.readFileSync(F, 'utf8');
const q = t => String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
let nc = 0, miss = [];
for (const [key, v] of Object.entries(rep.cards || {})) {
  const [id, old] = [key.slice(0, key.indexOf('|')), key.slice(key.indexOf('|') + 1)];
  const a = s.indexOf(`{id:'${id}'`); const b = s.indexOf('\n {id:', a + 5); const end = b < 0 ? s.indexOf('\n];', a) : b;
  const blk = s.slice(a, end);
  const re = new RegExp(`\\['','${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}','[^']*'`);
  if (!re.test(blk)) { miss.push(key); continue; }
  s = s.slice(0, a) + blk.replace(re, `['','${q(v.name)}','${q(v.line)}'`) + s.slice(end); nc++;
}
const poolF = path.join(dir, 'pool.json'); const POOL = JSON.parse(fs.readFileSync(poolF, 'utf8')); let np = 0;
for (const [key, v] of Object.entries(rep.pool || {})) {
  const [id, old] = [key.slice(0, key.indexOf('|')), key.slice(key.indexOf('|') + 1)];
  const i = (POOL[id] || []).findIndex(x => x.n === old);
  if (i < 0) { miss.push('pool:' + key); continue; }
  POOL[id][i] = { k: v.k || POOL[id][i].k, n: v.n, city: v.city, line: v.line, c: v.c || POOL[id][i].c, snow: v.snow || 0, url: v.url }; np++;
}
fs.writeFileSync(poolF, JSON.stringify(POOL));
s = s.replace(/const POOL = .*;\n/, 'const POOL = ' + JSON.stringify(POOL) + ';\n');
fs.writeFileSync(F, s);
console.log('카드 교체', nc, '· 코스 교체', np, miss.length ? '· 못 찾음 ' + miss.join(', ') : '');
require('./inject-photos.cjs');
