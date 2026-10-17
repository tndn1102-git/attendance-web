// photos.json(검수 끝난 것만) → 시안.html 의 PHOTOS 자리에 넣는다. 실행: node inject-photos.cjs
const fs = require('fs'), path = require('path');
const dir = __dirname, F = path.join(dir, '시안.html');
const P = JSON.parse(fs.readFileSync(path.join(dir, 'photos.json'), 'utf8'));
const slim = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v && v.img && v.checked !== false && v.exact !== false)
  .map(([k, v]) => [k, { img: v.img, t: v.title || '', src: v.src || '한국관광공사', by: v.by || '' }]));
const data = { cards: slim(P.cards), pool: slim(P.pool) };
let s = fs.readFileSync(F, 'utf8');
s = s.replace(/\/\*PHOTOS\*\/[\s\S]*?\/\*\/PHOTOS\*\//, '/*PHOTOS*/' + JSON.stringify(data) + '/*/PHOTOS*/');
fs.writeFileSync(F, s);
console.log('카드', Object.keys(data.cards).length, '/ 코스', Object.keys(data.pool).length);
