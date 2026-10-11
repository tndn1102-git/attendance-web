/* 간단 린트 — 구형 엣지(EdgeHTML 18)·ES5 스니펫 호환을 깨는 구문이 들어갔는지 검사한다. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rules = [
  ["assets/dash.js", [/Object\.fromEntries/, /\.flat\(/, /\.replaceAll\(/, /\?\./, /\?\?/, /\bstatic\s+\w+\s*\(/, /#\w+\s*=/], "구형 엣지 미지원 구문"],
  ["track.js", [/=>/, /\blet\b/, /\bconst\b/, /`/, /\.\.\./, /\bclass\b/, /\basync\b/], "ES5 위반(스니펫은 가장 오래된 폰 브라우저에서도 돌아야 함)"],
  ["assets/dash.css", [/(?<![-\w])gap\s*:/, /(?<![-\w])inset\s*:/, /aspect-ratio/], "구형 엣지 미지원 CSS(gap 은 grid-gap 으로)"],
];
let bad = 0;
for (const [file, res, why] of rules) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  for (const re of res) {
    // 주석·문자열 안의 '...' 같은 오탐을 피하기 위해 주석 제거 후 검사
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const m = code.match(re);
    if (m) { bad++; console.log(`✗ ${file}: ${why} — ${re} → "${m[0]}"`); }
  }
}
console.log(bad ? `[lint] ${bad}건 위반` : "[lint] 통과 — 구형 엣지/ES5 호환 구문 위반 없음");
process.exit(bad ? 1 : 0);
