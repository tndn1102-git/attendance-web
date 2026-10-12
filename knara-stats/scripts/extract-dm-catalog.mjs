/* 게임(game/index.html)에서 방·컨셉·DM 의뢰·유형 표를 뽑아 lib/catalog-dm.js 로 쓴다.
   게임의 DMS/KC/TYPES/CONFIG rooms 가 바뀌면 다시 돌린다:  node scripts/extract-dm-catalog.mjs
   게임 코드는 실행하지 않고, 해당 객체 리터럴 텍스트만 잘라 평가한다(문자열·숫자만 든 데이터). */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "game", "index.html"), "utf8");

// `const NAME = {` 부터 짝이 맞는 `}` 까지(문자열 안의 괄호는 건너뜀)
function literal(name) {
  const at = src.indexOf(`const ${name} = {`);
  if (at < 0) throw new Error(name + " 없음");
  let i = src.indexOf("{", at), depth = 0, q = null;
  const start = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === "`") { q = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) break;
  }
  return Function('"use strict"; return (' + src.slice(start, i + 1) + ");")();
}

const KC = literal("KC");
const DMS = literal("DMS");
const TYPES = literal("TYPES");

// 방: CONFIG 의 { id: 'land', city: { ko: '호남권' ... }, name: { ko: '...' } ... }
const ROOM_IDS = ["land", "speech", "life", "story", "island", "field", "mountain", "sea"];
const rooms = ROOM_IDS.map((id) => {
  const at = src.indexOf(`{ id: '${id}', city:`);
  const seg = src.slice(at, at + 1200);
  const city = (seg.match(/city: \{ ko: '([^']+)'/) || [])[1] || id;
  const name = (seg.match(/\bname: \{ ko: '([^']+)'/) || [])[1] || "";
  return { id, region: city, name };
});

const concepts = Object.fromEntries(Object.entries(KC).map(([k, v]) => [k, { name: v.ko, orn: v.orn, color: v.c }]));
const dms = [];
for (const [room, list] of Object.entries(DMS)) {
  list.forEach((d, i) => dms.push({ room, no: i + 1, concept: d.c, type: d.type, title: d.title, who: d.who, temp: !!d.temp }));
}
const types = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k.replace("|", "-"), { name: v[0], desc: v[1] }]));

const out = `/* 자동 생성 — node scripts/extract-dm-catalog.mjs (원본: game/index.html 의 CONFIG rooms · KC · DMS · TYPES)
   손으로 고치지 말 것. 생성 ${new Date().toISOString().slice(0, 10)} */
export const DM_ROOMS = ${JSON.stringify(rooms, null, 1)};
export const CONCEPTS = ${JSON.stringify(concepts, null, 1)};
export const DMS = ${JSON.stringify(dms)};
export const TYPES = ${JSON.stringify(types, null, 1)};
`;
writeFileSync(join(ROOT, "lib", "catalog-dm.js"), out);
console.log("rooms", rooms.map((r) => r.region + "/" + r.name).join(", "));
console.log("concepts", Object.keys(concepts).length, "· dms", dms.length, "· types", Object.keys(types).length);
