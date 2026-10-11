/* 검증 — 시드 정답(data/seed-truth.json)과 /api/stats 집계를 대조한다.
   사용: STATS_KEY=... node scripts/verify.js [--base http://localhost:8787]
   중복 전송 세션(dup_sid)은 정답에 1회만 반영돼 있어야 하므로, 서버의 중복 제거가 깨지면 방문 수가 어긋난다. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:8787");
const KEY = process.env.STATS_KEY || arg("key", "");
const truth = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "seed-truth.json"), "utf8"));

const results = [];
function check(name, expected, actual, tol = 0) {
  const ok = expected == null && actual == null ? true : (typeof expected === "string" ? expected === actual : Math.abs(Number(expected) - Number(actual)) <= tol);
  results.push({ name, expected, actual, ok });
}
function median(arr) { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

(async () => {
  const q = `from=${truth.range.from}&to=${truth.range.to}&staff=0`;
  const r = await fetch(`${BASE}/api/stats?${q}`, { headers: { "x-stats-key": KEY } });
  if (!r.ok) throw new Error("stats " + r.status + " " + (await r.text()));
  const d = await r.json();

  // 중복 시험 세션(dup_sid)은 정답에 1회 반영돼 있고 서버엔 2회 전송됨 → (sid,seq) 중복 제거가 되면 정확히 일치해야 한다
  const expVisits = truth.sessions;
  check("방문 세션(중복 전송 1세션 포함, 1회로 집계)", expVisits, d.summary.visits);
  check("퍼널: 입장", expVisits, d.funnel[0].sessions);
  check("퍼널: 센서 응답", truth.funnel.sensor, d.funnel[1].sessions);
  check("퍼널: 노리개 선택", truth.funnel.role, d.funnel[2].sessions);
  check("퍼널: 지도", truth.funnel.map, d.funnel[3].sessions);
  check("퍼널: 방 진입", truth.funnel.room_enter, d.funnel[4].sessions);
  check("퍼널: 첫 놀이", truth.funnel.play_start, d.funnel[5].sessions);
  check("퍼널: 도 1개 이상", truth.funnel.room_done, d.funnel[6].sessions);
  check("퍼널: 8색 완주", truth.funnel.all_done, d.funnel[7].sessions);
  check("퍼널: 결과 카드", truth.funnel.result, d.funnel[8].sessions);
  check("완주 소요 중앙값(초, 10초 버킷 ±10)", median(truth.total_secs), d.summary.median_total_sec, 10);

  // 놀이별 (dup 세션 영향 ±? → dup 세션은 모든 놀이 카운트에 최대 1판씩 더해질 수 있어 start/clear/fail 각 ±3 허용)
  let gameMis = 0;
  for (const [type, g] of Object.entries(truth.games)) {
    const a = d.games.find((x) => x.game === type);
    if (!a) { results.push({ name: "놀이 " + type + " 존재", expected: 1, actual: 0, ok: false }); continue; }
    const ok = Math.abs(a.starts - g.starts) === 0 && Math.abs(a.clears - g.clears) === 0 && Math.abs(a.fails - g.fails) === 0 && Math.abs(a.swaps_out - g.swaps_out) === 0 && Math.abs(a.timeouts - g.timeouts) === 0;
    if (!ok) gameMis++;
    if (!ok) results.push({ name: `놀이 ${type} 시도/성공/실패/교체/시간초과`, expected: `${g.starts}/${g.clears}/${g.fails}/${g.swaps_out}/${g.timeouts}`, actual: `${a.starts}/${a.clears}/${a.fails}/${a.swaps_out}/${a.timeouts}`, ok });
    const m = median(g.clear_secs);
    if (m != null && a.median_clear_sec != null && Math.abs(m - a.median_clear_sec) > 0.6) results.push({ name: `놀이 ${type} 성공 소요 중앙값(0.5초 버킷)`, expected: m.toFixed(2), actual: a.median_clear_sec, ok: false });
  }
  results.push({ name: `놀이 63종 시도/성공/실패/교체/시간초과 정확 일치`, expected: "63/63", actual: `${63 - gameMis}/63`, ok: gameMis === 0 });
  check("놀이 시도 합계", truth.plays, d.summary.plays);
  check("놀이 성공 합계", truth.clears, d.summary.clears);
  check("놀이 실패 합계", truth.fails, d.summary.fails);
  check("교체 합계", truth.swaps, d.summary.swaps);

  // 도별
  for (const [room, t] of Object.entries(truth.rooms)) {
    const a = d.rooms.find((x) => x.room === room);
    check(`도 ${room} 진입 세션`, t.enters, a.enters);
    check(`도 ${room} 완료 세션`, t.done, a.done);
  }
  // 완료 도 개수 분포 (dup ±1)
  for (let i = 0; i <= 8; i++) check(`완료 도 ${i}개 세션`, truth.rooms_done_dist[i] || 0, d.rooms_done_dist[i].sessions);

  // 일별·시간대
  for (const [day, v] of Object.entries(truth.daily)) { const a = d.daily.find((x) => x.day === day); check(`일별 ${day} 방문`, v, a ? a.visits : 0); }
  check("일별 행 수", Object.keys(truth.daily).length, d.daily.length);
  for (const [h, v] of Object.entries(truth.hourly)) check(`시간대 ${h}시 방문`, v, d.hourly[h].visits);

  // 선택·센서·기기
  for (const [role, v] of Object.entries(truth.roles)) check(`노리개 ${role}`, v, d.roles.find((x) => x.role === role).sessions);
  for (const [age, v] of Object.entries(truth.ages)) check(`나이대 ${age}`, v, d.ages.find((x) => x.age === age).sessions);
  for (const [g, v] of Object.entries(truth.genders)) check(`성별 ${g}`, v, d.genders.find((x) => x.gender === g).sessions);
  for (const [br, v] of Object.entries(truth.devices.browser)) check(`브라우저 ${br} 세션`, v, (d.devices.browser.find((x) => x.k === br) || {}).v);
  check("동의 세션", truth.consent.agreed, d.summary.consent_agreed);
  check("미동의 세션", truth.consent.declined, d.summary.consent_declined);
  check("오늘 방문자(기간 무관)", truth.daily[truth.today] || 0, d.today.visits);
  check("놀이별 완주 기여 ≤ 완주 세션×24 (정합성)", 1, d.games.reduce((a, g) => a + g.finishers, 0) <= d.summary.finished * 24 ? 1 : 0);
  for (const [lang, v] of Object.entries(truth.langs)) check(`언어 ${lang}`, v, d.langs.find((x) => x.lang === lang).sessions);
  for (const [k, v] of Object.entries(truth.sensors)) { const [kind, val] = k.split(":"); const a = d.sensors.find((x) => x.kind === kind && x.value === val); check(`센서 ${k}`, v, a ? a.sessions : 0); }
  check("센서 거부 세션", truth.denied_sessions, d.summary.denied_sessions);
  check("대체 조작 세션", truth.fallback_sessions, d.summary.fallback_sessions);
  check("화질 하향 세션", truth.qd_sessions, d.summary.qd_sessions);
  check("WebGL 손실 세션", truth.wl_sessions, d.summary.wl_sessions);
  check("오류 로그 건수 (중복 전송분은 (sid,seq)로 제거)", truth.error_logs, d.logs.total);
  check("오류 세션", truth.error_sessions, d.logs.sessions);
  for (const [os, v] of Object.entries(truth.devices.os)) check(`OS ${os} 세션`, v, (d.devices.os.find((x) => x.k === os) || {}).v);
  check("인앱 세션", truth.devices.inapp, d.devices.inapp_total);
  check("기기 총 세션", expVisits, d.devices.total);

  // 전기 대비(prev): 마지막 4일을 고르면 직전 4일이 prev — 정답의 일별 합과 비교
  const dl = []; { const a = new Date(truth.range.from + "T00:00:00Z"), b = new Date(truth.range.to + "T00:00:00Z"); for (let x = new Date(a); x <= b; x.setUTCDate(x.getUTCDate() + 1)) dl.push(x.toISOString().slice(0, 10)); }
  if (dl.length >= 8) {
    const cur = dl.slice(-4), pre = dl.slice(-8, -4);
    const rp = await fetch(`${BASE}/api/stats?from=${cur[0]}&to=${cur[3]}&staff=0`, { headers: { "x-stats-key": KEY } });
    const dp = await rp.json();
    check("prev 기간 범위", pre[0] + "~" + pre[3], dp.prev.from + "~" + dp.prev.to);
    check("prev 방문(직전 4일 일별 합)", pre.reduce((a, k) => a + (truth.daily[k] || 0), 0), dp.prev.visits);
    check("prev 완주율 정의(완주/방문)", dp.prev.visits ? Math.round(dp.prev.finished / dp.prev.visits * 1000) / 10 : null, dp.prev.finish_rate);
  }

  // 스태프 포함 시 방문 증가
  const r2 = await fetch(`${BASE}/api/stats?from=${truth.range.from}&to=${truth.range.to}&staff=1`, { headers: { "x-stats-key": KEY } });
  const d2 = await r2.json();
  check("스태프 포함 방문 세션", expVisits + truth.staff_sessions, d2.summary.visits);

  // 키 없이 접근 → 401
  const r3 = await fetch(`${BASE}/api/stats`);
  check("키 없는 요청 거부(401)", 401, r3.status);
  const r4 = await fetch(`${BASE}/api/export?kind=games&${q}`, { headers: { "x-stats-key": KEY } });
  const csv = await r4.text();
  check("CSV 내보내기 행 수(헤더+63)", 64, csv.trim().split(/\r?\n/).length);

  // 출력
  const fails = results.filter((x) => !x.ok);
  for (const x of results) if (!x.ok) console.log(`  ✗ ${x.name}: 기대 ${x.expected} / 실제 ${x.actual}`);
  console.log(`\n[verify] ${results.length}항목 중 ${results.length - fails.length} 일치, ${fails.length} 불일치  (DB=${d.db})`);
  fs.writeFileSync(path.join(ROOT, "data", "verify-result.json"), JSON.stringify({ at: new Date().toISOString(), db: d.db, total: results.length, failed: fails.length, results }, null, 1));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
