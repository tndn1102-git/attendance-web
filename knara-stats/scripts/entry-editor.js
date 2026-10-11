/* 입장 페이지 문구 편집 서버 (운영사 PC 로컬 전용) — D:\test3\report-editor 와 같은 방식.
 *   npm run edit-entry      →  http://localhost:5178/entry/
 *
 * 브라우저에서 글자를 클릭해 고치고 저장(Ctrl+S)하면 entry/index.html 안의
 * <script type="application/json" id="entry-text"> 블록만 다시 써서 원본 파일에 기록한다(다른 줄은 손대지 않음).
 * 덮어쓰기 전에 data/entry-backup/ 에 타임스탬프 사본을 남긴다. "배포" 버튼은 `wrangler deploy` 를 실행한다.
 * 이 서버는 통계를 적재하지 않는다(/api/track 은 빈 응답). */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = path.join(ROOT, "entry", "index.html");
const BACKUP_DIR = path.join(ROOT, "data", "entry-backup");
const CLIENT = path.join(ROOT, "scripts", "entry-editor-client.js");
const PORT = Number(process.env.EDITOR_PORT) || 5178;
const LIVE_URL = "https://knara.tndn1102.workers.dev/entry/";

const BLOCK = /(<script type="application\/json" id="entry-text">)([\s\S]*?)(<\/script>)/;
const STATIC = { "/track.js": "track.js", "/assets/theme.css": "assets/theme.css" };
const MIME = { ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

function send(res, status, type, body, extra) {
  res.writeHead(status, Object.assign({ "Content-Type": type, "Cache-Control": "no-store" }, extra || {}));
  res.end(body);
}
const json = (res, status, obj) => send(res, status, "application/json; charset=utf-8", JSON.stringify(obj));

function stamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/* JSON 블록 포맷: 객체는 줄마다 키 하나, 배열·문자열은 한 줄 — 파일 diff 가 읽히게 */
function fmt(v, ind) {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const keys = Object.keys(v);
    if (!keys.length) return "{}";
    return "{\n" + keys.map((k) => ind + "  " + JSON.stringify(k) + ": " + fmt(v[k], ind + "  ")).join(",\n") + "\n" + ind + "}";
  }
  return JSON.stringify(v);
}

function validate(d) {
  if (!d || typeof d !== "object") throw new Error("JSON 형식이 아닙니다");
  if (!d.common || typeof d.common.ORG !== "string" || typeof d.common.CONTACT !== "string") throw new Error("common.ORG / CONTACT 누락");
  if (!d.T || !d.T.ko) throw new Error("T.ko 누락");
  const need = ["title", "vsub", "tag", "sub", "intro", "info", "age", "gender", "optional", "consent", "start", "skip", "needAgree", "h_collect", "h_no", "h_why", "h_keep", "keep"];
  for (const lang of Object.keys(d.T)) {
    const t = d.T[lang];
    for (const k of need) if (typeof t[k] !== "string" || !t[k].trim()) throw new Error(lang + "." + k + " 이(가) 비었습니다");
    if (!Array.isArray(t.ages) || t.ages.length !== 6) throw new Error(lang + ".ages 는 6개여야 합니다");
    if (!Array.isArray(t.genders) || t.genders.length !== 3) throw new Error(lang + ".genders 는 3개여야 합니다");
    for (const k of ["collect", "no", "why"]) if (!Array.isArray(t[k]) || !t[k].length) throw new Error(lang + "." + k + " 이(가) 비었습니다");
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function inject(html) {
  const client = fs.readFileSync(CLIENT, "utf8");
  const boot = '\n<script data-editor="1">window.__EDITOR_LIVE__=' + JSON.stringify(LIVE_URL) + ";</script>\n<script data-editor=\"1\">\n" + client + "\n</script>\n";
  const i = html.lastIndexOf("</body>");
  return i === -1 ? html + boot : html.slice(0, i) + boot + html.slice(i);
}

let deploying = false;
function deploy() {
  return new Promise((resolve) => {
    const isWin = process.platform === "win32";
    const child = spawn(isWin ? "wrangler.cmd" : "wrangler", ["deploy"], { cwd: ROOT, shell: isWin, windowsHide: true });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("error", (e) => resolve({ ok: false, log: String(e.message) }));
    child.on("close", (code) => {
      const m = out.match(/https:\/\/[\w.-]+\.workers\.dev/);
      resolve({ ok: code === 0, code, url: m ? m[0] : null, log: out.replace(/\x1b\[[0-9;]*m/g, "").trim().split("\n").slice(-12).join("\n") });
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  try {
    if (req.method === "OPTIONS") return send(res, 204, "text/plain", "");

    if (p === "/" || p === "/entry" || p === "/entry/" || p === "/entry/index.html") {
      if (p !== "/entry/") { res.writeHead(302, { Location: "/entry/" + url.search }); return res.end(); }
      return send(res, 200, "text/html; charset=utf-8", inject(fs.readFileSync(ENTRY, "utf8")));
    }
    if (STATIC[p]) return send(res, 200, MIME[path.extname(p)], fs.readFileSync(path.join(ROOT, STATIC[p])));
    if (p === "/favicon.ico") return send(res, 200, "image/svg+xml; charset=utf-8", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><text y="13" font-size="13">📝</text></svg>');

    if (p === "/api/track" || p === "/api/log") return json(res, 200, { ok: true, n: 0, db: "editor" });   // 편집 중엔 적재하지 않음

    if (p === "/api/save" && req.method === "POST") {
      const data = JSON.parse(await readBody(req));
      validate(data);
      const html = fs.readFileSync(ENTRY, "utf8");
      if (!BLOCK.test(html)) throw new Error("entry/index.html 에서 entry-text 블록을 찾지 못했습니다");
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      fs.copyFileSync(ENTRY, path.join(BACKUP_DIR, `index_${stamp()}.html`));
      const next = html.replace(BLOCK, (_, a, __, c) => a + "\n" + fmt(data, "") + "\n" + c);
      fs.writeFileSync(ENTRY, next, "utf8");
      const t = new Date().toTimeString().slice(0, 8);
      console.log(`[저장] entry/index.html ${t}`);
      return json(res, 200, { ok: true, time: t });
    }

    if (p === "/api/deploy" && req.method === "POST") {
      if (deploying) return json(res, 409, { ok: false, log: "이미 배포 중입니다" });
      deploying = true;
      console.log("[배포] wrangler deploy 시작");
      const r = await deploy();
      deploying = false;
      console.log(r.ok ? `[배포] 완료 ${r.url || ""}` : `[배포] 실패\n${r.log}`);
      return json(res, r.ok ? 200 : 500, r);
    }

    send(res, 404, "text/plain; charset=utf-8", "not found");
  } catch (e) {
    console.error("[오류]", e.message);
    json(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`입장 페이지 편집기 → http://localhost:${PORT}/entry/`);
  console.log(`  원본 파일 : ${ENTRY}`);
  console.log(`  백업 위치 : ${BACKUP_DIR}`);
  console.log(`  저장 = Ctrl+S 또는 [저장] · 반영 = [배포] (wrangler deploy) · 끄기 = Ctrl+C`);
});
