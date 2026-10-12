/* 시드 — 현실적인 가짜 데이터를 "실제 수집 경로(HTTP POST /api/track)"로 밀어 넣는다.
   track.js 가 보내는 배치 형식 그대로 보내므로 수집 API·중복 제거·UA 파싱까지 함께 검증된다.
   정답(ground truth)은 data/seed-truth.json 에 저장 → scripts/verify.js 가 집계와 대조.
   사용: node scripts/seed.js [--sessions 420] [--days 10] [--endpoint http://localhost:8787/api/track] [--seed 7] */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GAMES, ROOMS, CONCEPTS, TYPES } from "../lib/catalog.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const N_SESSIONS = parseInt(arg("sessions", "420"), 10);
const N_DAYS = parseInt(arg("days", "10"), 10);
const ENDPOINT = arg("endpoint", "http://127.0.0.1:8787/api/track");
const TOKEN = process.env.TRACK_TOKEN || "";

/* 결정적 난수(재현 가능) */
let seedv = parseInt(arg("seed", "7"), 10) >>> 0;
function rnd() { seedv = (seedv * 1664525 + 1013904223) >>> 0; return seedv / 4294967296; }
const U = (a, b) => a + (b - a) * rnd();
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
function weighted(pairs) { const t = pairs.reduce((s, p) => s + p[1], 0); let r = rnd() * t; for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; } return pairs[pairs.length - 1][0]; }

