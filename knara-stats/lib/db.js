/* DB 어댑터 — Postgres(정본, Neon Free 전제) / SQLite(로컬 검증·폴백)
   - DATABASE_URL = postgres://...  → `pg` 사용 (Vercel 함수·발주처 Node 서버 공통)
   - DATABASE_URL = sqlite:./data/knara.db  또는  sqlite::memory:  → node:sqlite (Node 22.5+ 내장)
   - 미설정 → 명시적 오류 (Vercel에서 실수로 휘발성 SQLite를 쓰는 사고 방지)

   집계 SQL은 두 방언에서 같은 결과가 나오도록 "이식 가능한 부분집합"만 쓴다:
   CASE/SUM/COUNT(DISTINCT ...)/GROUP BY/서브쿼리/||/substr/COALESCE.  (FILTER·percentile_cont·DISTINCT ON·AT TIME ZONE 미사용)
   날짜 버킷(day_kst/hour_kst)은 적재 시 서버가 KST로 계산해 컬럼에 저장한다 → 방언 무관.
   자리표시자는 $1,$2… 로 쓰고 SQLite에선 ? 로 변환한다. */

let impl = null;
let readyPromise = null;

export function dbKind() {
  if (impl) return impl.kind;
  const url = process.env.DATABASE_URL || "";
  if (/^postgres(ql)?:\/\//i.test(url)) return "pg";
  if (/^sqlite:/i.test(url)) return "sqlite";
  return null;
}

async function init() {
  const kind = dbKind();
  if (!kind) {
    throw new Error(
      "DATABASE_URL 이 없습니다. Postgres: postgres://... / 로컬 검증: sqlite:./data/knara.db 또는 sqlite::memory:"
    );
  }
  impl = kind === "pg" ? await initPg(process.env.DATABASE_URL) : await initSqlite(process.env.DATABASE_URL.slice(7));
  await ensureSchema(impl);
  return impl;
}

export function ready() {
  if (!readyPromise) readyPromise = init();
  return readyPromise;
}

/** 모든 호출의 단일 진입점: rows 배열을 돌려준다. params 는 $1.. 순서 배열. */
export async function query(sql, params = []) {
  const db = await ready();
  return db.query(sql, params);
}

/** SELECT 여러 개를 한 번에. D1 은 batch() 왕복 1회, 나머지는 병렬. 결과는 list 순서대로 rows 배열. */
export async function queryMany(list) {
  const db = await ready();
  if (db.many) return db.many(list);
  return Promise.all(list.map(([sql, params]) => db.query(sql, params || [])));
}

/** 집계 함수용: b.q(sql, params) 로 쌓고 b.run() 한 번에 보낸다. 요청마다 새로 만들어 요청끼리 섞이지 않는다. */
export function batcher() {
  const L = [];
  return {
    q(sql, params = []) { return new Promise((res, rej) => L.push({ sql, params, res, rej })); },
    async run() {
      try { const rows = await queryMany(L.map((x) => [x.sql, x.params])); L.forEach((x, i) => x.res(rows[i])); }
      catch (e) { L.forEach((x) => x.rej(e)); }
    },
  };
}

export async function exec(sql) {
  const db = await ready();
  return db.exec(sql);
}

export async function close() {
  if (impl && impl.close) await impl.close();
  impl = null;
  readyPromise = null;
}

/* ───────────── Postgres ───────────── */
async function initPg(url) {
  const mod = "pg"; // 변수로 두어 번들러(wrangler/esbuild)가 pg 를 Worker 번들에 넣지 않게 한다
  const { default: pg } = await import(mod);
  // Neon 등 외부 호스팅은 TLS 필수. 로컬 Postgres(localhost)는 TLS 없이.
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const pool = new pg.Pool({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 3, // 서버리스 함수당 소수 커넥션 (Neon Free 커넥션 상한 보호)
    idleTimeoutMillis: 10000,
  });
  return {
    kind: "pg",
    async query(sql, params) {
      const r = await pool.query(sql, params);
      return r.rows;
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

/* ───────────── SQLite (node:sqlite) ───────────── */
async function initSqlite(path) {
  const mod = "node:sqlite"; // 변수로 두어 Worker 번들에서 해석하지 않게 한다
  const { DatabaseSync } = await import(mod);
  if (path && path !== ":memory:") {
    const fs = await import("node:fs");
    const p = await import("node:path");
    fs.mkdirSync(p.dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path || ":memory:");
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
  const stmtCache = new Map();
  function prep(sql) {
    let s = stmtCache.get(sql);
    if (!s) {
      s = db.prepare(sql.replace(/\$(\d+)/g, "?$1"));
      stmtCache.set(sql, s);
    }
    return s;
  }
  function conv(v) {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v === undefined) return null;
    return v;
  }
  return {
    kind: "sqlite",
    async query(sql, params) {
      const s = prep(sql);
      const args = params.map(conv);
      if (/^\s*(select|with)/i.test(sql)) return s.all(...args);
      s.run(...args);
      return [];
    },
    async exec(sql) {
      db.exec(sql);
    },
    async close() {
      db.close();
    },
  };
}

/* ───────────── Cloudflare D1 (SQLite 방언, Workers 전용) ─────────────
   worker.js 가 요청마다 useD1(env.DB) 를 부른다. 스키마는 isolate 당 1회만 보장한다. */
export function useD1(binding) {
  if (impl && impl.kind === "d1" && impl.binding === binding) return readyPromise;
  function conv(v) {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v === undefined) return null;
    return v;
  }
  const toQ = (sql) => sql.replace(/\$(\d+)/g, "?$1");
  impl = {
    kind: "d1",
    binding,
    async query(sql, params) {
      const st = binding.prepare(toQ(sql)).bind(...(params || []).map(conv));
      if (/^\s*(select|with)/i.test(sql)) return (await st.all()).results || [];
      await st.run();
      return [];
    },
    async exec(sql) {
      await binding.prepare(sql).run();
    },
    // 읽기 여러 개를 batch() 한 번(왕복 1회)으로
    async many(list) {
      const rs = await binding.batch(list.map(([sql, params]) => binding.prepare(toQ(sql)).bind(...(params || []).map(conv))));
      return rs.map((r) => (r && r.results) || []);
    },
    async execAll(sqls) {
      await binding.batch(sqls.map((x) => binding.prepare(x)));
    },
    async close() {},
  };
  const me = impl;
  readyPromise = ensureSchema(me).then(() => me);
  return readyPromise;
}

/* ───────────── 스키마 ─────────────
   테이블 3개. 접두사 knara_ (다른 프로젝트와 같은 DB를 써도 충돌 없음)
   - knara_sessions : 세션(폰 1대 1회 방문) 1행. 기기·브라우저·화면 메타. 개인정보·IP 없음.
   - knara_events   : 모든 흐름 이벤트(append-only). (sid, seq) UNIQUE 로 재전송 중복 제거.
   - knara_logs     : 오류·콘솔 로그. */
async function ensureSchema(db) {
  const S = [];
  const pg = db.kind === "pg";
  const ID = pg ? "BIGSERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";
  const TS = pg ? "TIMESTAMPTZ" : "TEXT";
  const NOW = pg ? "now()" : "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";
  const BOOL = pg ? "BOOLEAN" : "INTEGER";
  const F = pg ? "false" : "0";

  S.push(`
    CREATE TABLE IF NOT EXISTS knara_sessions (
      sid         TEXT PRIMARY KEY,
      started_at  ${TS} NOT NULL,
      received_at ${TS} NOT NULL DEFAULT ${NOW},
      day_kst     TEXT NOT NULL,
      hour_kst    INTEGER NOT NULL,
      is_staff    ${BOOL} NOT NULL DEFAULT ${F},
      is_mobile   ${BOOL},
      os TEXT, os_ver TEXT, browser TEXT, browser_ver TEXT, device TEXT, inapp TEXT,
      screen_w INTEGER, screen_h INTEGER, viewport_w INTEGER, viewport_h INTEGER, dpr REAL,
      cores INTEGER, mem_gb REAL,
      lang TEXT, ref TEXT, app_ver TEXT, snippet_ver TEXT,
      ua TEXT
    )`);
  S.push(`CREATE INDEX IF NOT EXISTS knara_sessions_day_idx ON knara_sessions (day_kst)`);

  S.push(`
    CREATE TABLE IF NOT EXISTS knara_events (
      id          ${ID},
      sid         TEXT NOT NULL,
      seq         INTEGER,
      event       TEXT NOT NULL,
      event_at    ${TS} NOT NULL,
      received_at ${TS} NOT NULL DEFAULT ${NOW},
      day_kst     TEXT NOT NULL,
      hour_kst    INTEGER NOT NULL,
      is_staff    ${BOOL} NOT NULL DEFAULT ${F},
      room TEXT, slot INTEGER, game TEXT, kind TEXT, role TEXT, lang TEXT, value TEXT,
      dur_ms INTEGER, hits INTEGER, target INTEGER, limit_s INTEGER,
      UNIQUE (sid, seq)
    )`);
  S.push(`CREATE INDEX IF NOT EXISTS knara_events_day_idx ON knara_events (day_kst, event)`);
  S.push(`CREATE INDEX IF NOT EXISTS knara_events_sid_idx ON knara_events (sid)`);
  S.push(`CREATE INDEX IF NOT EXISTS knara_events_game_idx ON knara_events (game, event)`);

  S.push(`
    CREATE TABLE IF NOT EXISTS knara_logs (
      id          ${ID},
      sid         TEXT,
      seq         INTEGER,
      level       TEXT,
      message     TEXT,
      source      TEXT,
      lineno      INTEGER,
      colno       INTEGER,
      stack       TEXT,
      page        TEXT,
      room TEXT, game TEXT,
      event_at    ${TS} NOT NULL,
      received_at ${TS} NOT NULL DEFAULT ${NOW},
      day_kst     TEXT NOT NULL,
      is_staff    ${BOOL} NOT NULL DEFAULT ${F},
      is_mobile   ${BOOL},
      os TEXT, os_ver TEXT, browser TEXT, browser_ver TEXT, device TEXT, inapp TEXT,
      UNIQUE (sid, seq)
    )`);
  S.push(`CREATE INDEX IF NOT EXISTS knara_logs_day_idx ON knara_logs (day_kst)`);
  // D1 은 한 번에(왕복 1회), 나머지는 순서대로
  if (db.execAll) await db.execAll(S);
  else for (const x of S) await db.exec(x);
}

/* ───────────── 공용 시간 유틸 (KST) ───────────── */
export function kstDay(date) {
  const k = new Date(date.getTime() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())}`;
}
export function kstHour(date) {
  return new Date(date.getTime() + 9 * 3600 * 1000).getUTCHours();
}
/** 결과행의 시각값(pg Date / sqlite ISO 문자열)을 ISO 문자열로 통일 */
export function toISO(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toISOString();
}
