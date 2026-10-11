/* 대시보드·집계 API 접근 제어 — 공유 키 1개(STATS_KEY).
   - 헤더 `x-stats-key` 또는 쿼리 `?key=` 로 받는다. 대시보드는 URL의 key 를 읽은 뒤 주소에서 지우고 헤더로만 보낸다.
   - 길이가 달라도 시간차가 나지 않도록 해시 후 timingSafeEqual.
   - STATS_KEY 미설정 → 전부 거부(실수로 공개되는 것 방지). */
import { createHash, timingSafeEqual } from "node:crypto";

export function checkKey(ctx) {
  const expected = process.env.STATS_KEY || "";
  if (!expected) return { ok: false, status: 503, error: "STATS_KEY 환경변수가 설정되지 않았습니다." };
  const given = String((ctx.headers && ctx.headers["x-stats-key"]) || (ctx.query && ctx.query.key) || "");
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!given || !timingSafeEqual(a, b)) return { ok: false, status: 401, error: "접속 키가 올바르지 않습니다." };
  return { ok: true };
}
