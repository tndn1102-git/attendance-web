/* 수집 처리 — track.js 가 보내는 배치 1건을 검증·정규화해 적재한다.
   payload = {
     v, sid, s0(세션 시작 ms), now(전송 시각 ms), tk?, staff?,
     meta?: { sw, sh, vw, vh, dpr, lang, cores, mem, ref, app_ver },    // 보통 enter 가 든 첫 배치에만
     events: [ { q(순번), t(발생 ms), e(이름), room, slot, game, kind, role, lang, value, dur_ms, hits, target, limit_s } ],
     logs:   [ { t, level, message, source, lineno, colno, stack, page, room, game } ]
   }
   - 시각: 클라이언트 시계가 틀릴 수 있으므로 skew = 서버 now − payload.now 를 모든 t 에 더해 보정한다
     (오프라인 큐로 늦게 와도 "실제 발생 시각"이 보존됨). 범위를 벗어나면 서버 시각으로 대체.
   - 세션의 day_kst/hour_kst 는 세션 시작(s0) 기준 → 한 세션은 하루에 귀속(자정 넘김 분리 없음).
   - (sid, seq) UNIQUE → 재전송 중복은 ON CONFLICT DO NOTHING 으로 무시.
   - IP·쿠키·개인정보는 읽지도 저장하지도 않는다. UA 문자열만 세션 1행에 300자 이내. */

import { query, dbKind, kstDay, kstHour } from "./db.js";
import { parseUA } from "./ua.js";

export const EVENTS = new Set([
  "enter", "sensor", "role", "lang", "map", "room_enter",
  "play_start", "play_clear", "play_fail", "play_swap",
  "room_done", "all_done", "result",
  "quality_down", "webgl_lost", "fallback_input", "staff", "demo", "consent",
  // 노리개(DM) 편: DM 수락·넘김(kind=컨셉, game=놀이, hits=관심 점수), 별점(hits=0~3), 방 끝 노리개 선물, 결산 유형(kind=컨셉쌍, room=추천 지역)
  "dm_ok", "dm_skip", "star", "gift", "type_result",
]);
const ROOM_IDS = new Set(["land", "speech", "life", "story", "island", "field", "mountain", "sea"]);
const ROLE_IDS = new Set(["idol", "chef", "creator"]);
const LANG_IDS = new Set(["ko", "en", "ja", "zh", "es"]);
const AGE_IDS = new Set(["10s", "20s", "30s", "40s", "50s", "60s+", "skip"]);
const GENDER_IDS = new Set(["f", "m", "other", "skip"]);

const MAX_EVENTS = 100;
const MAX_LOGS = 25;
const MAX_SKEW_MS = 45 * 24 * 3600 * 1000; // 45일 넘게 어긋난 시각은 신뢰하지 않음

function str(v, n) {
  if (v == null || v === "") return null;
  return String(v).slice(0, n);
}
function int(v, lo, hi) {
  const n = typeof v === "number" ? Math.round(v) : parseInt(v, 10);
  if (!Number.isFinite(n) || n < lo || n > hi) return null;
  return n;
}
function num(v, lo, hi, digits = 2) {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!Number.isFinite(n) || n < lo || n > hi) return null;
  return Math.round(n * 10 ** digits) / 10 ** digits;
}
function idTok(v, n = 40) {
  // 영숫자·_·-·: 만 허용(놀이 id·값 토큰)
  if (v == null || v === "") return null;
  const s = String(v).slice(0, n);
  return /^[A-Za-z0-9_:.\-]+$/.test(s) ? s : null;
}

export class IngestError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export async function ingest(payload, headers) {
  if (!payload || typeof payload !== "object") throw new IngestError(400, "bad_payload");

  // 선택: TRACK_TOKEN 이 설정돼 있으면 payload.tk 가 같아야 적재(잡음·장난 전송 차단용. 클라이언트에 노출되는 값이라 보안장치는 아님)
  const need = process.env.TRACK_TOKEN;
  if (need && String(payload.tk || "") !== need) throw new IngestError(403, "bad_token");

  const sid = idTok(payload.sid, 64);
  if (!sid) throw new IngestError(400, "sid_required");

  const serverNow = Date.now();
  const clientNow = int(payload.now, 0, 4e12);
  let skew = clientNow != null ? serverNow - clientNow : 0;
  if (Math.abs(skew) > MAX_SKEW_MS) skew = 0;
  const fix = (t) => {
    const n = int(t, 0, 4e12);
    if (n == null) return new Date(serverNow);
    const d = n + skew;
    // 미래 5분 초과 / 과거 45일 초과는 서버 시각으로
    if (d > serverNow + 5 * 60000 || d < serverNow - MAX_SKEW_MS) return new Date(serverNow);
    return new Date(d);
  };

  const events = Array.isArray(payload.events) ? payload.events.slice(0, MAX_EVENTS) : [];
  const logs = Array.isArray(payload.logs) ? payload.logs.slice(0, MAX_LOGS) : [];
  if (!events.length && !logs.length && !payload.meta) throw new IngestError(400, "empty");

