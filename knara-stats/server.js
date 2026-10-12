/* 독립 Node 서버 진입점 — 발주처 서버·로컬 검증용. Vercel 과 같은 lib/http.js 를 감싼다.
   실행:  DATABASE_URL=... STATS_KEY=... node server.js   (PORT 기본 8787)
   정적 파일(대시보드·수집 스니펫)은 화이트리스트로만 서빙한다. */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nodeHandler } from "./lib/http.js";
import { ready } from "./lib/db.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
loadDotEnv(path.join(ROOT, ".env"));

const PORT = parseInt(process.env.PORT || "8787", 10);
const STATIC = {
  "/": "index.html",
  "/index.html": "index.html",
  "/track.js": "track.js",
  "/assets/theme.css": "assets/theme.css",
  "/assets/dash.css": "assets/dash.css",
  "/assets/dash.js": "assets/dash.js",
  "/assets/print.css": "assets/print.css",
  "/entry": "entry/index.html",
  "/entry/": "entry/index.html",
  "/entry/index.html": "entry/index.html",
  "/game": "game/index.html",
  "/game/": "game/index.html",
  "/game/index.html": "game/index.html",
};
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://local");
  if (url.pathname.startsWith("/api/")) return nodeHandler(req, res);
  if (url.pathname === "/favicon.ico") { res.statusCode = 204; return res.end(); }
  // 게임 그림(game/img/**.jpg|png)은 폴더 밖으로 못 나가게 이름만 검사해서 서빙
  const img = /^\/game\/img\/[A-Za-z0-9_\-\/]+\.(jpg|png)$/.test(url.pathname) && !url.pathname.includes("..") ? url.pathname.slice(1) : null;
  const rel = STATIC[url.pathname] || img;
  if (!rel) { res.statusCode = 404; res.setHeader("Content-Type", "text/plain; charset=utf-8"); return res.end("not found"); }
  const file = path.join(ROOT, rel);
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end("not found"); }
    res.setHeader("Content-Type", MIME[path.extname(file)] || "application/octet-stream");
    res.setHeader("Cache-Control", rel === "track.js" ? "public, max-age=300" : "no-cache");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (rel === "track.js") res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(buf);
  });
});

server.keepAliveTimeout = 65000; // 로컬 대량 전송 시 keep-alive 경합(ECONNRESET) 완화
server.headersTimeout = 70000;

ready()
  .then((db) => {
    server.listen(PORT, () => {
      console.log(`[knara-stats] http://localhost:${PORT}  (db=${db.kind}, key=${process.env.STATS_KEY ? "설정됨" : "없음!"})`);
    });
  })
  .catch((e) => { console.error("[knara-stats] DB 초기화 실패:", e.message); process.exit(1); });

function loadDotEnv(file) {
  // 의존성 없는 최소 .env 로더(이미 설정된 환경변수는 덮어쓰지 않음)
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m || line.trim().startsWith("#")) continue;
      if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* .env 없음 */ }
}
