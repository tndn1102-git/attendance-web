/* 집계 — 대시보드 1회 로드에 필요한 모든 수치를 한 번에 돌려준다.
   원칙: 무거운 묶기(GROUP BY)는 SQL, 중앙값·판정 같은 마무리는 Node. SQL 은 SQLite(D1) 방언.
   기간 = 세션 시작일(day_kst, KST) 기준 from~to 포함. staff=0 이면 스태프 세션 제외(기본). */

import { query, batcher, dbKind, toISO } from "./db.js";
import { GAME_BY_TYPE, ROOM_BY_ID, ROOMS, ROLES, LANGS, KIND_NAMES, CONCEPTS, TYPES, catalogForClient } from "./catalog.js";
import { toCSV } from "./csv.js";

export const AGE_NAMES = { "10s": "10대", "20s": "20대", "30s": "30대", "40s": "40대", "50s": "50대", "60s+": "60대 이상", skip: "응답 안 함" };
export const GENDER_NAMES = { f: "여성", m: "남성", other: "기타", skip: "응답 안 함" };
export const MIN_SAMPLE = 20;      // 이 미만이면 판정 보류("표본 부족")
export const HARD_RATE = 0.45;     // 성공률 이 미만 → 어려움 의심
export const EASY_RATE = 0.92;     // 성공률 이 이상 + 중앙 소요 ≤ 제한의 50% → 쉬움 의심

/* ───── 기간 파라미터 ───── */
export function parseRange(q) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const today = kstToday();
  let to = re.test(q.to || "") ? q.to : today;
  let from = re.test(q.from || "") ? q.from : addDays(to, -6);
  if (from > to) [from, to] = [to, from];
  if (daysBetween(from, to) > 400) from = addDays(to, -399);
  return { from, to, days: daysBetween(from, to) + 1, includeStaff: q.staff === "1" || q.staff === "true" };
}
export function kstToday() {
  const k = new Date(Date.now() + 9 * 3600 * 1000);
  return k.toISOString().slice(0, 10);
}
export function addDays(day, n) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
}

function where(r, alias = "") {
  const a = alias ? alias + "." : "";
  return `${a}day_kst >= $1 AND ${a}day_kst <= $2` + (r.includeStaff ? "" : ` AND NOT ${a}is_staff`);
}

/* 세션별 사실(서브쿼리) — 퍼널·완주·분포의 공통 재료 */
function sessionFactsSQL(r) {
  return `
    SELECT sid,
      MAX(CASE WHEN event='enter' THEN 1 ELSE 0 END)      AS f_enter,
      MAX(CASE WHEN event='sensor' THEN 1 ELSE 0 END)     AS f_sensor,
      MAX(CASE WHEN event='role' THEN 1 ELSE 0 END)       AS f_role,
      MAX(CASE WHEN event='map' THEN 1 ELSE 0 END)        AS f_map,
      MAX(CASE WHEN event='room_enter' THEN 1 ELSE 0 END) AS f_room,
      MAX(CASE WHEN event='play_start' THEN 1 ELSE 0 END) AS f_play,
      MAX(CASE WHEN event='room_done' THEN 1 ELSE 0 END)  AS f_room_done,
      MAX(CASE WHEN event='all_done' THEN 1 ELSE 0 END)   AS f_all,
      MAX(CASE WHEN event='result' THEN 1 ELSE 0 END)     AS f_result,
      COUNT(DISTINCT CASE WHEN event='room_done' THEN room END) AS rooms_done,
      SUM(CASE WHEN event='play_start' THEN 1 ELSE 0 END) AS plays,
      SUM(CASE WHEN event='play_clear' THEN 1 ELSE 0 END) AS clears,
      SUM(CASE WHEN event='play_fail' THEN 1 ELSE 0 END)  AS fails,
      SUM(CASE WHEN event='play_swap' THEN 1 ELSE 0 END)  AS swaps,
      MAX(CASE WHEN event='all_done' THEN dur_ms END)     AS total_ms,
      MAX(CASE WHEN event='quality_down' THEN 1 ELSE 0 END) AS f_qd,
      MAX(CASE WHEN event='webgl_lost' THEN 1 ELSE 0 END)   AS f_wl,
      MAX(CASE WHEN event='sensor' AND value='denied' THEN 1 ELSE 0 END) AS f_denied,
      MAX(CASE WHEN event='fallback_input' THEN 1 ELSE 0 END) AS f_fallback,
      MIN(event_at) AS first_at, MAX(event_at) AS last_at,
      MAX(CASE WHEN event='role' THEN role END) AS role,
      MAX(CASE WHEN event='demo' THEN kind END) AS age,
      MAX(CASE WHEN event='demo' THEN value END) AS gender,
      MAX(CASE WHEN event='consent' THEN value END) AS consent
    FROM knara_events WHERE ${where(r)} GROUP BY sid`;
}

const n = (v) => (v == null ? 0 : Number(v));
const rate = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

