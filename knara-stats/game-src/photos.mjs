// 검수 끝난 사진(docs/restructure/photos.json)을 내려받아 600px webp 로 줄여 game/img/p/ 에 둔다.
// 게임은 같은 서버의 이 파일만 부른다(외부 사진 서버 호출 0). 실행: node game-src/photos.mjs
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { execFileSync } from 'child_process';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const SRC = path.join(ROOT, 'docs/restructure/photos.json');
const DL = path.join(ROOT, 'game-src/.photo-dl'); const OUT = path.join(ROOT, 'game/img/p');
fs.mkdirSync(DL, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const P = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const urls = new Set(); for (const g of ['cards', 'pool']) for (const v of Object.values(P[g] || {})) if (v && v.img && v.exact !== false) urls.add(v.img);
const map = {}; let got = 0, made = 0, bytes = 0;
for (const u of urls) {
  const id = crypto.createHash('sha1').update(u).digest('hex').slice(0, 10);
  const raw = path.join(DL, id + path.extname(new URL(u).pathname).toLowerCase());
  const out = path.join(OUT, id + '.webp');
  if (!fs.existsSync(raw)) { const r = await fetch(u); if (!r.ok) { console.error('받기 실패', r.status, u); continue; } fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer())); got++; }
  if (!fs.existsSync(out)) { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', "scale='min(600,iw)':-2", '-c:v', 'libwebp', '-quality', '70', out]); made++; }
  bytes += fs.statSync(out).size; map[u] = 'img/p/' + id + '.webp';
}
fs.writeFileSync(path.join(ROOT, 'game-src/photo-map.json'), JSON.stringify(map, null, 1));
console.log(`사진 ${Object.keys(map).length}장 · 새로 받음 ${got} · 변환 ${made} · 합계 ${(bytes / 1048576).toFixed(1)}MB`);
