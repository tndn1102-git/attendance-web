/* 「K의 나라」 운영 통계 수집 스니펫  v1.0  (의존성 없음, ES5)
   ─────────────────────────────────────────────────────────────────
   앱(index.html)에 두 줄:
     <script>window.KSTAT = { endpoint: "https://knara.tndn1102.workers.dev/api/track", staff: /staff/.test(location.search), app_ver: "1.0" };</script>
     <script src="https://통계서버/track.js" defer></script>
   그 뒤 흐름 지점에서:
     KStat.demo({ age: "20s", gender: "f" })   // 나이대·성별(구간값, 건너뛰기 = "skip")
     KStat.track("role", { role: "chef" })
     KStat.play.start({ room:"land", slot:1, game:"tea", kind:"chef", role:"chef", target:4, limit_s:14 })
     KStat.play.clear({ hits:4 })  /  KStat.play.fail({ hits:2, reason:"timeout" })  /  KStat.play.swap("gjTea")
     KStat.room.enter("land") / KStat.room.done("land") / KStat.allDone() / KStat.result()
     KStat.sensor("motion", "granted"|"denied"|"unsupported")   KStat.qualityDown("low", fps)   KStat.fallback("drag")
   자동: enter(로드 시 1회), 오류 로그(window.onerror·unhandledrejection·console.error), WebGL 컨텍스트 손실,
         오프라인 큐(localStorage) → 온라인 복귀·화면 숨김 때 재전송, (sid, seq) 로 서버가 중복 제거.
   저장하지 않는 것: 이름·연락처·계정·쿠키·IP·정확한 위치. 세션 id 는 무작위이며 기기·사람과 연결되지 않는다. */
