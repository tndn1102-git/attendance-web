/* 전체 삭제 — 수집 기간(120일)이 끝나면 운영 D1(knara-stats)의 기록을 전부 지운다.
   사용:  npm run wipe -- --yes
   하는 일: ① 지우기 직전 사본을 data/wipe-backup/knara-<날짜>.sql 로 받아 둔다(wrangler d1 export)
            ② 세션·이벤트·오류 로그 3개 표를 비운다(표 구조는 남김 → 계속 수집 가능)
   --yes 없이 돌리면 현재 건수만 보여 주고 끝난다. 사본도 필요 없으면 --no-backup. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB = "knara-stats";
const yes = process.argv.includes("--yes");
const backup = !process.argv.includes("--no-backup");

function wrangler(args) {
  return execFileSync("npx", ["wrangler", ...args], { cwd: ROOT, encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "inherit"] });
}
function counts() {
  const out = wrangler(["d1", "execute", DB, "--remote", "--json", "--command",
    '"SELECT (SELECT COUNT(*) FROM knara_sessions) s, (SELECT COUNT(*) FROM knara_events) e, (SELECT COUNT(*) FROM knara_logs) l"']);
  const r = JSON.parse(out.slice(out.indexOf("[")))[0].results[0];
  return `세션 ${r.s} · 이벤트 ${r.e} · 오류 로그 ${r.l}`;
}

console.log(`[wipe] 현재 운영 DB: ${counts()}`);
if (!yes) { console.log("[wipe] 지우려면:  npm run wipe -- --yes"); process.exit(0); }

if (backup) {
  const dir = path.join(ROOT, "data", "wipe-backup");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `knara-${new Date().toISOString().slice(0, 10)}.sql`);
  wrangler(["d1", "export", DB, "--remote", "--output", `"${file}"`]);
  console.log(`[wipe] 사본 저장: ${file}`);
}
wrangler(["d1", "execute", DB, "--remote", "--command",
  '"DELETE FROM knara_events; DELETE FROM knara_sessions; DELETE FROM knara_logs;"']);
console.log(`[wipe] 삭제 완료 → ${counts()}`);
