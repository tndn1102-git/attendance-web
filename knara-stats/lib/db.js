/* DB 어댑터 — 저장소는 Cloudflare D1 하나뿐이다(운영).
   - 운영(Workers): worker.js 가 요청마다 useD1(env.DB) 를 부른다.
   - 로컬 시험(node server.js·seed·verify·screenshots): D1 과 같은 SQLite 방언을 node:sqlite(Node 22.5+ 내장)로 흉내 낸다.
     DATABASE_URL = sqlite:./data/knara.db  또는  sqlite::memory:  (로컬 전용 — 운영엔 쓰이지 않는다)
   날짜 버킷(day_kst/hour_kst)은 적재 시 서버가 KST로 계산해 컬럼에 저장한다.
   자리표시자는 $1,$2… 로 쓰고 실행 직전 ?1,?2… 로 바꾼다. */

let impl = null;
let readyPromise = null;

export function dbKind() {
  if (impl) return impl.kind;
  if (/^sqlite:/i.test(process.env.DATABASE_URL || "")) return "sqlite";
  return null;
}

async function init() {
  const kind = dbKind();
  if (!kind) {
    throw new Error(
      "로컬 시험용 DATABASE_URL 이 없습니다. sqlite:./data/knara.db 또는 sqlite::memory: (운영은 D1 바인딩)"
    );
  }
  impl = await initSqlite(process.env.DATABASE_URL.slice(7));
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

/** SELECT 여러 개를 한 번에. D1 은 batch() 왕복 1회, 로컬 SQLite 는 차례로. 결과는 list 순서대로 rows 배열. */
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
   테이블 3개. 접두사 knara_
   - knara_sessions : 세션(폰 1대 1회 방문) 1행. 기기·브라우저·화면 메타. 개인정보·IP 없음.
   - knara_events   : 모든 흐름 이벤트(append-only). (sid, seq) UNIQUE 로 재전송 중복 제거.
   - knara_logs     : 오류·콘솔 로그. */
async function ensureSchema(db) {
  const S = [];
  const ID = "INTEGER PRIMARY KEY AUTOINCREMENT";
  const TS = "TEXT"; // ISO 문자열
  const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";
  const BOOL = "INTEGER";
  const F = "0";

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
  // D1 은 한 번에(왕복 1회), 로컬은 순서대로
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
/** 결과행의 시각값(ISO 문자열)을 ISO 문자열로 통일 */
export function toISO(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toISOString();
}
