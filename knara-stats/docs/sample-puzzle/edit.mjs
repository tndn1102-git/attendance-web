/* 샘플 보고서 브라우저 편집기 — 글자를 클릭해 고치고 저장(Ctrl+S)하면 샘플보고서.html 이 바뀌고, [PDF 만들기]로 샘플보고서.pdf 를 다시 뽑는다.
   사용: node docs/sample-puzzle/edit.mjs  →  http://localhost:5179/report   (포트 바꾸기: EDITOR_PORT=5180)
   의존성 없음(node 내장 + 크롬 headless). 백업은 docs/sample-puzzle/backup/ 에 시각별로 남긴다. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const HTML = path.join(HERE, "샘플보고서.html");
const PDF = path.join(HERE, "샘플보고서.pdf");
const BACKUP = path.join(HERE, "backup");
const PORT = Number(process.env.EDITOR_PORT || 5179);
const CHROME = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => fs.existsSync(p));
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".pdf": "application/pdf", ".woff2": "font/woff2" };
const DOC_RE = /(<div class="doc">)([\s\S]*?)(<\/div>\s*<\/body>)/;

function send(res, code, body, type = "text/plain; charset=utf-8") { res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(body); }
function serveFile(res, file) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, "not found");
  send(res, 200, fs.readFileSync(file), MIME[path.extname(file).toLowerCase()] || "application/octet-stream");
}
function readBody(req) { return new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(b)); }); }

function makePdf() {
  if (!CHROME) return { ok: false, msg: "크롬/엣지를 찾지 못했습니다." };
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), "knara-report-edit-")), tmp = PDF + ".tmp.pdf";
  const r = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--allow-file-access-from-files", `--user-data-dir=${prof}`, "--virtual-time-budget=12000", "--run-all-compositor-stages-before-draw", `--print-to-pdf=${tmp}`, "--no-pdf-header-footer", "--window-size=1000,1400", "file:///" + HTML.replace(/\\/g, "/")], { encoding: "utf8", timeout: 90000 });
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
  if (!fs.existsSync(tmp) || fs.statSync(tmp).size < 5000) return { ok: false, msg: "PDF 생성 실패: " + (r.stderr || "").slice(-200) };
  try { fs.renameSync(tmp, PDF); } catch (e) { try { fs.unlinkSync(tmp); } catch {} return { ok: false, msg: "PDF 가 다른 프로그램(Acrobat 등)에서 열려 있어 바꿀 수 없습니다. 닫고 다시 누르세요." }; }
  const pages = (fs.readFileSync(PDF, "latin1").match(/\/Count\s+(\d+)/) || [])[1] || "?";
  return { ok: true, msg: `PDF 완료 — ${pages}쪽, ${Math.round(fs.statSync(PDF).size / 1024)}KB`, pages: Number(pages) };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === "/") { res.writeHead(302, { Location: "/report" }); return res.end(); }
    if (p === "/report") {
      const html = fs.readFileSync(HTML, "utf8").replace(/<\/body>/i, '<script src="/edit-client.js"></script>\n</body>');
      return send(res, 200, html, MIME[".html"]);
    }
    if (p === "/edit-client.js") return serveFile(res, path.join(HERE, "edit-client.js"));
    if (p === "/pdf") { res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=report.pdf", "Cache-Control": "no-store" }); return res.end(fs.readFileSync(PDF)); }
    if (p.startsWith("/shots/")) return serveFile(res, path.join(HERE, p.slice(1)));
    if (p.startsWith("/assets/")) return serveFile(res, path.join(ROOT, p.slice(1)));
    if (req.method === "POST" && p === "/api/save") {
      const { html } = JSON.parse(await readBody(req) || "{}");
      if (typeof html !== "string" || html.trim().length < 50) return send(res, 400, JSON.stringify({ ok: false, msg: "내용이 비어 있어 저장하지 않았습니다." }), "application/json");
      if (/<script[\s>]/i.test(html)) return send(res, 400, JSON.stringify({ ok: false, msg: "스크립트가 섞여 있어 저장하지 않았습니다." }), "application/json");
      const src = fs.readFileSync(HTML, "utf8");
      if (!DOC_RE.test(src)) return send(res, 500, JSON.stringify({ ok: false, msg: '원본에서 <div class="doc"> 블록을 찾지 못했습니다.' }), "application/json");
      fs.mkdirSync(BACKUP, { recursive: true });
      fs.copyFileSync(HTML, path.join(BACKUP, "샘플보고서-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".html"));
      const out = src.replace(DOC_RE, (_, a, __, c) => a + "\n" + html.trim() + "\n" + c);
      fs.writeFileSync(HTML, out, "utf8");
      return send(res, 200, JSON.stringify({ ok: true, msg: "저장됨 — " + new Date().toLocaleTimeString("ko-KR") }), "application/json");
    }
    if (req.method === "POST" && p === "/api/pdf") return send(res, 200, JSON.stringify(makePdf()), "application/json");
    return send(res, 404, "not found");
  } catch (e) { return send(res, 500, JSON.stringify({ ok: false, msg: String(e.message || e) }), "application/json"); }
}).listen(PORT, () => {
  console.log(`[sample-report editor] http://localhost:${PORT}/report`);
  console.log(`원본 ${HTML}\nPDF  ${PDF}`);
});
