/* Cloudflare Workers 진입점 — 정적 파일(대시보드·입장 페이지·track.js)은 Workers Static Assets 가,
   /api/* 는 공통 라우터(lib/http.js)가 처리한다. 저장소는 D1(SQLite). 로직은 전부 lib/ 에 있다.
   설정: wrangler.jsonc (assets → ./ + .assetsignore, D1 바인딩 DB, 비밀 STATS_KEY) */

import { handle } from "./lib/http.js";
import { useD1 } from "./lib/db.js";

const ENV_KEYS = ["STATS_KEY", "TRACK_TOKEN", "EXHIBIT_START", "EXHIBIT_END"];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);

    // lib/ 는 process.env 를 읽는다 → Worker 바인딩(vars·secrets)을 옮겨 준다
    for (const k of ENV_KEYS) if (env[k] != null && env[k] !== "") process.env[k] = String(env[k]);
    process.env.NODE_ENV = "production";
    useD1(env.DB);

    const headers = {};
    req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    const query = {};
    url.searchParams.forEach((v, k) => { query[k] = v; });
    const body = req.method === "POST" || req.method === "PUT" ? await req.text() : null;

    const r = await handle({ method: req.method, path: url.pathname, query, headers, body });
    return new Response(r.body, { status: r.status, headers: r.headers });
  },
};
