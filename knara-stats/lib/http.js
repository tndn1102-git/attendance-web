/* 라우터 — 진입점(Workers = worker.js / 로컬 시험 서버 = server.js)이 공통으로 감싸는 핸들러.
   ctx = { method, path, query:{}, headers:{소문자 키}, body: string|object|null }
   반환 = { status, headers, body(string) }                                                      */

import { ingest, IngestError } from "./ingest.js";
import { getStats, exportCSV } from "./stats.js";
import { checkKey } from "./auth.js";
import { dbKind } from "./db.js";

const JSON_H = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
const CORS_H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
const json = (status, obj, extra) => ({ status, headers: { ...JSON_H, ...(extra || {}) }, body: JSON.stringify(obj) });

function parseBody(body) {
  if (body == null || body === "") return null;
  if (typeof body === "object" && !Buffer.isBuffer(body)) return body;
  const s = Buffer.isBuffer(body) ? body.toString("utf8") : String(body);
  if (s.length > 256 * 1024) throw new IngestError(413, "too_large");
  try { return JSON.parse(s); } catch { throw new IngestError(400, "bad_json"); }
}

export async function handle(ctx) {
  const path = ctx.path.replace(/\/+$/, "") || "/";
  const method = (ctx.method || "GET").toUpperCase();

  // ── 수집 (앱 → 여기). CORS 전면 허용, 인증 없음(쓰기 전용·익명) ──
  if (path === "/api/track" || path === "/api/log") {
    if (method === "OPTIONS") return { status: 204, headers: CORS_H, body: "" };
    if (method !== "POST") return json(405, { error: "method_not_allowed" }, CORS_H);
    try {
      const r = await ingest(parseBody(ctx.body), ctx.headers || {});
      return json(200, r, CORS_H);
    } catch (e) {
      if (e instanceof IngestError) return json(e.status, { error: e.code }, CORS_H);
      console.error("[track]", e);
      return json(500, { error: "server_error" }, CORS_H);
    }
  }

  if (path === "/api/health") {
    return json(200, { ok: true, db: dbKind(), time: new Date().toISOString(), key_set: !!process.env.STATS_KEY });
  }

  // ── 읽기 (대시보드 → 여기). 키 필요 ──
  if (path === "/api/stats" || path === "/api/export") {
    if (method !== "GET") return json(405, { error: "method_not_allowed" });
    const a = checkKey(ctx);
    if (!a.ok) return json(a.status, { error: a.error });
    try {
      if (path === "/api/stats") return json(200, await getStats(ctx.query || {}));
      const { filename, csv } = await exportCSV(ctx.query || {});
      return {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "Cache-Control": "no-store",
        },
        body: csv,
      };
    } catch (e) {
      console.error("[stats]", e);
      return json(e.status || 500, { error: e.status ? e.message : "server_error", detail: process.env.NODE_ENV === "production" ? undefined : String(e.message) });
    }
  }

  return json(404, { error: "not_found" });
}

/* Node http (req,res) 어댑터 — 로컬 시험 서버용 */
export async function nodeHandler(req, res) {
  try {
    const url = new URL(req.url, "http://local");
    const headers = {};
    for (const [k, v] of Object.entries(req.headers || {})) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    let body = req.body;
    if (body === undefined && (req.method === "POST" || req.method === "PUT")) body = await readBody(req, 256 * 1024);
    const r = await handle({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), headers, body });
    res.statusCode = r.status;
    for (const [k, v] of Object.entries(r.headers || {})) res.setHeader(k, v);
    res.end(r.body);
  } catch (e) {
    console.error("[http]", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "server_error" }));
  }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("too_large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