  const isStaff = payload.staff === true || payload.staff === 1 || payload.staff === "1";
  const startedAt = payload.s0 != null ? fix(payload.s0) : fix(events.length ? events[0].t : serverNow);
  const dayKst = kstDay(startedAt);
  const hourKst = kstHour(startedAt);

  const ua = String((headers && (headers["user-agent"] || headers["User-Agent"])) || "").slice(0, 300);
  const p = parseUA(ua);

  // ── 세션 1행 (meta 가 있으면 그 값으로, 없으면 최소 정보로) ──
  const m = payload.meta && typeof payload.meta === "object" ? payload.meta : {};
  await query(
    `INSERT INTO knara_sessions
       (sid, started_at, day_kst, hour_kst, is_staff, is_mobile,
        os, os_ver, browser, browser_ver, device, inapp,
        screen_w, screen_h, viewport_w, viewport_h, dpr, cores, mem_gb,
        lang, ref, app_ver, snippet_ver, ua)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     ON CONFLICT (sid) DO NOTHING`,
    [
      sid, startedAt, dayKst, hourKst, isStaff, p.is_mobile,
      p.os, p.os_ver, p.browser, p.browser_ver, p.device, p.inapp,
      int(m.sw, 0, 20000), int(m.sh, 0, 20000), int(m.vw, 0, 20000), int(m.vh, 0, 20000), num(m.dpr, 0.5, 8),
      int(m.cores, 1, 64), num(m.mem, 0.25, 64),
      str(m.lang, 16), str(m.ref, 40), str(m.app_ver, 40), str(payload.v, 16), ua || null,
    ]
  );

  // ── 이벤트 (다중행 INSERT, 중복 무시) ──
  let n = 0;
  const rows = [];
  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    const name = idTok(ev.e, 40);
    if (!name || !(EVENTS.has(name) || name.startsWith("x_"))) continue;
    const room = idTok(ev.room, 40);
    const role = idTok(ev.role, 20);
    const lang = idTok(ev.lang, 16);
    let kind = idTok(ev.kind, 40), value = str(ev.value, 60);
    if (name === "consent") { value = ["agreed", "declined"].includes(String(ev.value || "")) ? String(ev.value) : null; if (!value) continue; }
    if (name === "demo") { // 나이대·성별은 구간값만 받는다(그 외 값은 skip 처리)
      kind = AGE_IDS.has(String(ev.age || ev.kind || "")) ? String(ev.age || ev.kind) : "skip";
      value = GENDER_IDS.has(String(ev.gender || ev.value || "")) ? String(ev.gender || ev.value) : "skip";
    }
    rows.push([
      sid, int(ev.q, 0, 1e9), name, fix(ev.t), dayKst, hourKst, isStaff,
      room, int(ev.slot, 1, 9), idTok(ev.game, 40), kind,
      role && ROLE_IDS.has(role) ? role : role, // 미지정 role 도 원문 보존(대시보드가 '기타'로)
      lang, value,
      int(ev.dur_ms, 0, 6 * 3600 * 1000), int(ev.hits, 0, 9999), int(ev.target, 0, 9999), int(ev.limit_s, 0, 3600),
    ]);
  }
  if (rows.length) {
    const cols = 18;
    const ph = rows.map((_, i) => "(" + Array.from({ length: cols }, (__, j) => "$" + (i * cols + j + 1)).join(",") + ")").join(",");
    await query(
      `INSERT INTO knara_events
         (sid, seq, event, event_at, day_kst, hour_kst, is_staff,
          room, slot, game, kind, role, lang, value, dur_ms, hits, target, limit_s)
       VALUES ${ph} ON CONFLICT (sid, seq) DO NOTHING`,
      rows.flat()
    );
    n += rows.length;
  }

  // ── 오류 로그 ──
  for (const lg of logs) {
    if (!lg || typeof lg !== "object") continue;
    const message = str(lg.message, 1000);
    const stack = str(lg.stack, 4000);
    if (!message && !stack) continue;
    if (message && /^script error\.?$/i.test(message.trim())) continue; // 크로스오리진 잡음
    await query(
      `INSERT INTO knara_logs
         (sid, seq, level, message, source, lineno, colno, stack, page, room, game,
          event_at, day_kst, is_staff, is_mobile, os, os_ver, browser, browser_ver, device, inapp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       ON CONFLICT (sid, seq) DO NOTHING`,
      [
        sid, int(lg.q, 0, 1e9), str(lg.level, 40) || "error", message, str(lg.source, 300), int(lg.lineno, 0, 1e7), int(lg.colno, 0, 1e7),
        stack, str(lg.page, 200), idTok(lg.room, 40), idTok(lg.game, 40),
        fix(lg.t), dayKst, isStaff, p.is_mobile, p.os, p.os_ver, p.browser, p.browser_ver, p.device, p.inapp,
      ]
    );
    n++;
  }
  return { ok: true, n, db: dbKind() };
}
