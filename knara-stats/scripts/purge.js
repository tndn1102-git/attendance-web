/* 보존기간 정리 — 이벤트·세션 400일, 오류 로그 180일 지난 것을 지운다.
   사용: DATABASE_URL=... node scripts/purge.js [--events 400] [--logs 180]
   운영 중엔 월 1회 손으로 돌리거나 발주처 서버 crontab/작업 스케줄러에 등록. */
import { purge } from "../lib/stats.js";
import { close } from "../lib/db.js";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? parseInt(process.argv[i + 1], 10) : d; };
(async () => {
  const r = await purge({ eventDays: arg("events", 400), logDays: arg("logs", 180) });
  console.log(`[purge] 이벤트·세션 ${r.events_before} 이전 삭제, 오류 로그 ${r.logs_before} 이전 삭제`);
  await close();
})().catch((e) => { console.error(e); process.exit(1); });
