/* 스크린샷 — 크롬 headless 로 모든 화면을 docs/screenshots/ 에 남긴다 (공공기관 PC 1366×768 + 전체 길이 + 폰 390).
   폰 390: 크롬 headless 창 최소 폭(≈500)을 피하려고 목업과 같은 iframe 프레임(_frame-390 기법)으로 390 고정 후 PNG 를 390 으로 자른다(의존성 없음, node:zlib).
   사용: STATS_KEY=... node scripts/screenshots.js [--base http://127.0.0.1:8787] [--from YYYY-MM-DD --to YYYY-MM-DD] [--chrome "C:\...\chrome.exe"] [--only entry] */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "screenshots");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://127.0.0.1:8787");
const KEY = process.env.STATS_KEY || arg("key", "");
const CHROME = arg("chrome", [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
].find((p) => fs.existsSync(p)));
if (!CHROME) { console.error("크롬/엣지를 찾지 못했습니다. --chrome 경로를 지정하세요."); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const from = arg("from", ""), to = arg("to", "");
const range = from && to ? `&preset=custom&from=${from}&to=${to}` : "&preset=7";
// [이름, URL, 폭, 높이, 옵션] — 옵션 frame: iframe 프레임으로 390 고정 후 자르기
const SHOTS = [
  ["00-gate", `${BASE}/`, 1366, 768],
  ["01-overview-1366x768", `${BASE}/?key=${KEY}#view=overview${range}`, 1366, 768],
  ["02-overview-full", `${BASE}/?key=${KEY}#view=overview${range}`, 1366, 1100],
  ["03-games-full", `${BASE}/?key=${KEY}#view=games${range}`, 1366, 2300],
  ["04-games-filter-room", `${BASE}/?key=${KEY}#view=games${range}&room=island`, 1366, 700],
  ["05-export-print", `${BASE}/?key=${KEY}#view=export${range}`, 1366, 3900],
  ["06-detail-full", `${BASE}/?key=${KEY}#view=detail${range}`, 1366, 3200],
  ["07-overview-today", `${BASE}/?key=${KEY}#view=overview&preset=today`, 1366, 768],
  ["09-overview-narrow-500", `${BASE}/?key=${KEY}#view=overview${range}`, 500, 1300],
  // 입장 페이지는 열기만 해도 enter 세션이 생기므로 &staff 로 열어 통계(스태프 제외)를 오염시키지 않는다
  ["10-entry-ko-390", `${BASE}/entry/?hl=ko&staff`, 390, 1270, "frame"],
  ["11-entry-en-390", `${BASE}/entry/?hl=en&staff`, 390, 1270, "frame"],
  ["13-entry-ja-390", `${BASE}/entry/?hl=ja&staff`, 390, 1270, "frame"],
  ["14-entry-zh-390", `${BASE}/entry/?hl=zh&staff`, 390, 1270, "frame"],
  ["15-entry-es-390", `${BASE}/entry/?hl=es&staff`, 390, 1270, "frame"],
  // ?hl= 없이 열면 접속 직후 언어 선택 팝업(5개 언어 네모칸)이 뜬다
  ["16-entry-langpop-390", `${BASE}/entry/?staff`, 390, 844, "frame"],
].filter(([name]) => !arg("only", "") || name.includes(arg("only", "")));   // --only entry 처럼 일부만 찍기

function run(args) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), "knara-shot-"));
  const r = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--disable-extensions", `--user-data-dir=${prof}`, "--virtual-time-budget=12000", "--run-all-compositor-stages-before-draw", ...args], { encoding: "utf8", timeout: 90000 });
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
  return r;
}