/* 히스토그램(버킷·개수) → 분위수. bucketSize 단위(초). */
function quantiles(hist, bucketSec) {
  const total = hist.reduce((s, h) => s + h.n, 0);
  if (!total) return { n: 0, median: null, p25: null, p75: null, mean: null };
  const sorted = hist.slice().sort((a, b) => a.b - b.b);
  const pick = (q) => {
    let acc = 0;
    const target = q * total;
    for (const h of sorted) {
      acc += h.n;
      if (acc >= target) return Math.round((h.b * bucketSec + bucketSec / 2) * 10) / 10;
    }
    return null;
  };
  const mean = sorted.reduce((s, h) => s + (h.b * bucketSec + bucketSec / 2) * h.n, 0) / total;
  return { n: total, median: pick(0.5), p25: pick(0.25), p75: pick(0.75), mean: Math.round(mean * 10) / 10 };
}

/* ───── 메인 ───── */
export async function getStats(q) {
  const r = parseRange(q);
  const P = [r.from, r.to];
  const S = sessionFactsSQL(r);
  const B = batcher(); // 아래 쿼리 30개 가까이를 D1 왕복 1회로

  // ── 노리개(DM) 편: 컨셉별 관심(DM 수락·넘김)·실력(별점), 방 끝 노리개 선물, 결산 유형, 추천 지역
  const dmP = Promise.all([ // 아래 큰 묶음과 같은 batch 로 나가도록 먼저 띄워 둔다
    B.q(`SELECT kind,
                  SUM(CASE WHEN event='dm_ok' THEN 1 ELSE 0 END) AS ok,
                  SUM(CASE WHEN event='dm_skip' THEN 1 ELSE 0 END) AS skip,
                  SUM(CASE WHEN event='star' THEN 1 ELSE 0 END) AS rated,
                  SUM(CASE WHEN event='star' THEN hits ELSE 0 END) AS stars,
                  SUM(CASE WHEN event='star' AND hits=3 THEN 1 ELSE 0 END) AS s3,
                  SUM(CASE WHEN event='star' AND hits=0 THEN 1 ELSE 0 END) AS s0
           FROM knara_events WHERE ${where(r)} AND event IN ('dm_ok','dm_skip','star') AND kind IS NOT NULL GROUP BY kind`, P),
    B.q(`SELECT kind, COUNT(*) AS n FROM knara_events WHERE ${where(r)} AND event='gift' AND kind IS NOT NULL GROUP BY kind`, P),
    B.q(`SELECT kind, COUNT(DISTINCT sid) AS sessions FROM knara_events WHERE ${where(r)} AND event='type_result' AND kind IS NOT NULL GROUP BY kind`, P),
    B.q(`SELECT room, COUNT(DISTINCT sid) AS sessions FROM knara_events WHERE ${where(r)} AND event='type_result' AND room IS NOT NULL GROUP BY room`, P),
  ]);
  const mainP = Promise.all([
      B.q(`SELECT COUNT(*) AS visits, SUM(f_enter) AS entered, SUM(f_sensor) AS sensor, SUM(f_role) AS role_picked,
                    SUM(f_map) AS map, SUM(f_room) AS room_entered, SUM(f_play) AS played, SUM(f_room_done) AS room_done,
                    SUM(f_all) AS finished, SUM(f_result) AS result,
                    SUM(plays) AS plays, SUM(clears) AS clears, SUM(fails) AS fails, SUM(swaps) AS swaps,
                    SUM(f_qd) AS qd_sessions, SUM(f_wl) AS wl_sessions, SUM(f_denied) AS denied_sessions, SUM(f_fallback) AS fallback_sessions,
                    SUM(CASE WHEN consent = 'agreed' THEN 1 ELSE 0 END) AS agreed, SUM(CASE WHEN consent = 'declined' THEN 1 ELSE 0 END) AS declined
             FROM (${S}) s`, P),
      // 직전 동일 길이 기간(추세 비교)
      (() => {
        const pr = { ...r, to: addDays(r.from, -1), from: addDays(r.from, -r.days) };
        return B.q(`SELECT COUNT(*) AS visits, SUM(f_all) AS finished, SUM(plays) AS plays, SUM(clears) AS clears, SUM(fails) AS fails
                      FROM (${sessionFactsSQL(pr)}) s`, [pr.from, pr.to]);
      })(),
      // 완료 도 개수 분포 — 방에 한 번이라도 들어간 세션만(첫 화면·권한·노리개 단계 이탈은 퍼널에서 따로 보임)
      B.q(`SELECT rooms_done, COUNT(*) AS sessions FROM (${S}) s WHERE f_room = 1 GROUP BY rooms_done ORDER BY rooms_done`, P),
      B.q(`SELECT total_ms/10000 AS b, COUNT(*) AS n FROM (${S}) s WHERE f_all=1 AND total_ms IS NOT NULL GROUP BY total_ms/10000`, P),
      B.q(`SELECT day_kst AS day, COUNT(DISTINCT sid) AS visits,
                    COUNT(DISTINCT CASE WHEN event='all_done' THEN sid END) AS finished,
                    SUM(CASE WHEN event='play_start' THEN 1 ELSE 0 END) AS plays
             FROM knara_events WHERE ${where(r)} GROUP BY day_kst ORDER BY day_kst`, P),
      B.q(`SELECT hour_kst AS hour, COUNT(DISTINCT sid) AS visits FROM knara_events WHERE ${where(r)} GROUP BY hour_kst ORDER BY hour_kst`, P),
      B.q(`SELECT room,
                    COUNT(DISTINCT CASE WHEN event='room_enter' THEN sid END) AS enters,
                    COUNT(DISTINCT CASE WHEN event='room_done' THEN sid END) AS done,
                    SUM(CASE WHEN event='play_start' THEN 1 ELSE 0 END) AS plays,
                    SUM(CASE WHEN event='play_clear' THEN 1 ELSE 0 END) AS clears,
                    SUM(CASE WHEN event='play_fail' THEN 1 ELSE 0 END) AS fails,
                    SUM(CASE WHEN event='play_swap' THEN 1 ELSE 0 END) AS swaps
             FROM knara_events WHERE ${where(r)} AND room IS NOT NULL AND event IN ('room_enter','room_done','play_start','play_clear','play_fail','play_swap')
             GROUP BY room`, P),
      B.q(`SELECT room, dur_ms/5000 AS b, COUNT(*) AS n FROM knara_events
             WHERE ${where(r)} AND event='room_done' AND dur_ms IS NOT NULL GROUP BY room, dur_ms/5000`, P),
      B.q(`SELECT game,
                    SUM(CASE WHEN event='play_start' THEN 1 ELSE 0 END) AS starts,
                    SUM(CASE WHEN event='play_clear' THEN 1 ELSE 0 END) AS clears,
                    SUM(CASE WHEN event='play_fail' THEN 1 ELSE 0 END) AS fails,
                    SUM(CASE WHEN event='play_fail' AND value='timeout' THEN 1 ELSE 0 END) AS timeouts,
                    SUM(CASE WHEN event='play_swap' THEN 1 ELSE 0 END) AS swaps_out,
                    SUM(CASE WHEN event='play_fail' THEN hits ELSE 0 END) AS fail_hits,
                    SUM(CASE WHEN event='play_fail' THEN target ELSE 0 END) AS fail_target,
                    SUM(CASE WHEN event='fallback_input' THEN 1 ELSE 0 END) AS fallback_n,
                    SUM(CASE WHEN event='dm_ok' THEN 1 ELSE 0 END) AS dm_ok,
                    SUM(CASE WHEN event='dm_skip' THEN 1 ELSE 0 END) AS dm_skip,
                    SUM(CASE WHEN event='star' THEN 1 ELSE 0 END) AS rated,
                    SUM(CASE WHEN event='star' THEN hits ELSE 0 END) AS stars,
                    COUNT(DISTINCT CASE WHEN event='play_start' THEN sid END) AS players,
                    MAX(limit_s) AS limit_s, MAX(target) AS target, MAX(room) AS room, MAX(kind) AS kind
             FROM knara_events WHERE ${where(r)} AND game IS NOT NULL
               AND event IN ('play_start','play_clear','play_fail','play_swap','fallback_input','dm_ok','dm_skip','star')
             GROUP BY game`, P),
      B.q(`SELECT game, event, dur_ms/500 AS b, COUNT(*) AS n FROM knara_events
             WHERE ${where(r)} AND event IN ('play_clear','play_fail') AND dur_ms IS NOT NULL
             GROUP BY game, event, dur_ms/500`, P),
      B.q(`SELECT kind, value, COUNT(DISTINCT sid) AS sessions FROM knara_events
             WHERE ${where(r)} AND event='sensor' GROUP BY kind, value`, P),
      B.q(`SELECT kind, COUNT(DISTINCT sid) AS sessions, COUNT(*) AS n FROM knara_events
             WHERE ${where(r)} AND event='fallback_input' GROUP BY kind`, P),
      B.q(`SELECT role, COUNT(DISTINCT sid) AS sessions FROM knara_events WHERE ${where(r)} AND event='role' GROUP BY role`, P),
      B.q(`SELECT lang, COUNT(DISTINCT sid) AS sessions FROM knara_events WHERE ${where(r)} AND event='lang' GROUP BY lang`, P),
      B.q(`SELECT os, os_ver, browser, device, inapp, viewport_w, viewport_h, dpr, is_mobile, lang, COUNT(*) AS n
             FROM knara_sessions WHERE ${where(r)}
             GROUP BY os, os_ver, browser, device, inapp, viewport_w, viewport_h, dpr, is_mobile, lang`, P),
      B.q(`SELECT s.device AS device, s.os AS os, COUNT(DISTINCT e.sid) AS sessions
             FROM knara_events e JOIN knara_sessions s ON s.sid = e.sid
             WHERE ${where(r, "e")} AND e.event='quality_down' GROUP BY s.device, s.os ORDER BY sessions DESC`, P),
      B.q(`SELECT level, message, source, lineno, colno, page, room, game, browser, browser_ver, os, os_ver, device, inapp, event_at
             FROM knara_logs WHERE ${where(r)} ORDER BY event_at DESC LIMIT 100`, P),
      B.q(`SELECT substr(COALESCE(message, stack, '(빈 메시지)'),1,120) AS message,
                    COALESCE(browser,'(미상)') AS browser, COALESCE(os,'(미상)') AS os,
                    COUNT(*) AS n, COUNT(DISTINCT sid) AS sessions, MAX(event_at) AS last_at
             FROM knara_logs WHERE ${where(r)}
             GROUP BY substr(COALESCE(message, stack, '(빈 메시지)'),1,120), COALESCE(browser,'(미상)'), COALESCE(os,'(미상)')
             ORDER BY n DESC LIMIT 60`, P),
      B.q(`SELECT COUNT(*) AS n, COUNT(DISTINCT sid) AS sessions, COUNT(DISTINCT day_kst) AS days FROM knara_logs WHERE ${where(r)}`, P),
      B.q(`SELECT MAX(received_at) AS last_at FROM knara_events`, []),
      B.q(`SELECT age, COUNT(*) AS sessions FROM (${S}) s WHERE age IS NOT NULL GROUP BY age`, P),
      B.q(`SELECT gender, COUNT(*) AS sessions FROM (${S}) s WHERE gender IS NOT NULL GROUP BY gender`, P),
      // 오늘 방문·완주 — 선택 기간과 무관하게 오늘(KST)
      (() => { const t = kstToday(); const tr = { ...r, from: t, to: t };
        return B.q(`SELECT COUNT(*) AS visits, SUM(f_all) AS finished FROM (${sessionFactsSQL(tr)}) s`, [t, t]); })(),
      // 완주 기여 — 완주한 세션이 그 놀이를 성공한 수(놀이가 완주 경로에 얼마나 들어갔나)
      B.q(`SELECT e.game AS game, COUNT(DISTINCT e.sid) AS finishers
             FROM knara_events e JOIN (SELECT sid FROM (${S}) s WHERE f_all = 1) f ON f.sid = e.sid
             WHERE ${where(r, "e")} AND e.event = 'play_clear' AND e.game IS NOT NULL GROUP BY e.game`, P), // $1,$2 를 두 번 참조 — 파라미터는 2개만
    ]);
  B.run();
  const [summaryRows, prevRows, roomsDoneRows, totalHist, daily, hourly, roomRows, roomHist, gameRows, gameHist,
    sensorRows, fallbackRows, roleRows, langRows, devRows, qdRows, logRecent, logGrouped, logTotals, lastRows,
    ageRows, genderRows, todayRows, finisherRows] = await mainP;

  const [conceptRows, giftRows, typeRows, recRows] = await dmP;
  const concepts = Object.keys(CONCEPTS).map((k) => {
    const x = conceptRows.find((y) => y.kind === k) || {}, g = giftRows.find((y) => y.kind === k) || {};
    const ok = n(x.ok), skip = n(x.skip), rated = n(x.rated);
    return { concept: k, name: CONCEPTS[k].name, orn: CONCEPTS[k].orn, ok, skip, accept_rate: rate(ok, ok + skip),
      rated, avg_star: rated ? Math.round((n(x.stars) / rated) * 100) / 100 : null, star3_rate: rate(n(x.s3), rated), star0_rate: rate(n(x.s0), rated),
      gifts: n(g.n) };
  });
  const types = Object.keys(TYPES).map((k) => ({ type: k, name: TYPES[k].name, sessions: n((typeRows.find((y) => y.kind === k) || {}).sessions) }))
    .concat(typeRows.filter((y) => !TYPES[y.kind]).map((y) => ({ type: y.kind, name: y.kind + " (미등록)", sessions: n(y.sessions) })));
  const recommend = ROOMS.map((rm) => ({ room: rm.id, name: rm.region, sessions: n((recRows.find((y) => y.room === rm.id) || {}).sessions) }));

  const s = summaryRows[0] || {};
  const pv = prevRows[0] || {};
  const visits = n(s.visits);
  const finished = n(s.finished);
  const clears = n(s.clears), fails = n(s.fails);
  const total = quantiles(totalHist.map((h) => ({ b: n(h.b), n: n(h.n) })), 10);

  const funnel = [
    ["enter", "입장(첫 화면)", visits],
    ["sensor", "센서 권한 응답", n(s.sensor)],
    ["role", "채널 개설", n(s.role_picked)],
    ["map", "메인 지도", n(s.map)],
    ["room_enter", "방(도) 진입", n(s.room_entered)],
    ["play_start", "첫 놀이 시작", n(s.played)],
    ["room_done", "도 1개 이상 완료", n(s.room_done)],
    ["all_done", "8개 지역 완주", finished],
    ["result", "채널 결산 도달", n(s.result)],
  ].map(([key, label, sessions], i, arr) => ({
    key, label, sessions,
    pct_of_visits: rate(sessions, visits),
    pct_of_prev: i === 0 ? 100 : rate(sessions, arr[i - 1][2]),
    drop: i === 0 ? 0 : Math.max(0, arr[i - 1][2] - sessions),
  }));

  // 도별
  const roomHistBy = {};
  for (const h of roomHist) (roomHistBy[h.room] ||= []).push({ b: n(h.b), n: n(h.n) });
  const roomMap = Object.fromEntries(roomRows.map((x) => [x.room, x]));
  const rooms = ROOMS.map((rm) => {
    const x = roomMap[rm.id] || {};
    const qd = quantiles(roomHistBy[rm.id] || [], 5);
    return {
      room: rm.id, name: rm.name, region: rm.region,
      enters: n(x.enters), done: n(x.done), done_rate: rate(n(x.done), n(x.enters)),
      plays: n(x.plays), clears: n(x.clears), fails: n(x.fails), swaps: n(x.swaps),
      clear_rate: rate(n(x.clears), n(x.clears) + n(x.fails)),
      median_sec: qd.median, p75_sec: qd.p75,
    };
  });
  // 카탈로그에 없는 room id 가 들어왔으면 뒤에 붙인다
  for (const x of roomRows) if (!ROOM_BY_ID[x.room]) rooms.push({ room: x.room, name: x.room + " (미등록)", region: "", enters: n(x.enters), done: n(x.done), done_rate: rate(n(x.done), n(x.enters)), plays: n(x.plays), clears: n(x.clears), fails: n(x.fails), swaps: n(x.swaps), clear_rate: rate(n(x.clears), n(x.clears) + n(x.fails)), median_sec: null, p75_sec: null });

  // 놀이별
  const gh = {};
  for (const h of gameHist) ((gh[h.game] ||= {})[h.event] ||= []).push({ b: n(h.b), n: n(h.n) });
  const seen = new Set();
  const games = [];
  const buildGame = (x, cat) => {
    const type = x ? x.game : cat.type;
    const clearsG = n(x && x.clears), failsG = n(x && x.fails), starts = n(x && x.starts);
    const qc = quantiles((gh[type] && gh[type].play_clear) || [], 0.5);
    const qf = quantiles((gh[type] && gh[type].play_fail) || [], 0.5);
    const limit = (x && n(x.limit_s)) || (cat && cat.limit_s) || null;
    const target = (x && n(x.target)) || (cat && cat.target) || null;
    const decided = clearsG + failsG;
    const cr = decided ? clearsG / decided : null;
    let verdict = "표본 부족";
    if (decided >= MIN_SAMPLE) {
      if (cr < HARD_RATE) verdict = "어려움 의심";
      else if (cr >= EASY_RATE && qc.median != null && limit && qc.median <= limit * 0.5) verdict = "쉬움 의심";
      else verdict = "적정";
    }
    return {
      game: type, registered: !!cat,
      room: cat ? cat.room : (x && x.room) || null,
      room_name: cat ? ROOM_BY_ID[cat.room].region : ((x && x.room) || "—"),
      no: cat ? cat.no : null,
      kind: cat ? cat.kind : (x && x.kind) || null,
      kind_name: KIND_NAMES[cat ? cat.kind : (x && x.kind)] || "기타",
      name: cat ? cat.name : type + " (미등록)",
      controls: cat ? cat.controls : "",
      sensor: cat ? cat.sensor : null,
      limit_s: limit, target,
      starts, players: n(x && x.players), clears: clearsG, fails: failsG, decided,
      clear_rate: rate(clearsG, decided),
      timeouts: n(x && x.timeouts), swaps_out: n(x && x.swaps_out), fallback_n: n(x && x.fallback_n),
      median_clear_sec: qc.median, p25_clear_sec: qc.p25, p75_clear_sec: qc.p75, mean_clear_sec: qc.mean,
      median_fail_sec: qf.median,
      ratio_to_limit: qc.median != null && limit ? Math.round((qc.median / limit) * 100) : null,
      fail_progress: x && n(x.fail_target) > 0 ? Math.round((n(x.fail_hits) / n(x.fail_target)) * 100) : null,
      verdict,
      dm_ok: n(x && x.dm_ok), dm_skip: n(x && x.dm_skip),
      accept_rate: rate(n(x && x.dm_ok), n(x && x.dm_ok) + n(x && x.dm_skip)),
      rated: n(x && x.rated), avg_star: n(x && x.rated) ? Math.round((n(x.stars) / n(x.rated)) * 100) / 100 : null,
    };
  };
  const gameMap = Object.fromEntries(gameRows.map((x) => [x.game, x]));
  for (const cat of Object.values(GAME_BY_TYPE)) { seen.add(cat.type); games.push(buildGame(gameMap[cat.type], cat)); }
  for (const x of gameRows) if (!seen.has(x.game)) games.push(buildGame(x, null));
  const finMap = Object.fromEntries(finisherRows.map((x) => [x.game, n(x.finishers)]));
  for (const gm of games) gm.finishers = finMap[gm.game] || 0;

  // 기기 분포(세션 1대 = 1)
  const dev = { total: 0, mobile: 0, inapp_total: 0, ios_inapp: 0, os: {}, os_ver: {}, browser: {}, device: {}, inapp: {}, res: {}, browser_lang: {} };
  for (const d of devRows) {
    const c = n(d.n);
    dev.total += c;
    if (d.is_mobile) dev.mobile += c;
    const add = (k, key) => { const kk = key || "(미상)"; dev[k][kk] = (dev[k][kk] || 0) + c; };
    add("os", d.os); add("os_ver", d.os ? d.os + " " + (d.os_ver || "") : null); add("browser", d.browser); add("device", d.device);
    if (d.inapp) { add("inapp", d.inapp); dev.inapp_total += c; if (d.os === "iOS" || d.os === "iPadOS") dev.ios_inapp += c; }
    if (d.viewport_w && d.viewport_h) add("res", d.viewport_w + "×" + d.viewport_h + (d.dpr ? " @" + d.dpr + "x" : ""));
    add("browser_lang", d.lang ? String(d.lang).slice(0, 2) : null);
  }
  const topN = (o, k) => Object.entries(o).map(([key, v]) => ({ k: key, v })).sort((a, b) => b.v - a.v).slice(0, k);
  const devices = {
    total: dev.total, mobile: dev.mobile, inapp_total: dev.inapp_total, ios_inapp: dev.ios_inapp,
    os: topN(dev.os, 8), os_ver: topN(dev.os_ver, 12), browser: topN(dev.browser, 10), device: topN(dev.device, 15),
    inapp: topN(dev.inapp, 10), res: topN(dev.res, 12), browser_lang: topN(dev.browser_lang, 8),
  };
  const deviceTotals = dev.device;

  const sensors = sensorRows.map((x) => ({ kind: x.kind || "(미상)", value: x.value || "(미상)", sessions: n(x.sessions) }));
  const sensorSummary = {};
  for (const x of sensors) { const k = x.kind; (sensorSummary[k] ||= { kind: k, granted: 0, denied: 0, unsupported: 0, other: 0 }); const v = ["granted", "denied", "unsupported"].includes(x.value) ? x.value : "other"; sensorSummary[k][v] += x.sessions; }

  // 직전 같은 길이 기간(전기 대비 델타용): from−days ~ from−1
  const prev = { from: addDays(r.from, -r.days), to: addDays(r.from, -1), days: r.days, visits: n(pv.visits), finished: n(pv.finished), finish_rate: rate(n(pv.finished), n(pv.visits)), plays: n(pv.plays), clear_rate: rate(n(pv.clears), n(pv.clears) + n(pv.fails)) };

  return {
    ok: true,
    generated_at: new Date().toISOString(),
    db: dbKind(),
    last_event_at: toISO(lastRows[0] && lastRows[0].last_at),
    range: { from: r.from, to: r.to, days: r.days, include_staff: r.includeStaff },
    exhibit: { start: process.env.EXHIBIT_START || "2026-11-02", end: process.env.EXHIBIT_END || null },
    thresholds: { min_sample: MIN_SAMPLE, hard_rate: HARD_RATE * 100, easy_rate: EASY_RATE * 100 },
    summary: {
      visits, finished, finish_rate: rate(finished, visits), result: n(s.result),
      median_total_sec: total.median, p25_total_sec: total.p25, p75_total_sec: total.p75,
      plays: n(s.plays), clears, fails, clear_rate: rate(clears, clears + fails), swaps: n(s.swaps),
      plays_per_visit: visits ? Math.round((n(s.plays) / visits) * 10) / 10 : null,
      denied_sessions: n(s.denied_sessions), denied_rate: rate(n(s.denied_sessions), n(s.sensor)),
      fallback_sessions: n(s.fallback_sessions),
      qd_sessions: n(s.qd_sessions), qd_rate: rate(n(s.qd_sessions), visits),
      wl_sessions: n(s.wl_sessions),
      error_sessions: n(logTotals[0] && logTotals[0].sessions), error_count: n(logTotals[0] && logTotals[0].n),
      inapp_rate: rate(dev.inapp_total, dev.total), mobile_rate: rate(dev.mobile, dev.total),
      consent_agreed: n(s.agreed), consent_declined: n(s.declined), consent_rate: rate(n(s.agreed), n(s.agreed) + n(s.declined)),
    },
    prev,
    funnel,
    rooms_done_dist: Array.from({ length: 9 }, (_, i) => ({ rooms_done: i, sessions: n((roomsDoneRows.find((x) => n(x.rooms_done) === i) || {}).sessions) })),
    total_time_hist: totalHist.map((h) => ({ from_sec: n(h.b) * 10, n: n(h.n) })).sort((a, b) => a.from_sec - b.from_sec),
    daily: daily.map((d) => ({ day: d.day, visits: n(d.visits), finished: n(d.finished), plays: n(d.plays) })),
    hourly: Array.from({ length: 24 }, (_, h) => ({ hour: h, visits: n((hourly.find((x) => n(x.hour) === h) || {}).visits) })),
    rooms, games, concepts, types, recommend,
    ages: ["10s", "20s", "30s", "40s", "50s", "60s+", "skip"].map((k) => ({ age: k, name: AGE_NAMES[k], sessions: n((ageRows.find((x) => x.age === k) || {}).sessions) })),
    genders: ["f", "m", "other", "skip"].map((k) => ({ gender: k, name: GENDER_NAMES[k], sessions: n((genderRows.find((x) => x.gender === k) || {}).sessions) })),
    today: { day: kstToday(), visits: n(todayRows[0] && todayRows[0].visits), finished: n(todayRows[0] && todayRows[0].finished) },
    roles: Object.keys(ROLES).filter((k) => k !== "common").map((k) => ({ role: k, name: ROLES[k], sessions: n((roleRows.find((x) => x.role === k) || {}).sessions) }))
      .concat(roleRows.filter((x) => !ROLES[x.role]).map((x) => ({ role: x.role, name: x.role + " (미등록)", sessions: n(x.sessions) }))),
    langs: Object.keys(LANGS).map((k) => ({ lang: k, name: LANGS[k], sessions: n((langRows.find((x) => x.lang === k) || {}).sessions) }))
      .concat(langRows.filter((x) => !LANGS[x.lang]).map((x) => ({ lang: x.lang, name: x.lang + " (기타)", sessions: n(x.sessions) }))),
    sensors, sensor_summary: Object.values(sensorSummary),
    fallback: fallbackRows.map((x) => ({ kind: x.kind || "(미상)", sessions: n(x.sessions), n: n(x.n) })),
    devices,
    quality: {
      down_sessions: n(s.qd_sessions),
      down_by_device: qdRows.map((x) => ({ device: x.device || "(미상)", os: x.os || "(미상)", sessions: n(x.sessions), total: deviceTotals[x.device || "(미상)"] || 0 })),
      webgl_lost_sessions: n(s.wl_sessions),
    },
    logs: {
      total: n(logTotals[0] && logTotals[0].n), sessions: n(logTotals[0] && logTotals[0].sessions),
      recent: logRecent.map((x) => ({ ...x, event_at: toISO(x.event_at) })),
      grouped: logGrouped.map((x) => ({ ...x, n: n(x.n), sessions: n(x.sessions), last_at: toISO(x.last_at) })),
    },
    catalog: catalogForClient(),
  };
}