(function () {
  if (window.KStat) return;
  var CFG = window.KSTAT || {};
  var OPTOUT_KEY = "kstat:optout";
  /* 입장 페이지 → 게임 인계: 주소에 ?sid=&s0= 가 오면 그 세션을 이어받고(다른 origin 일 때),
     ?kstat=off 가 오면 수집을 끈다(미동의). 같은 origin 이면 sessionStorage 로 자동 공유되어 이 처리가 필요 없다. */
  var URLQ = (function () { var o = {}; try { (location.search || "").replace(/^\?/, "").split("&").forEach(function (kv) { var i = kv.indexOf("="); if (kv) o[decodeURIComponent(kv.slice(0, i < 0 ? kv.length : i))] = decodeURIComponent(i < 0 ? "" : kv.slice(i + 1)); }); } catch (_) {} return o; })();
  if (URLQ.kstat === "off") { try { localStorage.setItem(OPTOUT_KEY, "1"); } catch (_) {} }
  if (URLQ.kstat === "on") { try { localStorage.removeItem(OPTOUT_KEY); } catch (_) {} }
  function optedOut() { try { return localStorage.getItem(OPTOUT_KEY) === "1"; } catch (_) { return false; } }
  var ENDPOINT = CFG.endpoint || (function () {
    // <script src="https://host/track.js"> 의 호스트에서 /api/track 추정
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/\/track\.js.*$/, "/api/track") : "/api/track";
  })();
  var VER = "1.0";
  var MAX_QUEUE = 600, MAX_LOGS = 25, FLUSH_DELAY = 1200;
  var QKEY = "kstat:q", SKEY = "kstat:s";

  /* ── 저장소(없어도 동작) ── */
  function sget(st, k) { try { return st.getItem(k); } catch (_) { return null; } }
  function sset(st, k, v) { try { st.setItem(k, v); } catch (_) {} }
  function rnd() {
    var a = new Array(16), i;
    try { var u = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(u); for (i = 0; i < 16; i++) a[i] = u[i]; }
    catch (_) { for (i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256); }
    var s = ""; for (i = 0; i < 16; i++) s += (a[i] < 16 ? "0" : "") + a[i].toString(16);
    return s;
  }

  /* ── 세션: 탭 단위(sessionStorage). 손님 1명 = 폰 1대 = 세션 1개 ── */
  var mem = null;
  function session() {
    if (mem) return mem;
    var raw = sget(window.sessionStorage, SKEY);
    if (raw) { try { mem = JSON.parse(raw); } catch (_) { mem = null; } }
    // 다른 origin 의 입장 페이지가 넘긴 세션(?sid=32hex&s0=ms)을 이어받는다
    if (URLQ.sid && /^[0-9a-f]{16,64}$/.test(URLQ.sid) && (!mem || mem.sid !== URLQ.sid)) {
      mem = { sid: URLQ.sid, s0: parseInt(URLQ.s0, 10) || Date.now(), q: 1000, entered: true, logs: 0 }; persist();
    }
    if (!mem || !mem.sid) { mem = { sid: rnd(), s0: Date.now(), q: 0, entered: false, logs: 0 }; persist(); }
    return mem;
  }
  function persist() { if (mem) sset(window.sessionStorage, SKEY, JSON.stringify(mem)); }
  function newSession() { mem = { sid: rnd(), s0: Date.now(), q: 0, entered: false, logs: 0 }; persist(); enter(); }

  /* ── 큐(localStorage: 전시장 와이파이 끊김·앱 종료 대비) ── */
  var queue = [];
  try { var qq = JSON.parse(sget(window.localStorage, QKEY) || "[]"); if (qq && qq.length) queue = qq; } catch (_) {}
  function saveQ() { if (queue.length > MAX_QUEUE) queue = queue.slice(queue.length - MAX_QUEUE); sset(window.localStorage, QKEY, JSON.stringify(queue)); }

  function meta() {
    var n = navigator, s = window.screen || {};
    return {
      sw: s.width, sh: s.height, vw: window.innerWidth, vh: window.innerHeight, dpr: window.devicePixelRatio || 1,
      lang: n.language, cores: n.hardwareConcurrency || null, mem: n.deviceMemory || null,
      ref: CFG.ref || (document.referrer ? "link" : "direct"), app_ver: CFG.app_ver || null
    };
  }

  /* ── 적재 ── */
  function push(item) {
    var S = session();
    item.q = ++S.q; item.t = Date.now(); item.sid = S.sid; item.s0 = S.s0; item.staff = !!CFG.staff;
    persist();
    queue.push(item); saveQ();
    schedule();
  }
  function track(e, p) {
    try {
      if (optedOut() && e !== "consent") return; // 미동의: consent 기록 외엔 아무것도 보내지 않는다
      var it = { e: String(e) };
      p = p || {};
      var keys = ["room", "slot", "game", "kind", "role", "lang", "value", "dur_ms", "hits", "target", "limit_s"];
      for (var i = 0; i < keys.length; i++) if (p[keys[i]] != null) it[keys[i]] = p[keys[i]];
      push(it);
    } catch (_) {}
  }
  function log(level, message, extra) {
    try {
      if (optedOut()) return;
      var S = session();
      if (S.logs >= MAX_LOGS) return;
      S.logs++; persist();
      var it = { kind: "log", level: level, message: String(message || "").slice(0, 1000), page: location.pathname };
      if (extra) for (var k in extra) if (extra[k] != null) it[k] = extra[k];
      if (cur.room) it.room = cur.room; if (cur.game) it.game = cur.game;
      push(it);
    } catch (_) {}
  }

  /* ── 전송: 배치(sid별) → fetch keepalive, 성공(2xx)한 항목만 큐에서 제거. 숨김/종료 때는 sendBeacon ── */
  var timer = null, sending = false, backoff = 0;
  function schedule(ms) { if (timer) return; timer = setTimeout(function () { timer = null; flush(false); }, ms != null ? ms : FLUSH_DELAY); }
  function build(items, withMeta) {
    var by = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i], b = by[it.sid];
      if (!b) { b = by[it.sid] = { v: VER, sid: it.sid, s0: it.s0, staff: it.staff, events: [], logs: [] }; if (CFG.token) b.tk = CFG.token; }
      if (it.kind === "log") b.logs.push(it); else b.events.push(it);
      if (it.e === "enter" && withMeta) b.meta = meta();
    }
    var out = [];
    for (var k in by) { by[k].now = Date.now(); out.push(by[k]); }
    return out;
  }
  function flush(final) {
    if (!queue.length) return;
    if (navigator.onLine === false && !final) { schedule(15000); return; }
    var items = queue.slice(0, 100);
    var batches = build(items, true);
    if (final || !window.fetch) {
      // 마지막 기회: sendBeacon(응답 확인 불가 → 큐는 남겨 두고 다음 로드 때 재전송, 서버가 (sid,seq)로 중복 제거)
      for (var i = 0; i < batches.length; i++) {
        try { navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify(batches[i])], { type: "text/plain" })); } catch (_) {}
      }
      return;
    }
    if (sending) return;
    sending = true;
    var done = 0, okAll = true;
    for (var j = 0; j < batches.length; j++) {
      (function (b) {
        fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(b), keepalive: true })
          .then(function (r) { if (!(r.status >= 200 && r.status < 300) && r.status !== 403) okAll = false; else remove(b); })
          .catch(function () { okAll = false; })
          .then(function () {
            if (++done === batches.length) {
              sending = false;
              if (okAll) { backoff = 0; if (queue.length) schedule(200); }
              else { backoff = Math.min((backoff || 2000) * 2, 300000); schedule(backoff); }
            }
          });
      })(batches[j]);
    }
  }
  function remove(b) {
    var ids = {};
    var i;
    for (i = 0; i < b.events.length; i++) ids[b.sid + ":" + b.events[i].q] = 1;
    for (i = 0; i < b.logs.length; i++) ids[b.sid + ":" + b.logs[i].q] = 1;
    var rest = [];
    for (i = 0; i < queue.length; i++) if (!ids[queue[i].sid + ":" + queue[i].q]) rest.push(queue[i]);
    queue = rest; saveQ();
  }

  /* ── 자동 이벤트 ── */
  var cur = { room: null, game: null, slot: null, kind: null, role: null, t0: 0, target: null, limit_s: null, roomT0: 0 };
  function enter() {
    var S = session();
    if (S.entered) return;
    S.entered = true; persist();
    track("enter", { value: CFG.staff ? "staff" : null });
  }
  window.addEventListener("online", function () { schedule(300); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(true); });
  window.addEventListener("pagehide", function () { flush(true); });

  // 오류 후킹
  window.addEventListener("error", function (ev) {
    try {
      if (ev && ev.target && ev.target !== window && (ev.target.tagName === "IMG" || ev.target.tagName === "SCRIPT" || ev.target.tagName === "LINK" || ev.target.tagName === "AUDIO" || ev.target.tagName === "VIDEO")) {
        log("resource", "리소스 로드 실패: " + (ev.target.src || ev.target.href || ""), {}); return;
      }
      log("error", ev.message, { source: ev.filename, lineno: ev.lineno, colno: ev.colno, stack: ev.error && ev.error.stack ? String(ev.error.stack).slice(0, 4000) : null });
    } catch (_) {}
  }, true);
  window.addEventListener("unhandledrejection", function (ev) {
    try { var r = ev.reason; log("unhandledrejection", r && r.message ? r.message : String(r), { stack: r && r.stack ? String(r.stack).slice(0, 4000) : null }); } catch (_) {}
  });
  try {
    var ce = console.error;
    console.error = function () {
      try { var a = Array.prototype.slice.call(arguments).map(function (x) { return x && x.message ? x.message : (typeof x === "object" ? JSON.stringify(x).slice(0, 300) : String(x)); }).join(" "); log("console.error", a, {}); } catch (_) {}
      return ce.apply(console, arguments);
    };
  } catch (_) {}
  // WebGL 컨텍스트 손실 — getContext 를 감싸 캔버스에 자동으로 리스너를 붙인다(앱 수정 불필요)
  try {
    var gc = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type) {
      var ctx = gc.apply(this, arguments);
      try {
        if (ctx && /webgl/i.test(String(type)) && !this.__kstat) {
          this.__kstat = 1;
          this.addEventListener("webglcontextlost", function () { track("webgl_lost", { room: cur.room, game: cur.game }); }, false);
        }
      } catch (_) {}
      return ctx;
    };
  } catch (_) {}

  /* ── 공개 API ── */
  var API = {
    version: VER,
    sid: function () { return session().sid; },
    s0: function () { return session().s0; },
    newSession: newSession,
    optedOut: optedOut,
    /* 입장 페이지에서: consent({agreed:true|false, version:"v1"}). 미동의면 기록 1건만 남기고 수집을 끈다. */
    consent: function (p) {
      p = p || {};
      if (p.agreed) { try { localStorage.removeItem(OPTOUT_KEY); } catch (_) {} }
      track("consent", { kind: String(p.version || "v1"), value: p.agreed ? "agreed" : "declined" });
      if (!p.agreed) { try { localStorage.setItem(OPTOUT_KEY, "1"); } catch (_) {} }
    },
    /* 게임 주소에 세션·동의 상태를 붙여 준다(다른 origin 인계용). 같은 origin 이면 안 붙여도 된다. */
    handoffUrl: function (url, extra) {
      var S = session(), q = [];
      q.push("sid=" + S.sid, "s0=" + S.s0);
      if (optedOut()) q.push("kstat=off");
      if (extra) for (var k in extra) if (extra[k] != null) q.push(encodeURIComponent(k) + "=" + encodeURIComponent(extra[k]));
      return url + (url.indexOf("?") < 0 ? "?" : "&") + q.join("&");
    },
    track: track,
    log: function (m, extra) { log("app", m, extra || {}); },
    sensor: function (kind, result) { track("sensor", { kind: kind, value: result }); },
    role: function (role) { cur.role = role; track("role", { role: role }); },
    lang: function (lang) { track("lang", { lang: lang }); },
    demo: function (p) { p = p || {}; track("demo", { kind: p.age || "skip", value: p.gender || "skip" }); },
    map: function () { track("map"); },
    fallback: function (mode) { track("fallback_input", { kind: mode, room: cur.room, game: cur.game }); },
    qualityDown: function (level, fps) { track("quality_down", { kind: String(level || "low"), value: fps != null ? String(Math.round(fps)) : null, room: cur.room, game: cur.game }); },
    room: {
      enter: function (room) { cur.room = room; cur.roomT0 = Date.now(); track("room_enter", { room: room }); },
      done: function (room, nDone) { track("room_done", { room: room || cur.room, dur_ms: cur.roomT0 ? Date.now() - cur.roomT0 : null, hits: nDone != null ? nDone : null }); }
    },
    play: {
      start: function (p) {
        p = p || {};
        cur.game = p.game || null; cur.slot = p.slot || null; cur.kind = p.kind || null; cur.target = p.target != null ? p.target : null; cur.limit_s = p.limit_s != null ? p.limit_s : null;
        if (p.room) cur.room = p.room; if (p.role) cur.role = p.role;
        cur.t0 = Date.now();
        track("play_start", { room: cur.room, slot: cur.slot, game: cur.game, kind: cur.kind, role: cur.role, target: cur.target, limit_s: cur.limit_s });
      },
      clear: function (p) { p = p || {}; track("play_clear", { room: cur.room, slot: cur.slot, game: cur.game, kind: cur.kind, role: cur.role, dur_ms: p.dur_ms != null ? p.dur_ms : (cur.t0 ? Date.now() - cur.t0 : null), hits: p.hits != null ? p.hits : cur.target, target: cur.target, limit_s: cur.limit_s }); cur.t0 = 0; },
      fail: function (p) { p = p || {}; track("play_fail", { room: cur.room, slot: cur.slot, game: cur.game, kind: cur.kind, role: cur.role, dur_ms: p.dur_ms != null ? p.dur_ms : (cur.t0 ? Date.now() - cur.t0 : null), hits: p.hits != null ? p.hits : null, target: cur.target, limit_s: cur.limit_s, value: p.reason || "timeout" }); cur.t0 = 0; },
      swap: function (toGame) { track("play_swap", { room: cur.room, slot: cur.slot, game: cur.game, kind: cur.kind, role: cur.role, value: toGame || null }); }
    },
    allDone: function () { track("all_done", { dur_ms: Date.now() - session().s0, role: cur.role }); },
    result: function () { track("result", { dur_ms: Date.now() - session().s0, role: cur.role }); },
    flush: function () { flush(false); }
  };
  window.KStat = API;

  if (!optedOut()) enter();
  if (queue.length) schedule(800); // 지난 방문에서 못 보낸 것 재전송
})();
