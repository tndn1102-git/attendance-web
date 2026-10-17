// 시안(docs/restructure/시안.html)의 내용 데이터를 뽑아 game-src/content.json 으로. 사진은 로컬 webp 경로로 바꾼다.
// 실행: node game-src/extract-content.mjs
import fs from 'fs'; import path from 'path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const html = fs.readFileSync(path.join(ROOT, 'docs/restructure/시안.html'), 'utf8');
const js = html.slice(html.indexOf('<script>\n') + 9, html.lastIndexOf('</script>'));
const a = js.indexOf('const POOL'), b = js.indexOf('let st;');
const g0 = js.indexOf('const GAMES='), g1 = js.indexOf('const MG=');
const code = js.slice(a, b) + '\n' + js.slice(g0, g1);
const esc = s => s;
const C = new Function('esc', code + '\nreturn {DO,S4TEXT,E24,E_LOCAL,E_SP,TYPE21,CH_NAMES,DREAMS,MANAGER_LINES,GAMES,POOL,PHOTOS};')(esc);
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'game-src/photo-map.json'), 'utf8'));
const full = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/restructure/photos.json'), 'utf8'));
const ph = (g, k) => { const v = full[g][k]; if (!v || !map[v.img]) return null; return { f: map[v.img], by: v.by || '', src: v.src || '한국관광공사' }; };
const PH = { cards: {}, pool: {} };
for (const d of C.DO) for (const s of ['s1', 's2', 's3']) for (const c of d[s]) { const k = d.id + '|' + c[1]; PH.cards[k] = ph('cards', k); if (!PH.cards[k]) console.warn('카드 사진 없음', k); }
for (const id in C.POOL) for (const x of C.POOL[id]) { const k = id + '|' + x.n; PH.pool[k] = ph('pool', k); if (!PH.pool[k]) console.warn('코스 사진 없음', k); }
// 이모지 자리(빈 문자열) 제거
const strip = arr => arr.map(c => c.slice(1));
const DO = C.DO.map(d => ({ id: d.id, name: d.name, sub: d.sub, s2multi: d.s2multi, s4: d.s4, lockNote: d.lockNote || '', s1: strip(d.s1), s2: strip(d.s2), s3: strip(d.s3) }));
const E24 = {}; for (const k in C.E24) { E24[k] = {}; for (const q in C.E24[k]) E24[k][q] = C.E24[k][q].slice(1); }
const E_LOCAL = {}; for (const k in C.E_LOCAL) E_LOCAL[k] = C.E_LOCAL[k].slice(1);
// 사진 기준으로 카드가 바뀌어 엔딩 문구가 카드와 어긋난 곳 바로잡기(지역 엔딩 = 그 도의 '현지인 추천' 카드 3장 기준)
Object.assign(E_LOCAL, {
  jn: ['남도 길잡이', '편백숲·돌게장·장불재, 현지인 길만 따라 걸었다', '동네 어르신들이 길을 물어 오는 채널'],
  gb: ['대게 철 기다리는 사람', '부용대에서 하회마을을 내려다보고, 대게 철엔 영덕으로 갔다', '대게 철마다 초대받는 손님'],
  cc: ['충청 장터 단골', '새우젓 시장에서 흥정하고 광천수에 발을 담갔다', '장날마다 기다려지는 장터 채널'],
  jb: ['지평선 들녘 이웃', '황금 들판을 걷고 춘향제 무대 앞에 앉았다', '들녘 마을의 공식 기록 채널'],
  gw: ['산골 밥상 기록자', '약수 한 바가지, 옹심이와 곤드레밥으로 하루를 채웠다', '강원 산골 밥상 기록 채널'],
});
E24.B.bc[1] = '팔도에서 찍은 뷰티 영상이 바다를 건넜다';
E24.H.bc[1] = '팔도의 소리와 춤이 아이돌 무대에 올랐다';
E24.H.vl[1] = '내 영상으로 아이들이 전통놀이를 배운다';
const E_SP = {}; for (const k in C.E_SP) E_SP[k] = C.E_SP[k].slice(1);
const out = { DO, S4TEXT: C.S4TEXT, E24, E_LOCAL, E_SP, TYPE21: C.TYPE21, CH_NAMES: C.CH_NAMES, DREAMS: C.DREAMS.map(x => x[1]), MANAGER_LINES: C.MANAGER_LINES, GAMES: C.GAMES, POOL: C.POOL, PH };
fs.writeFileSync(path.join(ROOT, 'game-src/content.json'), JSON.stringify(out, null, 1));
console.log('도', DO.length, '카드', DO.reduce((n, d) => n + d.s1.length + d.s2.length + d.s3.length, 0), '코스', Object.values(C.POOL).flat().length, '사진(카드/코스)', Object.values(PH.cards).filter(Boolean).length, Object.values(PH.pool).filter(Boolean).length);