/* ───── CSV 내보내기 ───── */
export async function exportCSV(q) {
  const r = parseRange(q);
  const P = [r.from, r.to];
  const kind = String(q.kind || "games");
  const fname = (k) => `knara_${k}_${r.from}_${r.to}.csv`;

  if (kind === "games" || kind === "rooms" || kind === "daily" || kind === "funnel" || kind === "demo") {
    const st = await getStats(q);
    if (kind === "games") {
      const rows = st.games.map((g) => ({
        지역: g.room_name, 순번: g.no, 놀이: g.name, 놀이id: g.game, 컨셉: g.kind_name, 의뢰인: g.controls,
        DM수락: g.dm_ok, DM넘김: g.dm_skip, "수락률%": g.accept_rate, 별점판수: g.rated, 평균별점: g.avg_star,
        시도: g.starts, 플레이어수: g.players, 성공: g.clears, 실패: g.fails, "성공률%": g.clear_rate, 완주기여세션: g.finishers,
        시간초과실패: g.timeouts, 실패시진척도: g.fail_progress, 교체: g.swaps_out, 대체조작: g.fallback_n,
        성공소요중앙값초: g.median_clear_sec, 성공소요p25: g.p25_clear_sec, 성공소요p75: g.p75_clear_sec, "소요대비제한%": g.ratio_to_limit, 판정: g.verdict,
      }));
      return { filename: fname("games"), csv: toCSV(Object.keys(rows[0] || { 도: 1 }), rows) };
    }
    if (kind === "rooms") {
      const rows = st.rooms.map((x) => ({ 도: x.region, 방: x.name, id: x.room, 진입세션: x.enters, 완료세션: x.done, "완료율%": x.done_rate, 놀이시도: x.plays, 성공: x.clears, 실패: x.fails, "성공률%": x.clear_rate, 교체: x.swaps, 소요중앙값초: x.median_sec }));
      return { filename: fname("rooms"), csv: toCSV(Object.keys(rows[0]), rows) };
    }
    if (kind === "daily") {
      const rows = st.daily.map((x) => ({ 날짜: x.day, 방문세션: x.visits, 완주세션: x.finished, 놀이시도: x.plays }));
      return { filename: fname("daily"), csv: toCSV(["날짜", "방문세션", "완주세션", "놀이시도"], rows) };
    }
    if (kind === "demo") {
      const rows = [].concat(
        [{ 구분: "동의", 값: "동의", 세션: st.summary.consent_agreed }, { 구분: "동의", 값: "미동의", 세션: st.summary.consent_declined }],
        st.ages.map((x) => ({ 구분: "나이대", 값: x.name, 세션: x.sessions })),
        st.genders.map((x) => ({ 구분: "성별", 값: x.name, 세션: x.sessions })),
        st.langs.map((x) => ({ 구분: "언어", 값: x.name, 세션: x.sessions })),
        st.concepts.map((x) => ({ 구분: "컨셉 DM 수락(건)", 값: x.name, 세션: x.ok })),
        st.concepts.map((x) => ({ 구분: "컨셉 DM 넘김(건)", 값: x.name, 세션: x.skip })),
        st.concepts.map((x) => ({ 구분: "노리개 선물(건)", 값: x.orn + "(" + x.name + ")", 세션: x.gifts })),
        st.types.map((x) => ({ 구분: "결산 유형", 값: x.name, 세션: x.sessions })),
        st.recommend.map((x) => ({ 구분: "추천 지역", 값: x.name, 세션: x.sessions })),
        st.devices.os.map((x) => ({ 구분: "OS", 값: x.k, 세션: x.v })),
        st.devices.browser.map((x) => ({ 구분: "브라우저", 값: x.k, 세션: x.v })));
      return { filename: fname("demo"), csv: toCSV(["구분", "값", "세션"], rows) };
    }
    const rows = st.funnel.map((x) => ({ 단계: x.label, 세션: x.sessions, "방문대비%": x.pct_of_visits, "직전단계대비%": x.pct_of_prev, 이탈: x.drop }));
    return { filename: fname("funnel"), csv: toCSV(Object.keys(rows[0]), rows) };
  }

  if (kind === "sessions") {
    const rows = await query(
      `SELECT f.sid, s.started_at, s.day_kst, s.hour_kst, s.is_staff, f.role, f.rooms_done, f.plays, f.clears, f.fails, f.swaps, f.f_all AS finished, f.f_result AS result, f.total_ms,
              f.age, f.gender, f.consent, f.f_denied AS sensor_denied, f.f_fallback AS used_fallback, f.f_qd AS quality_down, f.f_wl AS webgl_lost,
              s.os, s.os_ver, s.browser, s.browser_ver, s.device, s.inapp, s.viewport_w, s.viewport_h, s.dpr, s.lang AS browser_lang, s.app_ver
       FROM (${sessionFactsSQL(r)}) f LEFT JOIN knara_sessions s ON s.sid = f.sid ORDER BY s.started_at`, P);
    const H = ["sid", "started_at", "day_kst", "hour_kst", "is_staff", "role", "rooms_done", "plays", "clears", "fails", "swaps", "finished", "result", "total_ms", "age", "gender", "consent", "sensor_denied", "used_fallback", "quality_down", "webgl_lost", "os", "os_ver", "browser", "browser_ver", "device", "inapp", "viewport_w", "viewport_h", "dpr", "browser_lang", "app_ver"];
    return { filename: fname("sessions"), csv: toCSV(H, rows.map((x) => ({ ...x, started_at: toISO(x.started_at) }))) };
  }
  if (kind === "events") {
    const rows = await query(
      `SELECT sid, seq, event, event_at, day_kst, is_staff, room, slot, game, kind, role, lang, value, dur_ms, hits, target, limit_s
       FROM knara_events WHERE ${where(r)} ORDER BY sid, seq, event_at LIMIT 200000`, P);
    const H = ["sid", "seq", "event", "event_at", "day_kst", "is_staff", "room", "slot", "game", "kind", "role", "lang", "value", "dur_ms", "hits", "target", "limit_s"];
    return { filename: fname("events"), csv: toCSV(H, rows.map((x) => ({ ...x, event_at: toISO(x.event_at) }))) };
  }
  if (kind === "logs") {
    const rows = await query(
      `SELECT sid, event_at, level, message, source, lineno, colno, page, room, game, os, os_ver, browser, browser_ver, device, inapp, stack
       FROM knara_logs WHERE ${where(r)} ORDER BY event_at DESC LIMIT 20000`, P);
    const H = ["sid", "event_at", "level", "message", "source", "lineno", "colno", "page", "room", "game", "os", "os_ver", "browser", "browser_ver", "device", "inapp", "stack"];
    return { filename: fname("logs"), csv: toCSV(H, rows.map((x) => ({ ...x, event_at: toISO(x.event_at) }))) };
  }
  throw Object.assign(new Error("unknown_kind"), { status: 400 });
}