/* 기기 프로필 (UA 는 실제 패턴) */
const DEVICES = [
  { w: 30, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", vw: 390, vh: 664, dpr: 3, low: 0.03 },
  { w: 8, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1", vw: 375, vh: 553, dpr: 2, low: 0.35 },
  { w: 9, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.6.5", vw: 390, vh: 700, dpr: 3, low: 0.05, inapp: true },
  { w: 22, ua: "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36", vw: 412, vh: 830, dpr: 2.6, low: 0.02 },
  { w: 9, ua: "Mozilla/5.0 (Linux; Android 13; SM-A325N Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36", vw: 412, vh: 780, dpr: 2, low: 0.55 },
  { w: 6, ua: "Mozilla/5.0 (Linux; Android 11; SM-A215N Build/RP1A.200720.012) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36", vw: 360, vh: 720, dpr: 2, low: 0.7 },
  { w: 5, ua: "Mozilla/5.0 (Linux; Android 14; SM-S911N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.5.3)", vw: 412, vh: 760, dpr: 2.6, low: 0.05, inapp: true },
  { w: 4, ua: "Mozilla/5.0 (Linux; Android 12; LM-Q730N Build/SKQ1.211103.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36", vw: 393, vh: 785, dpr: 2.75, low: 0.6 },
  { w: 3, ua: "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1", vw: 820, vh: 1100, dpr: 2, low: 0.02 },
  { w: 2, ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0", vw: 1366, vh: 657, dpr: 1, low: 0, pc: true },
  { w: 2, ua: "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36", vw: 412, vh: 800, dpr: 2.6, low: 0.1 },
];
const ERRORS = [
  ["error", "TypeError: Cannot read properties of undefined (reading 'position')", "/knara/", 1, 48213],
  ["unhandledrejection", "NotAllowedError: play() failed because the user didn't interact with the document first.", "/knara/", 0, 0],
  ["console.error", "THREE.WebGLRenderer: Context Lost.", "/knara/", 0, 0],
  ["error", "RangeError: Maximum call stack size exceeded", "/knara/", 1, 9120],
  ["resource", "리소스 로드 실패: https://desirenvy1.duckdns.org/knara/assets/tex/sea_02.ktx2", "/knara/", 0, 0],
  ["unhandledrejection", "DOMException: The operation is insecure (DeviceMotionEvent.requestPermission)", "/knara/", 0, 0],
];

/* 놀이별 '숨은 난이도' = 성공 확률. 일부는 의도적으로 극단값(대시보드 판정 검증용) */
const BASE = {};
for (const g of GAMES) BASE[g.type] = U(0.55, 0.9);
Object.assign(BASE, { cairn: 0.3, tangerines: 0.38, gnJump: 0.4, dgVlog: 0.42, jjPano: 0.44, sjJikji: 0.97, jjHarubang: 0.96, slBell: 0.95, paengi: 0.93, gonggi: 0.72 });

const byRoom = {};
for (const g of GAMES) (byRoom[g.room] ||= []).push(g);
const CKEYS = Object.keys(CONCEPTS);
// 컨셉별 인기(DM 수락 확률) — 대시보드에 차이가 보이도록
const likes = { beauty: 0.7, mukbang: 0.88, food: 0.62, sight: 0.8, travel: 0.74, trad: 0.55 };

const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dayList = Array.from({ length: N_DAYS }, (_, i) => { const d = new Date(TODAY + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - (N_DAYS - 1 - i)); return d.toISOString().slice(0, 10); });
// 일별 가중치: 주말 많음, 첫날 적음
const dayWeight = dayList.map((d, i) => { const dow = new Date(d + "T00:00:00Z").getUTCDay(); return (dow === 0 || dow === 6 ? 1.6 : 1) * (i === 0 ? 0.5 : 1); });

const truth = {
  range: { from: dayList[0], to: dayList[dayList.length - 1] }, sessions: 0, staff_sessions: 0,
  daily: {}, hourly: {}, funnel: { enter: 0, sensor: 0, role: 0, map: 0, room_enter: 0, play_start: 0, room_done: 0, all_done: 0, result: 0 },
  rooms_done_dist: {}, total_secs: [], games: {}, rooms: {}, roles: {}, langs: {}, ages: {}, genders: {}, consent: { agreed: 0, declined: 0 }, sensors: {}, denied_sessions: 0, fallback_sessions: 0,
  qd_sessions: 0, wl_sessions: 0, error_logs: 0, error_sessions: 0, devices: { os: {}, browser: {}, inapp: 0 }, today: TODAY, plays: 0, clears: 0, fails: 0, swaps: 0,
};
const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const gameT = (t) => (truth.games[t] ||= { starts: 0, clears: 0, fails: 0, timeouts: 0, swaps_out: 0, clear_secs: [], players: new Set() });
const roomT = (r) => (truth.rooms[r] ||= { enters: 0, done: 0, plays: 0, clears: 0, fails: 0, swaps: 0 });

function hex(n) { let s = ""; for (let i = 0; i < n; i++) s += Math.floor(rnd() * 16).toString(16); return s; }

function makeSession(idx, staff) {
  const dayIdx = weighted(dayList.map((_, i) => [i, dayWeight[i]]));
  const day = dayList[dayIdx];
  const hour = weighted([[10, 6], [11, 10], [12, 7], [13, 11], [14, 14], [15, 14], [16, 12], [17, 8], [18, 3]]);
  const minute = Math.floor(rnd() * 60);
  let t = Date.parse(day + "T00:00:00+09:00") + hour * 3600e3 + minute * 60e3 + Math.floor(rnd() * 60e3);
  // 오늘이면 미래 시각 금지
  if (t > Date.now() - 60e3) t = Date.now() - Math.floor(U(60e3, 3 * 3600e3));
  const s0 = t;
  const hourActual = new Date(s0 + 9 * 3600e3).getUTCHours(); // 정답은 실제(보정 후) 시작 시각 기준
  const dev = weighted(DEVICES.map((d) => [d, d.w]));
  const sid = hex(32);
  const ev = [], logs = [];
  let q = 0;
  const push = (e, p = {}) => { ev.push({ q: ++q, t, e, ...p }); };
  const log = (l, m, src, ln, col) => { logs.push({ q: ++q, t, level: l, message: m, source: src ? "https://desirenvy1.duckdns.org" + src + "app.js" : null, lineno: ln || null, colno: col || null, page: "/knara/" }); };
  const T = !staff;
  const roleId = weighted([["idol", 40], ["chef", 32], ["creator", 28]]);
  const lang = weighted([["ko", 80], ["en", 9], ["zh", 5], ["ja", 4], ["es", 2]]);
  const demoSkip = rnd() < 0.15;
  const age = demoSkip ? "skip" : weighted([["10s", 12], ["20s", 30], ["30s", 22], ["40s", 18], ["50s", 11], ["60s+", 7]]);
  const gender = demoSkip ? "skip" : weighted([["f", 55], ["m", 42], ["other", 3]]);
  const declined = rnd() < 0.07; // 입장 페이지에서 "동의 없이 시작" — consent(declined) 만 남기고 수집 중단
  const motion = dev.pc ? "unsupported" : weighted([["granted", 78], ["denied", 17], ["unsupported", 5]]);
  const mic = weighted([["granted", 70], ["denied", 30]]);
  const lowEnd = rnd() < dev.low;

  if (T) { truth.sessions++; inc(truth.daily, day); inc(truth.hourly, hourActual); truth.funnel.enter++; }
  push("enter", { value: staff ? "staff" : null });
  if (T) { const ua = dev.ua; inc(truth.devices.os, /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : "Windows"); if (dev.inapp) truth.devices.inapp++;
    inc(truth.devices.browser, /KAKAOTALK/.test(ua) ? "카카오톡" : /NAVER/.test(ua) ? "네이버앱" : /SamsungBrowser/.test(ua) ? "삼성인터넷" : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : "Safari"); }
  t += U(2e3, 6e3);
  if (declined) { push("consent", { kind: "v1", value: "declined" }); if (T) truth.consent.declined++; return finish(true); }
  push("lang", { lang }); t += U(1e3, 3e3);
  push("demo", { kind: age, value: gender }); t += U(1e3, 2e3);
  push("consent", { kind: "v1", value: "agreed" }); t += U(500, 1500);
  if (T) { inc(truth.langs, lang); inc(truth.ages, age); inc(truth.genders, gender); truth.consent.agreed++; }
  if (rnd() < 0.06) return finish(); // 첫 화면 이탈

  push("sensor", { kind: "motion", value: motion }); t += U(1e3, 4e3);
  push("sensor", { kind: "mic", value: mic }); t += U(1e3, 3e3);
  if (T) { truth.funnel.sensor++; inc(truth.sensors, "motion:" + motion); inc(truth.sensors, "mic:" + mic); if (motion === "denied" || mic === "denied") truth.denied_sessions++; }
  if (rnd() < 0.04) return finish();

  push("role", { role: roleId }); t += U(3e3, 9e3);
  if (T) { truth.funnel.role++; inc(truth.roles, roleId); }
  if (rnd() < 0.03) return finish();
  push("map"); t += U(3e3, 10e3);
  if (T) truth.funnel.map++;

  let usedFallback = false, qd = false, wl = false, enteredRoom = false, played = false, doneRooms = 0;
  if (lowEnd && rnd() < 0.85) { qd = true; }
  const order = ROOMS.map((r) => r.id).sort(() => rnd() - 0.5);
  let quit = false;
  for (const room of order) {
    if (quit) break;
    push("room_enter", { room }); const roomT0 = t; t += U(4e3, 9e3);
    if (T) { roomT(room).enters++; if (!enteredRoom) { truth.funnel.room_enter++; enteredRoom = true; } }
    if (qd && doneRooms === 0 && !usedFallback && rnd() < 0.9) { push("quality_down", { kind: "low", value: String(Math.round(U(18, 27))), room }); if (T) truth.qd_sessions++; qd = "sent"; }
    // 노리개 편: 방마다 DM 이 오고(수락/넘김), 수락하면 놀이 → 별점(0~3). 3개 성공하면 방 완료 + 노리개 선물
    const pool0 = byRoom[room].slice().sort(() => rnd() - 0.5);
    let roomClears = 0, lastConcept = null;
    for (let slot = 1; slot <= 3 && !quit; slot++) {
      let game = pool0.shift() || pick(byRoom[room]);
      while (pool0.length && rnd() > likes[game.kind]) { push("dm_skip", { room, game: game.type, kind: game.kind }); t += U(1e3, 3e3); game = pool0.shift(); }
      push("dm_ok", { room, game: game.type, kind: game.kind }); t += U(1e3, 3e3);
      const kind = game.kind; lastConcept = kind;
      let attempts = 0, cleared = false;
      while (!cleared && !quit) {
        attempts++;
        push("play_start", { room, slot, game: game.type, kind, role: roleId, target: game.target, limit_s: game.limit_s });
        if (T) { gameT(game.type).starts++; gameT(game.type).players.add(sid); roomT(room).plays++; truth.plays++; if (!played) { truth.funnel.play_start++; played = true; } }
        let p = BASE[game.type]; if (lowEnd) p *= 0.92; if (attempts > 1) p = Math.min(0.98, p + 0.1); if (attempts >= 3) p = 1;
        const limit = game.limit_s || 20;
        if (rnd() < p) {
          const dur = Math.round(limit * U(0.35, 0.95) * 1000); t += dur;
          push("play_clear", { room, slot, game: game.type, kind, role: roleId, dur_ms: dur, hits: 1, target: game.target, limit_s: limit });
          if (T) { gameT(game.type).clears++; gameT(game.type).clear_secs.push(dur / 1000); roomT(room).clears++; truth.clears++; }
          push("star", { room, game: game.type, kind, hits: rnd() < p ? 3 : rnd() < 0.6 ? 2 : 1 });
          cleared = true; roomClears++;
        } else {
          const dur = limit * 1000; t += dur;
          push("play_fail", { room, slot, game: game.type, kind, role: roleId, dur_ms: dur, hits: 0, target: game.target, limit_s: limit, value: "timeout" });
          if (T) { gameT(game.type).fails++; gameT(game.type).timeouts++; roomT(room).fails++; truth.fails++; }
          push("star", { room, game: game.type, kind, hits: 0 });
          t += U(1500, 3500);
          if (rnd() < 0.05) { quit = true; break; }
        }
        t += U(5e3, 11e3);
      }
    }
    if (!quit && roomClears === 3) push("gift", { room, kind: lastConcept });
    if (quit) break;
    if (roomClears === 3) {
      doneRooms++;
      push("room_done", { room, dur_ms: t - roomT0, hits: doneRooms });
      if (T) { roomT(room).done++; if (doneRooms === 1) truth.funnel.room_done++; }
      t += U(12e3, 40e3);
      if (rnd() < 0.015 && !wl) { push("webgl_lost", { room }); wl = true; if (T) truth.wl_sessions++; }
      if (doneRooms < 8 && rnd() < 0.07) { quit = true; break; }
    }
  }
  if (T) inc(truth.rooms_done_dist, doneRooms);
  if (!quit && doneRooms === 8) {
    push("all_done", { dur_ms: t - s0, role: roleId });
    if (T) { truth.funnel.all_done++; truth.total_secs.push((t - s0) / 1000); }
    t += U(3e3, 8e3);
    if (rnd() < 0.96) { push("result", { dur_ms: t - s0, role: roleId }); if (T) truth.funnel.result++;
      const tk = weighted(Object.keys(TYPES).map((k) => [k, k.split("-").reduce((a, c) => a * (likes[c] || 0.5), 1)]));
      push("type_result", { kind: tk, room: pick(ROOMS).id, hits: 20 + Math.floor(U(0, 5)) }); }
  }
  return finish();

  function finish(noLogs) {
    // 오류 로그: 인앱·저사양에서 더 자주 (미동의 세션은 수집 중단이라 로그 없음)
    const pErr = 0.03 + (dev.inapp ? 0.08 : 0) + (lowEnd ? 0.05 : 0);
    if (!noLogs && rnd() < pErr) {
      const n = rnd() < 0.3 ? 2 : 1;
      for (let i = 0; i < n; i++) { const e = pick(ERRORS); log(e[0], e[1], e[2], e[3], e[4]); }
      if (T) { truth.error_logs += n; truth.error_sessions++; }
    }
    return { sid, s0, staff, dev, ev, logs };
  }
}

async function send(sess) {
  const meta = { sw: sess.dev.vw, sh: sess.dev.vh + 100, vw: sess.dev.vw, vh: sess.dev.vh, dpr: sess.dev.dpr, lang: "ko-KR", cores: 8, mem: sess.dev.low > 0.3 ? 3 : 6, ref: "direct", app_ver: "1.0.0" };
  const all = sess.ev.map((e) => ({ ...e, _k: "e" })).concat(sess.logs.map((l) => ({ ...l, _k: "l" })));
  for (let i = 0; i < all.length; i += 100) {
    const chunk = all.slice(i, i + 100);
    const body = { v: "1.0", sid: sess.sid, s0: sess.s0, now: Date.now(), staff: sess.staff, events: chunk.filter((x) => x._k === "e").map(({ _k, ...e }) => e), logs: chunk.filter((x) => x._k === "l").map(({ _k, ...l }) => l) };
    if (i === 0) body.meta = meta;
    if (TOKEN) body.tk = TOKEN;
    // Windows 로컬 keep-alive 소켓 경합(ECONNRESET) 대비: Connection: close + 3회 재시도. 서버가 (sid,seq)로 중복 제거하므로 재시도는 안전.
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain", "User-Agent": sess.dev.ua, Connection: "close" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error("track 실패 " + r.status + " " + (await r.text()));
        lastErr = null; break;
      } catch (e) { lastErr = e; await new Promise((res) => setTimeout(res, 200 * (attempt + 1))); }
    }
    if (lastErr) throw lastErr;
  }
}

(async () => {
  console.log(`[seed] ${N_SESSIONS}세션(+스태프 12) · ${dayList[0]}~${dayList[dayList.length - 1]} → ${ENDPOINT}`);
  const sessions = [];
  for (let i = 0; i < N_SESSIONS; i++) sessions.push(makeSession(i, false));
  for (let i = 0; i < 12; i++) { sessions.push(makeSession(1000 + i, true)); truth.staff_sessions++; }
  let done = 0;
  const workers = Array.from({ length: 8 }, async () => { while (sessions.length) { const s = sessions.shift(); await send(s); if (++done % 50 === 0) process.stdout.write(`  ${done}세션 전송\n`); } });
  await Promise.all(workers);
  // 중복 제거 검증용: 첫 세션 배치를 한 번 더 보낸다(같은 sid·seq → 집계에 영향 없어야 함)
  const dup = makeSession(5000, false); // (새 세션이지만) 같은 payload 를 2회 전송
  await send(dup); await send(dup);
  truth.dup_sid = dup.sid;
  for (const t of Object.values(truth.games)) t.players = t.players.size;
  fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "data", "seed-truth.json"), JSON.stringify(truth, null, 1));
  console.log(`[seed] 완료. 일반 ${truth.sessions} + 중복시험 1 + 스태프 ${truth.staff_sessions} 세션. 정답 → data/seed-truth.json`);
})().catch((e) => { console.error(e); process.exit(1); });
