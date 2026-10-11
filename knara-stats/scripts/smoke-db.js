/* DB 연결·스키마 점검 — 배포 전 Neon(또는 발주처 Postgres) 연결 문자열이 맞는지 확인한다.
   사용: DATABASE_URL=postgres://... node scripts/smoke-db.js
   하는 일: 접속 → 테이블 생성(IF NOT EXISTS) → 시험 세션 1건 INSERT → 집계 1회 → 시험 데이터 삭제. */
import { ready, query, dbKind, close } from "../lib/db.js";
import { ingest } from "../lib/ingest.js";
import { getStats } from "../lib/stats.js";

(async () => {
  const t0 = Date.now();
  const db = await ready();
  console.log(`[check-db] 연결 OK (${db.kind}) ${Date.now() - t0}ms`);
  const sid = "smoke" + Date.now().toString(36);
  await ingest({ v: "smoke", sid, s0: Date.now() - 5000, now: Date.now(), staff: true, meta: { vw: 390, vh: 664, dpr: 3 }, events: [{ q: 1, t: Date.now() - 5000, e: "enter" }, { q: 2, t: Date.now() - 1000, e: "role", role: "chef" }] }, { "user-agent": "smoke-test" });
  const n = await query(`SELECT COUNT(*) AS n FROM knara_events WHERE sid = $1`, [sid]);
  console.log(`[check-db] 시험 이벤트 적재 ${n[0].n}건 (기대 2)`);
  const st = await getStats({ staff: "1" });
  console.log(`[check-db] 집계 OK — 최근 7일 방문 ${st.summary.visits}세션(스태프 포함), 마지막 수집 ${st.last_event_at}`);
  await query(`DELETE FROM knara_events WHERE sid = $1`, [sid]);
  await query(`DELETE FROM knara_sessions WHERE sid = $1`, [sid]);
  const tot = await query(`SELECT (SELECT COUNT(*) FROM knara_sessions) AS s, (SELECT COUNT(*) FROM knara_events) AS e, (SELECT COUNT(*) FROM knara_logs) AS l`, []);
  console.log(`[check-db] 현재 보관량: 세션 ${tot[0].s} · 이벤트 ${tot[0].e} · 로그 ${tot[0].l}  (db=${dbKind()})`);
  await close();
})().catch((e) => { console.error("[check-db] 실패:", e.message); process.exit(1); });