/* PNG 왼쪽 위 w×h 자르기 (8bit RGB/RGBA, 비인터레이스 — 크롬 스크린샷 형식) */
function cropPng(buf, w, h) {
  let pos = 8, ihdr = null; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") ihdr = data; else if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  const W = ihdr.readUInt32BE(0), H = ihdr.readUInt32BE(4), depth = ihdr[8], ctype = ihdr[9];
  if (depth !== 8 || (ctype !== 6 && ctype !== 2) || ihdr[12] !== 0) throw new Error("지원하지 않는 PNG 형식");
  const bpp = ctype === 6 ? 4 : 3, stride = W * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(H * stride); let prev = Buffer.alloc(stride);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
    prev = cur;
  }
  const cw = Math.min(w, W), ch = Math.min(h, H), cs = cw * bpp, rawOut = Buffer.alloc(ch * (cs + 1));
  for (let y = 0; y < ch; y++) { rawOut[y * (cs + 1)] = 0; out.copy(rawOut, y * (cs + 1) + 1, y * stride, y * stride + cs); }
  const ihdr2 = Buffer.from(ihdr); ihdr2.writeUInt32BE(cw, 0); ihdr2.writeUInt32BE(ch, 4);
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, "ascii"), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  return Buffer.concat([buf.subarray(0, 8), chunk("IHDR", ihdr2), chunk("IDAT", zlib.deflateSync(rawOut)), chunk("IEND", Buffer.alloc(0))]);
}

let ok = 0;
for (const [name, url, w, h, opt] of SHOTS) {
  const file = path.join(OUT, name + ".png");
  let r;
  if (opt === "frame") {
    const frame = path.join(os.tmpdir(), `knara-frame-${Date.now()}.html`);
    fs.writeFileSync(frame, `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>html,body{margin:0;background:#888}iframe{display:block;border:0;width:${w}px;height:${h}px}</style></head><body><iframe src="${url}"></iframe></body></html>`);
    r = run([`--screenshot=${file}`, `--window-size=${Math.max(500, w)},${h}`, "file:///" + frame.replace(/\\/g, "/")]);
    try { fs.unlinkSync(frame); } catch {}
    if (fs.existsSync(file)) { try { fs.writeFileSync(file, cropPng(fs.readFileSync(file), w, h)); } catch (e) { console.log("  자르기 실패:", e.message); } }
  } else {
    r = run([`--screenshot=${file}`, `--window-size=${w},${h}`, url]);
  }
  const exists = fs.existsSync(file) && fs.statSync(file).size > 2000;
  console.log(`${exists ? "✓" : "✗"} ${name}.png ${exists ? "(" + Math.round(fs.statSync(file).size / 1024) + "KB)" : (r && r.stderr || "").slice(-300)}`);
  if (exists) ok++;
}
// 인쇄 보고서 PDF (A4) — print.css 가 적용된 결과
const pdf = path.join(OUT, "12-report-A4.pdf");
const wantPdf = !arg("only", "") || "12-report-A4".includes(arg("only", ""));   // --only 로 일부만 찍을 때는 PDF 를 건드리지 않는다
let pdfOk = true;
if (wantPdf) {
  const tmp = pdf + ".tmp.pdf";
  const rp = run([`--print-to-pdf=${tmp}`, "--no-pdf-header-footer", "--window-size=1366,768", `${BASE}/?key=${KEY}#view=export${range}`]);
  pdfOk = fs.existsSync(tmp) && fs.statSync(tmp).size > 5000;   // 5KB 미만 = 접속 키 거부 화면 등 → 기존 PDF 를 지키고 실패로 처리
  if (pdfOk) fs.renameSync(tmp, pdf); else { try { fs.unlinkSync(tmp); } catch {} }
  const pages = pdfOk ? (fs.readFileSync(pdf, "latin1").match(/\/Count\s+(\d+)/) || [])[1] : "?";
  console.log(`${pdfOk ? "✓" : "✗"} 12-report-A4.pdf ${pdfOk ? "(" + Math.round(fs.statSync(pdf).size / 1024) + "KB, " + pages + "쪽)" : rp.stderr.slice(-300)}`);
}
console.log(`\n[screenshots] ${ok}/${SHOTS.length} PNG${wantPdf ? " + PDF " + (pdfOk ? "OK" : "실패") : ""} → ${OUT}`);
process.exit(ok === SHOTS.length && pdfOk ? 0 : 1);
