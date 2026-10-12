/* 샘플 문제 캡처 + 샘플 보고서 PDF — 크롬 headless, 의존성 없음.
   사용: node docs/sample-puzzle/shoot.mjs            (폰 390×844 프레임으로 상태별 캡처 → shots/, 보고서 → 샘플보고서.pdf) */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "shots");
const CHROME = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => fs.existsSync(p));
if (!CHROME) { console.error("크롬/엣지를 찾지 못했습니다."); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const fileUrl = (p) => "file:///" + p.replace(/\\/g, "/");
const PUZ = fileUrl(path.join(HERE, "puzzle.html"));

const SHOTS = [
  ["01-start-ko", `${PUZ}?hl=ko`],
  ["02-hint1-ko", `${PUZ}?hl=ko&state=hint1`],
  ["03-wrong-ko", `${PUZ}?hl=ko&state=wrong`],
  ["04-win-ko", `${PUZ}?hl=ko&state=win`],
  ["05-start-en", `${PUZ}?hl=en`],
  ["06-start-ja", `${PUZ}?hl=ja`],
  ["07-start-zh", `${PUZ}?hl=zh`],
  ["08-start-es", `${PUZ}?hl=es`],
];
const W = 390, H = 844;

function run(args) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), "knara-sample-"));
  const r = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--allow-file-access-from-files", `--user-data-dir=${prof}`, "--virtual-time-budget=12000", "--run-all-compositor-stages-before-draw", ...args], { encoding: "utf8", timeout: 90000 });
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
  return r;
}
/* PNG 왼쪽 위 w×h 자르기 (scripts/screenshots.js 와 같은 방식) */
function cropPng(buf, w, h) {
  let pos = 8, ihdr = null; const idat = [];
  while (pos < buf.length) { const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len); if (type === "IHDR") ihdr = data; else if (type === "IDAT") idat.push(data); pos += 12 + len; }
  const Wd = ihdr.readUInt32BE(0), Hd = ihdr.readUInt32BE(4), ctype = ihdr[9]; const bpp = ctype === 6 ? 4 : 3, stride = Wd * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat)); const out = Buffer.alloc(Hd * stride); let prev = Buffer.alloc(stride);
  for (let y = 0; y < Hd; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) { const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[i] = v & 255; }
    prev = cur;
  }
  const cw = Math.min(w, Wd), ch = Math.min(h, Hd), cs = cw * bpp, rawOut = Buffer.alloc(ch * (cs + 1));
  for (let y = 0; y < ch; y++) { rawOut[y * (cs + 1)] = 0; out.copy(rawOut, y * (cs + 1) + 1, y * stride, y * stride + cs); }
  const ihdr2 = Buffer.from(ihdr); ihdr2.writeUInt32BE(cw, 0); ihdr2.writeUInt32BE(ch, 4);
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, "ascii"), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  return Buffer.concat([buf.subarray(0, 8), chunk("IHDR", ihdr2), chunk("IDAT", zlib.deflateSync(rawOut)), chunk("IEND", Buffer.alloc(0))]);
}

let ok = 0;
for (const [name, url] of SHOTS) {
  const file = path.join(OUT, name + ".png");
  const frame = path.join(os.tmpdir(), `knara-sample-frame-${Date.now()}.html`);
  fs.writeFileSync(frame, `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>html,body{margin:0;background:#888}iframe{display:block;border:0;width:${W}px;height:${H}px}</style></head><body><iframe src="${url}"></iframe></body></html>`);
  const r = run([`--screenshot=${file}`, `--window-size=500,${H}`, fileUrl(frame)]);
  try { fs.unlinkSync(frame); } catch {}
  if (fs.existsSync(file)) { fs.writeFileSync(file, cropPng(fs.readFileSync(file), W, H)); ok++; console.log("✓", name); } else console.log("✗", name, r.stderr.slice(-200));
}
const report = path.join(HERE, "샘플보고서.html"), pdf = path.join(HERE, "샘플보고서.pdf");
if (fs.existsSync(report)) {
  const tmp = pdf + ".tmp.pdf";   // 뷰어(Acrobat)가 PDF 를 잠그고 있으면 덮어쓰기가 조용히 실패하므로 임시 파일 → 교체로 감지한다
  const r = run([`--print-to-pdf=${tmp}`, "--no-pdf-header-footer", "--window-size=1000,1400", fileUrl(report)]);
  if (fs.existsSync(tmp) && fs.statSync(tmp).size > 5000) {
    try { fs.renameSync(tmp, pdf); console.log(`✓ 샘플보고서.pdf (${Math.round(fs.statSync(pdf).size / 1024)}KB)`); }
    catch (e) { console.log("✗ PDF 교체 실패 — 뷰어에서 열려 있으면 닫고 다시: " + e.message); try { fs.unlinkSync(tmp); } catch {} }
  } else console.log("✗ PDF " + r.stderr.slice(-200));
}
console.log(`[sample] ${ok}/${SHOTS.length} → ${OUT}`);
