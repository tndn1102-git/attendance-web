/* K의 나라 운영 통계 — 대시보드 (의존성 없음, ES2017 이하: 구형 엣지(EdgeHTML 18) 호환.
   Object.fromEntries / Array.flat / replaceAll / ?. / ?? 사용 금지)
   차트: 인라인 SVG — sparkline · meter · lineChart(선+면) · colChart(세로 컬럼) · donut · stackBar100 · 툴팁(docs/벤치마크_통계대시보드.md §6)
   화면: 개요 · 놀이별 · 내보내기/인쇄 · 자세히 */
(function () {
  "use strict";
  var KEY_STORE = "kstat:key";
  var state = {
    view: "overview", preset: "7", from: null, to: null, staff: false, data: null, customOpen: false,
    gf: { room: "", sort: "default", dir: "asc" },
  };
  var CH = {}; // chartbox id → function(width) → svg (패널 안폭을 clientWidth 로 읽어 그린다)
  var chId = 0;

  /* ───── 유틸 ───── */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmtInt(v) { return v == null ? "—" : Number(v).toLocaleString("ko-KR"); }
  function fmtPct(v) { return v == null ? "—" : Math.round(Number(v)) + "%"; }
  function fmtSec(s) {
    if (s == null) return "—";
    s = Math.round(s);
    if (s < 60) return s + "초";
    var m = Math.floor(s / 60), r = s % 60;
    if (m < 60) return m + "분" + (r ? " " + r + "초" : "");
    return Math.floor(m / 60) + "시간 " + (m % 60) + "분";
  }
  function kst(iso, withDate) {
    if (!iso) return "—";
    var d = new Date(iso); if (isNaN(d)) return "—";
    var k = new Date(d.getTime() + 9 * 3600 * 1000), p = function (n) { return ("0" + n).slice(-2); };
    var t = p(k.getUTCHours()) + ":" + p(k.getUTCMinutes());
    return withDate === false ? t : (k.getUTCMonth() + 1) + "/" + k.getUTCDate() + " " + t;
  }
  function todayKST() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
  function addDays(day, n) { var d = new Date(day + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000); }
  function mmdd(day) { return parseInt(day.slice(5, 7), 10) + "/" + parseInt(day.slice(8, 10), 10); }
  function pctW(a, b) { return b > 0 ? Math.max(0, Math.min(100, a / b * 100)) : 0; }
  function sum(arr, k) { return arr.reduce(function (a, x) { return a + (x[k] || 0); }, 0); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function niceMax(v) { if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), m = v / p; var n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 8 ? 8 : 10; return n * p; }
  function sortBy(arr, key, dir) {
    return arr.slice().sort(function (a, b) {
      var x = a[key], y = b[key];
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      if (typeof x === "string") return dir === "asc" ? x.localeCompare(y, "ko") : y.localeCompare(x, "ko");
      return dir === "asc" ? x - y : y - x;
    });
  }
  function kv(list) { return list.map(function (x) { return { k: x.name, v: x.sessions }; }); }
  function foldTop(items, n, label) { // 상위 n + 나머지 합 "기타(이름·이름)"
    var s = sortBy(items, "v", "desc"), top = s.slice(0, n), rest = s.slice(n);
    if (rest.length) { var names = rest.slice(0, 3).map(function (x) { return x.k; }).join("·"); top.push({ k: (label || "기타") + " (" + names + (rest.length > 3 ? " 외" : "") + ")", v: sum(rest, "v"), neutral: true }); }
    return top;
  }

  /* ───── 상태 ↔ 주소(해시) ───── */
  function readHash() {
    var h = location.hash.replace(/^#/, ""), q = {};
    h.split("&").forEach(function (kv) { if (!kv) return; var i = kv.indexOf("="); q[decodeURIComponent(kv.slice(0, i < 0 ? kv.length : i))] = i < 0 ? "" : decodeURIComponent(kv.slice(i + 1)); });
    if (q.view) state.view = q.view;
    if (q.staff === "1") state.staff = true;
    if (q.preset) state.preset = q.preset;
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.from || "") && /^\d{4}-\d{2}-\d{2}$/.test(q.to || "")) { state.from = q.from; state.to = q.to; state.preset = q.preset || "custom"; }
    ["room", "sort", "dir"].forEach(function (k) { if (q[k] != null) state.gf[k] = q[k]; });
    state.print = q.print === "1";
  }
  function writeHash() {
    var parts = ["view=" + state.view, "preset=" + state.preset, "from=" + state.from, "to=" + state.to];
    if (state.staff) parts.push("staff=1");
    ["room", "sort", "dir"].forEach(function (k) { if (state.gf[k]) parts.push(k + "=" + encodeURIComponent(state.gf[k])); });
    var nh = "#" + parts.join("&");
    if (location.hash !== nh) history.replaceState(null, "", nh);
  }
  function applyPreset() {
    var t = todayKST();
    if (state.preset === "today") { state.from = t; state.to = t; }
    else if (state.preset === "7") { state.from = addDays(t, -6); state.to = t; }
    else if (state.preset === "30") { state.from = addDays(t, -29); state.to = t; }
    else if (state.preset === "exhibit") {
      var ex = (state.data && state.data.exhibit) || {};
      var s = ex.start || "2026-11-02", e = ex.end || t;
      if (s > t) s = t;
      state.from = s; state.to = e;
    }
    if (!state.from || !state.to) { state.from = addDays(t, -6); state.to = t; }
  }

  /* ───── 인증 ───── */
  function getKey() { try { return sessionStorage.getItem(KEY_STORE) || ""; } catch (_) { return state._key || ""; } }
  function setKey(k) { state._key = k; try { if (k) sessionStorage.setItem(KEY_STORE, k); else sessionStorage.removeItem(KEY_STORE); } catch (_) {} }
  (function pickKeyFromURL() {
    var m = location.search.match(/[?&]key=([^&]+)/);
    if (m) { setKey(decodeURIComponent(m[1])); history.replaceState(null, "", location.pathname + location.hash); }
  })();
  function showGate(msg) {
    $("app").hidden = true; $("gate").hidden = false;
    $("gateErr").textContent = msg || ""; $("gateKey").value = ""; setTimeout(function () { $("gateKey").focus(); }, 50);
  }
  $("gateForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var k = $("gateKey").value.trim();
    if (!k) return;
    setKey(k); $("gateErr").textContent = "확인 중…";
    load().then(function () { $("gate").hidden = true; $("app").hidden = false; }).catch(function (err) { setKey(""); $("gateErr").textContent = err.message; });
  });

  /* ───── 데이터 ───── */
  function api(path, params) {
    var qs = Object.keys(params).map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&");
    return fetch(path + "?" + qs, { headers: { "x-stats-key": getKey() }, cache: "no-store" });
  }
  function load() {
    applyPreset();
    $("content").innerHTML = '<div class="loading">불러오는 중…</div>';
    return api("/api/stats", { from: state.from, to: state.to, staff: state.staff ? 1 : 0 }).then(function (r) {
      if (r.status === 401 || r.status === 503) return r.json().then(function (j) { throw new Error(j.error || "접속 키 오류"); });
      if (!r.ok) throw new Error("서버 오류 (" + r.status + ")");
      return r.json();
    }).then(function (j) {
      state.data = j;
      if (state.preset === "exhibit") { applyPreset(); if (j.range.from !== state.from || j.range.to !== state.to) return load(); }
      render();
    });
  }

  /* ───── 차트 부품 ───── */
  // KPI 타일: kpi(label, value, {sub, cls, delta:{pct, good, unit}, spark:[…], meter:{pct, cls}})
  function kpi(label, value, opts) {
    opts = opts || {};
    var h = '<div class="kpi' + (opts.cls ? " " + opts.cls : "") + '"><div class="col"><div class="lbl">' + esc(label) + '</div><div class="v">' + value + "</div>";
    if (opts.meter) h += meter(opts.meter.pct, opts.meter.cls);
    h += '<div class="s">';
    if (opts.delta && opts.delta.pct != null) {
      var p = opts.delta.pct, up = p >= 0, good = opts.delta.good !== false, cls = (up === good) ? "up" : "down";
      h += '<span class="delta ' + cls + '">' + (up ? "▲" : "▼") + " " + Math.abs(Math.round(p)) + (opts.delta.unit || "%") + "</span>";
    }
    h += (opts.sub || "&nbsp;") + "</div></div>";
    if (opts.spark && opts.spark.length > 1) h += sparkline(opts.spark, 150, 44);
    return h + "</div>";
  }
  function sparkline(values, w, h) {
    w = w || 150; h = h || 44;
    if (!values || values.length < 2) return "";
    var pad = 6, max = Math.max.apply(null, values.concat([1])), n = values.length;
    var pts = values.map(function (v, i) { return [pad + i * (w - pad * 2) / (n - 1), pad + (h - pad * 2) * (1 - v / max)]; });
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + r1(p[0]) + " " + r1(p[1]); }).join(" ");
    var last = pts[n - 1];
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="var(--chart-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="' + r1(last[0]) + '" cy="' + r1(last[1]) + '" r="4" fill="var(--chart-1)" stroke="#FFFDF8" stroke-width="2"/></svg>';
  }
  function meter(pct, cls) {
    return '<div class="meter' + (cls ? " " + cls : "") + '" role="img" aria-label="' + fmtPct(pct) + '"><span style="width:' + pctW(pct || 0, 100) + '%"></span></div>';
  }
  function chartbox(fn, h) { var id = "ch" + (++chId); CH[id] = fn; return '<div class="chartbox" id="' + id + '" style="height:' + (h || 196) + 'px"></div>'; }
  function drawCharts() {
    Object.keys(CH).forEach(function (id) { var el = $(id); if (el) { el.innerHTML = CH[id](el.clientWidth || 600); } delete CH[id]; });
  }
  function fillDays(daily, from, to) {
    var days = [], map = {}; daily.forEach(function (d) { map[d.day] = d; });
    for (var i = 0, n = daysBetween(from, to); i <= n; i++) { var dk = addDays(from, i); days.push(map[dk] || { day: dk, visits: 0, finished: 0, plays: 0 }); }
    return days;
  }
  // 선 + 면: series = [{name, key, color, area, cls}], days = [{day, …}]
  function lineChart(series, days, opts) {
    opts = opts || {};
    var w = opts.w || 842, h = opts.h || 196, L = 36, R = w - (opts.endLabel === false ? 10 : 82), T = 14, B = h - 30, n = days.length;
    var all = []; series.forEach(function (s) { days.forEach(function (d) { all.push(d[s.key] || 0); }); });
    var hasData = all.some(function (v) { return v > 0; });
    var max = niceMax(Math.max.apply(null, all.concat([1])));
    var x = function (i) { return n > 1 ? L + i * (R - L) / (n - 1) : (L + R) / 2; }, y = function (v) { return T + (B - T) * (1 - v / max); };
    var s = '<svg class="chart" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(opts.label || "") + '">';
    [1, 0.5].forEach(function (g) { s += '<line class="grid" x1="' + L + '" x2="' + R + '" y1="' + r1(y(max * g)) + '" y2="' + r1(y(max * g)) + '"/><text x="' + (L - 6) + '" y="' + r1(y(max * g) + 3.5) + '" text-anchor="end">' + Math.round(max * g) + "</text>"; });
    s += '<line class="base" x1="' + L + '" x2="' + R + '" y1="' + B + '" y2="' + B + '"/><text x="' + (L - 6) + '" y="' + (B + 3.5) + '" text-anchor="end">0</text>';
    if (!hasData) return s + '<text x="' + ((L + R) / 2) + '" y="' + ((T + B) / 2) + '" text-anchor="middle">기간 내 자료 없음</text></svg>';
    series.forEach(function (sr, si) {
      var pts = days.map(function (d, i) { return [r1(x(i)), r1(y(d[sr.key] || 0))]; });
      var path = pts.map(function (p, i) { return (i ? "L" : "M") + p[0] + " " + p[1]; }).join(" ");
      if (sr.area) s += '<path class="area-' + (si + 1) + '" d="' + path + " L" + pts[n - 1][0] + " " + B + " L" + pts[0][0] + " " + B + ' Z" fill="' + sr.color + '" opacity=".10"/>';
      s += '<path class="line-' + (si + 1) + '" d="' + path + '" fill="none" stroke="' + sr.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
      if (n <= 40) s += '<g fill="' + sr.color + '" stroke="#FFFDF8" stroke-width="2">' + pts.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4"/>'; }).join("") + "</g>";
      if (opts.endLabel !== false) s += '<text class="end" x="' + (R + 10) + '" y="' + r1(pts[n - 1][1] + 4) + '">' + esc(sr.name) + " " + fmtInt(days[n - 1][sr.key] || 0) + "</text>";
    });
    var every = n <= 12 ? 1 : n <= 32 ? 2 : 7;
    s += '<g text-anchor="middle">' + days.map(function (d, i) { return i % every === 0 ? '<text x="' + r1(x(i)) + '" y="' + (h - 10) + '">' + mmdd(d.day) + "</text>" : ""; }).join("") + "</g>";
    if (!opts.print) {
      var bw = n > 1 ? (R - L) / (n - 1) : R - L;
      s += days.map(function (d, i) {
        var tip = mmdd(d.day) + " · " + series.map(function (sr) { return sr.name + " " + fmtInt(d[sr.key] || 0); }).join(" · ") + (series.length > 1 && d[series[0].key] ? " (" + fmtPct((d[series[1].key] || 0) / d[series[0].key] * 100) + ")" : "");
        return '<rect class="hit" x="' + r1(x(i) - bw / 2) + '" y="' + T + '" width="' + r1(Math.max(bw, 24)) + '" height="' + (B - T) + '" tabindex="0" data-tip="' + esc(tip) + '" data-xh="' + r1(x(i)) + '"/>';
      }).join("");
      s += '<line class="xh" id="xh" x1="0" x2="0" y1="' + T + '" y2="' + B + '" style="display:none"/>';
    }
    return s + "</svg>";
  }
  // 세로 컬럼: items = [{k, v}], opts {w, h, fmt:'pct'|'int', total, highlight, highlightColor, labelOnly:'max', xEvery, print}
  function colChart(items, opts) {
    opts = opts || {};
    var w = opts.w || 399, h = opts.h || 196, n = items.length, B = h - 30, T = opts.labelOnly ? 16 : 22;
    var vals = items.map(function (x) { return x.v || 0; }), max = Math.max.apply(null, vals.concat([1])), total = opts.total || sum(items, "v");
    var slot = w / n, bw = Math.min(24, slot * 0.4), maxIdx = vals.indexOf(max);
    var s = '<svg class="chart" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(opts.label || "") + '">';
    s += '<line class="base" x1="0" x2="' + w + '" y1="' + B + '" y2="' + B + '"/>';
    if (max <= 0 || !total) return s + '<text x="' + (w / 2) + '" y="' + ((T + B) / 2) + '" text-anchor="middle">' + esc(opts.empty || "자료 없음") + "</text></svg>";
    var fmt = function (v) { return opts.fmt === "int" ? fmtInt(v) : fmtPct(v / total * 100); };
    items.forEach(function (it, i) {
      var v = it.v || 0, bh = (B - T) * v / max, cx = slot * i + slot / 2, x0 = r1(cx - bw / 2), y0 = r1(B - bh);
      var color = (opts.highlight === i) ? (opts.highlightColor || "var(--chart-gold)") : "var(--chart-1)";
      if (v > 0) s += bh >= 4 ? '<path d="M' + x0 + " " + r1(y0 + 4) + " a4 4 0 0 1 4 -4 h" + r1(bw - 8) + " a4 4 0 0 1 4 4 v" + r1(bh - 4) + " h-" + r1(bw) + ' z" fill="' + color + '"/>' : '<rect x="' + x0 + '" y="' + y0 + '" width="' + r1(bw) + '" height="' + r1(bh) + '" fill="' + color + '"/>';
      if (v > 0 && (!opts.labelOnly || i === maxIdx)) s += '<text class="val" x="' + r1(cx) + '" y="' + r1(y0 - 6) + '" text-anchor="middle">' + fmt(v) + "</text>";
      if (!opts.xEvery || i % opts.xEvery === 0) s += '<text x="' + r1(cx) + '" y="' + (h - 12) + '" text-anchor="middle">' + esc(it.k) + "</text>";
      if (!opts.print) s += '<rect class="hit" x="' + r1(slot * i) + '" y="' + T + '" width="' + r1(slot) + '" height="' + (B - T) + '" tabindex="0" data-tip="' + esc(it.k + " · " + fmtInt(v) + (opts.fmt === "int" ? "" : " · " + fmtPct(v / total * 100))) + '"/>';
    });
    return s + "</svg>";
  }
  // 도넛: slices = [{k, v, color, cls}] ≤4 (마지막 중립 허용)
  function donut(slices, opts) {
    opts = opts || {};
    var C = 289.03, total = sum(slices, "v"), size = opts.size || 112, cx = size / 2;
    var s = '<div class="donut-wrap"><svg class="donut" width="' + size + '" height="' + size + '" viewBox="0 0 112 112" role="img" aria-label="' + esc(opts.label || "") + '">';
    s += '<g transform="rotate(-90 56 56)" fill="none" stroke-width="14"><circle cx="56" cy="56" r="46" stroke="var(--chart-neutral)"/>';
    var acc = 0, bounds = [];
    if (total > 0) slices.forEach(function (sl, i) {
      var len = C * (sl.v || 0) / total;
      if (len > 0) { s += '<circle class="seg seg-' + (i + 1) + '" cx="56" cy="56" r="46" stroke="' + sl.color + '" stroke-dasharray="' + r1(len) + " " + C + '" stroke-dashoffset="' + r1(-acc) + '"' + (opts.print ? "" : ' data-tip="' + esc(sl.k + " · " + fmtInt(sl.v) + " · " + fmtPct(sl.v / total * 100)) + '" tabindex="0"') + "/>"; if (sl.v / total >= 0.02) bounds.push(acc / C * 360); }
      acc += len;
    });
    s += "</g>";
    if (bounds.length > 1) s += '<g stroke="#FFFDF8" stroke-width="2" transform="translate(56 56)">' + bounds.map(function (a) { return '<line x1="0" y1="-39" x2="0" y2="-53" transform="rotate(' + r1(a) + ')"/>'; }).join("") + "</g>";
    var top = total > 0 ? slices.reduce(function (a, b) { return (b.v || 0) > (a.v || 0) ? b : a; }, slices[0]) : null;
    s += '<text class="dcenter" x="56" y="55" text-anchor="middle">' + (top ? fmtPct(top.v / total * 100) : "—") + '</text><text class="dcap" x="56" y="69" text-anchor="middle">' + (top ? esc(top.k) : "") + "</text></svg>";
    s += '<div class="dleg">' + slices.map(function (sl) { return '<div class="row"><span class="nm"><i style="background:' + sl.color + '"></i>' + esc(sl.k) + '</span><span class="pv">' + (total ? fmtPct(sl.v / total * 100) : "—") + "<small>" + fmtInt(sl.v) + "</small></span></div>"; }).join("") + "</div></div>";
    return s;
  }
  // 100% 누적 가로막대: rows = [{label, parts:[{k, v, cls}], right(html)}]
  function stackBar100(rows, key) {
    var h = '<div class="stack100">' + rows.map(function (r) {
      var tot = sum(r.parts, "v");
      return '<div class="srow"><span class="sl">' + esc(r.label) + '</span><span class="sb">' + r.parts.map(function (p) { return p.v > 0 ? '<span class="' + p.cls + '" style="width:' + pctW(p.v, tot) + '%" title="' + esc(p.k + " " + fmtInt(p.v)) + '"></span>' : ""; }).join("") + '</span><span class="sr">' + r.right + "</span></div>";
    }).join("");
    if (key) h += '<div class="skey">' + key.map(function (k) { return '<i class="' + k.cls + '" style="background:' + k.color + '"></i>' + esc(k.k); }).join("") + "</div>";
    return h + "</div>";
  }
  function barList(items, total, opts) {
    opts = opts || {};
    if (!items || !items.length) return '<div class="empty" style="padding:8px">—</div>';
    var max = Math.max.apply(null, items.map(function (x) { return x.v; }).concat([1]));
    return '<div class="klist">' + items.map(function (x, i) {
      var neutral = x.neutral || (opts.neutralLast && i === items.length - 1);
      return '<div class="krow"><div class="ktop"><span class="kn">' + esc(x.k) + (x.inapp ? '<span class="badge warn">인앱</span>' : "") + '</span><span class="kv"><b>' + fmtPct(total ? x.v / total * 100 : null) + "</b> · " + fmtInt(x.v) + '</span></div><div class="bar"><span class="' + (opts.cls || "") + '" style="width:' + pctW(x.v, max) + '%' + (neutral ? ";background:var(--chart-neutral)" : "") + '"></span></div></div>';
    }).join("") + "</div>";
  }
  function hourlyChart(hourly, w, h, print) {
    var vals = hourly.map(function (x) { return x.visits; }), maxIdx = vals.indexOf(Math.max.apply(null, vals));
    return colChart(hourly.map(function (x) { return { k: x.hour + "시", v: x.visits }; }), { w: w, h: h || 150, fmt: "int", labelOnly: "max", highlight: maxIdx, highlightColor: "var(--chart-2)", xEvery: 2, label: "시간대별 방문", print: print, empty: "자료 없음" });
  }
  /* 툴팁: data-tip 을 가진 요소 위에서 표시(마우스·포커스). 선 차트는 크로스헤어 함께 */
  function tooltip() {
    var tip = document.createElement("div"); tip.className = "tip"; document.body.appendChild(tip);
    function target(e) { var t = e.target; while (t && t !== document && !(t.getAttribute && t.getAttribute("data-tip"))) t = t.parentNode; return t && t !== document ? t : null; }
    function show(t, x, y) { tip.textContent = t.getAttribute("data-tip"); tip.style.display = "block"; tip.style.left = (x + 14) + "px"; tip.style.top = (y + 14) + "px"; var xh = t.getAttribute("data-xh"), svg = t.ownerSVGElement, line = svg && svg.querySelector(".xh"); if (line) { if (xh) { line.setAttribute("x1", xh); line.setAttribute("x2", xh); line.style.display = ""; } } }
    function hide(e) { tip.style.display = "none"; document.querySelectorAll(".chart .xh").forEach(function (l) { l.style.display = "none"; }); }
    document.addEventListener("mousemove", function (e) { var t = target(e); if (t) show(t, e.pageX, e.pageY); else if (tip.style.display !== "none") hide(); });
    document.addEventListener("focusin", function (e) { var t = target(e); if (t) { var r = t.getBoundingClientRect(); show(t, r.left + window.pageXOffset + r.width / 2, r.top + window.pageYOffset); } });
    document.addEventListener("focusout", hide);
  }
  function osGroups(dv) {
    var g = { iOS: 0, Android: 0, "기타": 0 };
    dv.os.forEach(function (x) { if (x.k === "iOS" || x.k === "iPadOS") g.iOS += x.v; else if (x.k === "Android") g.Android += x.v; else g["기타"] += x.v; });
    return [{ k: "iOS", v: g.iOS, color: "var(--chart-1)" }, { k: "Android", v: g.Android, color: "var(--chart-gold)" }, { k: "기타(PC 등)", v: g["기타"], color: "var(--chart-neutral)" }];
  }
  /* 개요 데이터: 나이대(응답자 기준) · 성별(f/m + 응답 안 함 중립) · 기기(iOS/Android/기타) · 언어 5개 · 브라우저 상위 4 + 기타 */
  function overviewLists(d) {
    var ages = kv(d.ages.filter(function (a) { return a.age !== "skip"; }));
    var g = { f: 0, m: 0, na: 0 }; d.genders.forEach(function (x) { if (x.gender === "f") g.f += x.sessions; else if (x.gender === "m") g.m += x.sessions; else g.na += x.sessions; });
    var genders = [{ k: "여성", v: g.f, color: "var(--chart-1)" }, { k: "남성", v: g.m, color: "var(--chart-gold)" }, { k: "응답 안 함", v: g.na, color: "var(--chart-neutral)" }];
    var langs = sortBy(kv(d.langs), "v", "desc");
    var inapp = {}; d.devices.inapp.forEach(function (x) { inapp[x.k] = 1; });
    var browsers = foldTop(d.devices.browser.map(function (x) { return { k: x.k, v: x.v, inapp: !!inapp[x.k] }; }), 4);
    return { ages: ages, agesTotal: sum(ages, "v"), genders: genders, os: osGroups(d.devices), osTotal: d.devices.total, langs: langs, langsTotal: sum(langs, "v"), browsers: browsers, browsersTotal: d.devices.total };
  }

  /* ───── 개요 ───── */
  function renderOverview(d) {
    var s = d.summary, p = d.prev, L = overviewLists(d), days = fillDays(d.daily, d.range.from, d.range.to);
    var dPct = p.visits > 0 ? (s.visits - p.visits) / p.visits * 100 : null;
    var dPt = (p.visits > 0 && s.finish_rate != null) ? s.finish_rate - (p.finish_rate || 0) : null;
    var html = '<div class="g12">'
      + '<div class="c4">' + kpi("총 방문자", fmtInt(s.visits), { sub: p.visits > 0 ? "지난 " + d.range.days + "일 " + fmtInt(p.visits) + "명 대비" : "비교 기간 자료 없음", delta: { pct: dPct, good: true }, spark: days.map(function (x) { return x.visits; }) }) + "</div>"
      + '<div class="c4">' + kpi("완주율", fmtPct(s.finish_rate), { cls: "hero", meter: { pct: s.finish_rate, cls: "" }, delta: { pct: dPt, good: true, unit: "%p" }, sub: "완주자 " + fmtInt(s.finished) + "명" + (p.visits > 0 ? " · 지난 " + d.range.days + "일 " + fmtPct(p.finish_rate) : "") }) + "</div>"
      + '<div class="c4">' + kpi("오늘 방문자", fmtInt(d.today.visits), { sub: d.today.visits ? "완주 " + fmtInt(d.today.finished) + "명 · " + kst(d.last_event_at, false) + " 기준" : "오늘 수집 없음" }) + "</div>"
      + "</div>";
    html += '<div class="g12">'
      + '<section class="panel c8"><div class="panel-head"><h2>일별 방문·완주</h2><div class="legend"><i class="line" style="background:var(--chart-1)"></i>방문 <i class="line" style="background:var(--chart-gold)"></i>완주</div></div>'
      + chartbox(function (w) { return lineChart([{ name: "방문", key: "visits", color: "var(--chart-1)", area: true }, { name: "완주", key: "finished", color: "var(--chart-gold)" }], days, { w: w, h: 196, label: "일별 방문·완주 추이" }); }, 196) + "</section>"
      + '<section class="panel c4"><div class="panel-head"><h2>나이대</h2><span class="legend">응답자 ' + fmtInt(L.agesTotal) + "명 기준</span></div>"
      + chartbox(function (w) { return colChart(L.ages, { w: w, h: 196, fmt: "pct", total: L.agesTotal, label: "나이대 분포", empty: "응답 없음" }); }, 196) + "</section>"
      + "</div>";
    html += '<div class="g12">'
      + '<section class="panel c3"><div class="panel-head"><h2>성별</h2></div>' + donut(L.genders, { label: "성별 구성" }) + "</section>"
      + '<section class="panel c3"><div class="panel-head"><h2>접속 기기</h2></div>' + donut(L.os, { label: "접속 기기" }) + "</section>"
      + '<section class="panel c3"><div class="panel-head"><h2>언어</h2><span class="legend">전체 ' + fmtInt(L.langsTotal) + "명</span></div>" + barList(L.langs, L.langsTotal) + "</section>"
      + '<section class="panel c3"><div class="panel-head"><h2>브라우저</h2><span class="legend">상위 4 + 기타</span></div>' + barList(L.browsers, L.browsersTotal) + "</section>"
      + "</div>";
    html += renderConcepts(d);
    return html;
  }

  /* ───── 노리개(DM) 편: 컨셉별 좋아한 것(DM 수락률) · 잘한 것(평균 별점) + 결산 유형 + 추천 지역 ───── */
  function conceptBars(cs) {
    if (!cs.some(function (c) { return c.ok + c.skip + c.rated > 0; })) return '<div class="empty">아직 DM 기록 없음</div>';
    return '<table class="t compact"><thead><tr><th>컨셉</th><th>좋아한 것 — DM 수락률</th><th>잘한 것 — 평균 별점</th><th class="n">노리개</th></tr></thead><tbody>' + cs.map(function (c) {
      var sw = c.avg_star == null ? 0 : c.avg_star / 3 * 100;
      return '<tr><td><b>' + esc(c.name) + '</b> <span class="sub">' + esc(c.orn) + "</span></td>"
        + '<td><span class="bar"><span style="width:' + (c.accept_rate || 0) + '%"></span></span><b>' + fmtPct(c.accept_rate) + '</b> <span class="sub">수락 ' + fmtInt(c.ok) + " · 넘김 " + fmtInt(c.skip) + "</span></td>"
        + '<td><span class="bar"><span style="width:' + r1(sw) + '%;background:var(--chart-gold)"></span></span><b>' + (c.avg_star == null ? "—" : "★" + c.avg_star.toFixed(1)) + '</b> <span class="sub">' + fmtInt(c.rated) + "판</span></td>"
        + '<td class="n">' + fmtInt(c.gifts) + "</td></tr>";
    }).join("") + "</tbody></table>";
  }
  function renderConcepts(d) {
    var types = sortBy(d.types.filter(function (t) { return t.sessions > 0; }).map(function (t) { return { k: t.name, v: t.sessions }; }), "v", "desc");
    var tTotal = sum(types, "v");
    var rec = sortBy(d.recommend.map(function (x) { return { k: x.name, v: x.sessions }; }), "v", "desc");
    return '<div class="g12">'
      + '<section class="panel c6"><div class="panel-head"><h2>컨셉별 관심 · 실력</h2><span class="legend">별점 0~3 · 노리개 = 방 끝 선물 수</span></div>' + conceptBars(d.concepts) + "</section>"
      + '<section class="panel c3"><div class="panel-head"><h2>결산 유형</h2><span class="legend">결산 ' + fmtInt(tTotal) + "명</span></div>" + barList(foldTop(types, 6), tTotal) + "</section>"
      + '<section class="panel c3"><div class="panel-head"><h2>추천받은 지역</h2></div>' + barList(rec, tTotal) + "</section>"
      + "</div>";
  }

  /* ───── 놀이별 — 5열 ───── */
  function renderGames(d) {
    var gf = state.gf, rooms = d.catalog.rooms;
    var list = d.games.filter(function (g) { return !gf.room || g.room === gf.room; });
    if (gf.sort !== "default") list = sortBy(list, gf.sort, gf.dir);
    var opt = function (v, label, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(label) + "</option>"; };
    var html = '<section class="panel"><div class="panel-head"><h2>DM 의뢰 놀이 ' + d.games.length + '종</h2><span class="legend">수락률 = 열어 본 DM 중 수락 · 별점 0~3</span></div>';
    html += '<div class="filters"><select id="fRoom"><option value="">모든 지역</option>' + rooms.map(function (r) { return opt(r.id, r.region + " · " + r.name, gf.room); }).join("") + "</select>"
      + '<span class="cnt">' + list.length + "종</span></div>";
    var cols = [["room_name", "지역"], ["name", "놀이"], ["kind_name", "컨셉"], ["accept_rate", "수락률", "n"], ["avg_star", "평균 별점", "n"], ["clear_rate", "성공률", "n"], ["starts", "시도", "n"]];
    html += '<table class="t" id="gamesTable"><thead><tr>' + cols.map(function (c) {
      var sorted = gf.sort === c[0];
      return '<th class="sortable' + (c[2] ? " n" : "") + (sorted ? " sorted" : "") + '" data-sort="' + c[0] + '">' + c[1] + (sorted ? (gf.dir === "asc" ? " ▲" : " ▼") : "") + "</th>";
    }).join("") + "</tr></thead><tbody>";
    list.forEach(function (g) {
      var cr = g.clear_rate, cls = cr == null ? "gray" : cr < 45 ? "bad" : cr >= 92 ? "info" : "good";
      html += '<tr><td class="pname"><span class="pdot p-' + esc(g.room || "") + '"></span>' + esc(g.room_name) + "</td><td><b>" + esc(g.name) + "</b>" + (g.registered ? "" : ' <span class="badge na">미등록 id</span>') + "</td><td>" + '<span class="badge kind-' + esc(g.kind || "common") + '">' + esc(g.kind_name) + "</span>" + '</td><td class="n"><b>' + fmtPct(g.accept_rate) + '</b> <span class="sub">' + fmtInt(g.dm_ok) + "/" + fmtInt(g.dm_ok + g.dm_skip) + '</span></td><td class="n"><b>' + (g.avg_star == null ? "—" : "★" + g.avg_star.toFixed(1)) + '</b></td><td class="n"><span class="bar"><span class="' + cls + '" style="width:' + (cr || 0) + '%"></span></span><b>' + fmtPct(cr) + '</b></td><td class="n sub">' + fmtInt(g.starts) + "</td></tr>";
    });
    html += "</tbody></table>";
    if (!list.length) html += '<div class="empty">—</div>';
    html += "</section>";
    return html;
  }

  /* ───── 자세히 ───── */
  function funnelRows(f, compact) {
    var visits = f.length ? f[0].sessions : 0, maxDrop = 0, wall = -1;
    f.forEach(function (s, i) { if (i > 0 && s.drop > maxDrop) { maxDrop = s.drop; wall = i; } });
    return f.map(function (s, i) {
      return '<div class="frow' + (i === wall ? " wall" : "") + '"><div class="fl">' + esc(s.label) + '</div><div class="fb"><div class="bar"><span class="' + (i === wall ? "bad" : "") + '" style="width:' + pctW(s.sessions, visits) + '%"></span></div></div><div class="fn"><b>' + fmtInt(s.sessions) + "</b> · " + fmtPct(s.pct_of_visits) + (compact ? "" : ' <span class="muted">(직전 ' + fmtPct(s.pct_of_prev) + ")</span>") + "</div></div>";
    }).join("");
  }
  function renderDetail(d) {
    var s = d.summary, dv = d.devices, L = d.logs, OL = overviewLists(d);
    var html = '<div class="detail-tools"><label class="chk"><input type="checkbox" id="chkStaffDetail"' + (state.staff ? " checked" : "") + ' /> 스태프 점검 플레이 포함</label></div>';
    html += '<div class="kpis k6">'
      + kpi("동의율", fmtPct(s.consent_rate), { meter: { pct: s.consent_rate, cls: "" }, sub: "동의 " + fmtInt(s.consent_agreed) + " · 미동의 " + fmtInt(s.consent_declined) })
      + kpi("완주 소요(중앙값)", s.median_total_sec == null ? "—" : fmtSec(s.median_total_sec), { sub: s.p25_total_sec != null ? fmtSec(s.p25_total_sec) + " ~ " + fmtSec(s.p75_total_sec) : "" })
      + kpi("인앱 브라우저", fmtPct(s.inapp_rate), { sub: fmtInt(dv.inapp_total) + "세션 · iOS " + fmtInt(dv.ios_inapp) })
      + kpi("센서 권한 거부", fmtPct(s.denied_rate), { meter: { pct: s.denied_rate, cls: "bad" }, sub: fmtInt(s.denied_sessions) + "세션 · 대체 조작 " + fmtInt(s.fallback_sessions) })
      + kpi("화질 자동 하향", fmtPct(s.qd_rate), { meter: { pct: s.qd_rate, cls: "bad" }, sub: fmtInt(s.qd_sessions) + "세션" })
      + kpi("오류 · WebGL 손실", fmtInt(L.sessions) + "<small>세션</small>", { sub: "오류 " + fmtInt(L.total) + "건 · WebGL " + fmtInt(s.wl_sessions) })
      + "</div>";
    var gifts = sortBy(d.concepts.map(function (c) { return { k: c.orn + " (" + c.name + ")", v: c.gifts }; }), "v", "desc");
    var roles = kv(d.roles).map(function (x, i) { return { k: x.k, v: x.v, color: ["var(--chart-1)", "var(--chart-gold)", "var(--chart-3)", "var(--chart-neutral)"][i] || "var(--chart-neutral)" }; });
    html += '<div class="g12">'
      + '<section class="panel c6"><div class="panel-head"><h2>시간대별 방문</h2><span class="legend">세션 시작 시각 · 최대 칸만 표기</span></div>' + chartbox(function (w) { return hourlyChart(d.hourly, w, 150); }, 150) + "</section>"
      + '<section class="panel c3"><div class="panel-head"><h2>받은 노리개 장식</h2><span class="legend">방 끝 선물</span></div>' + barList(gifts, sum(gifts, "v")) + "</section>"
      + '<section class="panel c3"><div class="panel-head"><h2>성별 (건수)</h2></div>' + donut(OL.genders, { label: "성별" }) + "</section>"
      + "</div>";
    html += '<div class="g12">'
      + '<section class="panel c6"><div class="panel-head"><h2>나이대 (건수)</h2><span class="legend">응답 안 함 ' + fmtInt((d.ages.find(function (a) { return a.age === "skip"; }) || {}).sessions || 0) + "명 제외</span></div>" + chartbox(function (w) { return colChart(OL.ages, { w: w, h: 170, fmt: "int", total: OL.agesTotal, label: "나이대 건수", empty: "응답 없음" }); }, 170) + "</section>"
      + '<section class="panel c6"><div class="panel-head"><h2>완료한 도 개수</h2><span class="legend">8개 = 완주 · 완주 소요 중앙값 <b>' + fmtSec(s.median_total_sec) + "</b></span></div>" + chartbox(function (w) { return colChart(d.rooms_done_dist.map(function (x) { return { k: x.rooms_done + "개", v: x.sessions }; }), { w: w, h: 170, fmt: "int", highlight: 8, highlightColor: "var(--chart-gold)", label: "완료한 도 개수" }); }, 170) + "</section>"
      + "</div>";
    html += '<div class="grid c3">'
      + '<section class="panel"><h2>운영체제</h2>' + barList(OL.os, dv.total) + '<div class="subh">OS 버전</div>' + barList(foldTop(dv.os_ver, 6), dv.total) + "</section>"
      + '<section class="panel"><h2>브라우저</h2>' + barList(OL.browsers, dv.total) + '<div class="subh">인앱 브라우저</div>' + barList(dv.inapp, dv.total, { cls: "warn" }) + "</section>"
      + '<section class="panel"><h2>기기 모델</h2>' + barList(foldTop(dv.device, 6), dv.total) + '<div class="subh">화면 크기(뷰포트 @배율)</div>' + barList(foldTop(dv.res, 5), dv.total) + "</section>"
      + "</div>";
    html += '<div class="grid c2">';
    html += '<section class="panel"><h2>센서 권한</h2>';
    if (!d.sensor_summary.length) html += '<div class="empty">—</div>';
    else html += stackBar100(d.sensor_summary.map(function (x) {
      var tot = x.granted + x.denied + x.unsupported + x.other, name = { motion: "움직임(가속도·회전)", mic: "마이크(박수)", camera: "카메라" }[x.kind] || x.kind;
      return { label: name, parts: [{ k: "허용", v: x.granted, cls: "ok" }, { k: "거부", v: x.denied, cls: "bad" }, { k: "미지원", v: x.unsupported + x.other, cls: "na" }], right: "거부 <b>" + fmtPct(tot ? x.denied / tot * 100 : null) + "</b>" };
    }), [{ k: "허용", cls: "ok", color: "var(--c-ok)" }, { k: "거부", cls: "bad", color: "var(--c-bad)" }, { k: "미지원", cls: "na", color: "var(--c-bg-3)" }]);
    html += '<div class="subh">대체 조작</div>' + barList(d.fallback.map(function (x) { return { k: ({ drag: "끌기", tap: "톡" }[x.kind] || x.kind) + " (" + fmtInt(x.n) + "회)", v: x.sessions }; }), dv.total) + "</section>";
    html += '<section class="panel"><h2>화질 자동 하향 기기</h2>';
    if (!d.quality.down_by_device.length) html += '<div class="empty">—</div>';
    else html += '<table class="t compact"><thead><tr><th>기기</th><th>OS</th><th class="n">하향 세션</th><th class="n">기기 전체</th><th class="n">비율</th></tr></thead><tbody>' + d.quality.down_by_device.map(function (x) {
      return "<tr><td>" + esc(x.device) + "</td><td>" + esc(x.os) + '</td><td class="n">' + fmtInt(x.sessions) + '</td><td class="n">' + fmtInt(x.total) + '</td><td class="n">' + fmtPct(x.total ? x.sessions / x.total * 100 : null) + "</td></tr>";
    }).join("") + "</tbody></table>";
    html += "</section></div>";
    html += '<section class="panel"><h2>관람 퍼널</h2>' + funnelRows(d.funnel) + "</section>";
    html += '<section class="panel"><h2>도(방)별</h2><table class="t"><thead><tr><th>도</th><th>방</th><th class="n">진입</th><th class="n">완료</th><th class="n">완료율</th><th class="n">시도</th><th class="n">성공률</th><th class="n">교체</th><th class="n">소요 중앙값</th></tr></thead><tbody>' + sortBy(d.rooms, "done_rate", "desc").map(function (r) {
      return '<tr><td class="pname"><span class="pdot p-' + esc(r.room) + '"></span><b>' + esc(r.region) + "</b></td><td>" + esc(r.name) + '</td><td class="n">' + fmtInt(r.enters) + '</td><td class="n">' + fmtInt(r.done) + '</td><td class="n"><span class="bar"><span style="width:' + (r.done_rate || 0) + '%"></span></span><b>' + fmtPct(r.done_rate) + '</b></td><td class="n">' + fmtInt(r.plays) + '</td><td class="n">' + fmtPct(r.clear_rate) + '</td><td class="n">' + fmtInt(r.swaps) + '</td><td class="n">' + fmtSec(r.median_sec) + "</td></tr>";
    }).join("") + "</tbody></table></section>";
    html += '<section class="panel"><h2>오류 — ' + fmtInt(L.total) + "건 · " + fmtInt(L.sessions) + "세션</h2>";
    if (!L.grouped.length) html += '<div class="empty">없음</div>';
    else html += '<table class="t compact"><thead><tr><th>메시지</th><th>브라우저</th><th>OS</th><th class="n">건수</th><th class="n">세션</th><th class="n">최근</th></tr></thead><tbody>' + L.grouped.map(function (x) {
      return '<tr><td style="max-width:520px;word-break:break-all">' + esc(x.message) + "</td><td>" + esc(x.browser) + "</td><td>" + esc(x.os) + '</td><td class="n"><b>' + fmtInt(x.n) + '</b></td><td class="n">' + fmtInt(x.sessions) + '</td><td class="n">' + kst(x.last_at) + "</td></tr>";
    }).join("") + "</tbody></table>";
    if (L.recent.length) html += '<div class="subh">최근 오류</div><table class="t compact"><thead><tr><th>시각</th><th>종류</th><th>메시지</th><th>위치</th><th>환경</th></tr></thead><tbody>' + L.recent.slice(0, 40).map(function (x) {
      var env = [x.os ? x.os + " " + (x.os_ver || "") : null, x.browser ? x.browser + " " + (x.browser_ver || "") : null, x.device, x.inapp ? "인앱:" + x.inapp : null].filter(Boolean).join(" · ");
      var loc = (x.source ? x.source.replace(/^https?:\/\/[^/]+/, "") : "") + (x.lineno ? ":" + x.lineno + (x.colno ? ":" + x.colno : "") : "");
      return '<tr><td class="sub">' + kst(x.event_at) + '</td><td><span class="badge na">' + esc(x.level) + '</span></td><td style="max-width:460px;word-break:break-all">' + esc(x.message) + '</td><td class="sub">' + esc(loc) + '</td><td class="sub">' + esc(env) + "</td></tr>";
    }).join("") + "</tbody></table>";
    html += "</section>";
    return html;
  }

  /* ───── 내보내기 / 인쇄 ───── */
  function renderExport(d) {
    var items = [
      ["demo", "방문자 구성", "동의·나이대·성별·언어·컨셉·유형·OS·브라우저"],
      ["daily", "일별 방문", "날짜별 방문·완주·시도"],
      ["games", "놀이별 집계", "DM 의뢰 놀이별 수락·넘김·별점·시도·성공률"],
      ["rooms", "도별 집계", "8개 방 진입·완료·성공률"],
      ["funnel", "관람 퍼널", "단계별 세션"],
      ["sessions", "세션 목록", "세션 1행(무작위 번호·진행·기기)"],
      ["events", "이벤트 원자료", "선택 기간 전체(최대 20만 행)"],
      ["logs", "오류 로그", "메시지·위치·환경"],
    ];
    var html = '<div class="grid c2 no-print"><section class="panel exports"><h2>CSV — ' + esc(d.range.from) + " ~ " + esc(d.range.to) + (d.range.include_staff ? " (스태프 포함)" : "") + "</h2>";
    items.forEach(function (it) { html += '<div class="row"><div><b>' + it[1] + '</b><div class="d">' + it[2] + '</div></div><button class="btn ghost" type="button" data-csv="' + it[0] + '">CSV 받기</button></div>'; });
    html += "</section>";
    html += '<section class="panel"><h2>인쇄 보고서</h2><div class="report-tools"><button class="btn" type="button" id="btnPrint">인쇄 / PDF 저장</button><span class="muted" style="font-size:12.5px">A4 3장</span></div><div class="mini">마지막 수집 ' + kst(d.last_event_at) + " · 저장소 " + (d.db === "pg" ? "Postgres" : "SQLite(검증용)") + "</div></section></div>";
    html += renderReport(d);
    return html;
  }
  function renderReport(d) {
    var s = d.summary, p = d.prev, dv = d.devices, gen = new Date(), L = overviewLists(d), days = fillDays(d.daily, d.range.from, d.range.to), PW = 676;
    var genStr = gen.getFullYear() + "." + ("0" + (gen.getMonth() + 1)).slice(-2) + "." + ("0" + gen.getDate()).slice(-2);
    var period = d.range.from + " ~ " + d.range.to + " (" + d.range.days + "일)";
    var rk = function (l, v, sub, m) { return '<div class="rkpi"><div class="l">' + l + '</div><div class="v">' + v + "</div>" + (m || "") + '<div class="s">' + (sub || "&nbsp;") + "</div></div>"; };
    var foot = function (n) { return '<div class="rfoot"><span>「K의 나라」 운영 통계 보고 · ' + period + "</span><span>" + n + " / 3</span></div>"; };
    var head = function (title) { return '<div class="rhead"><div class="rhead-l"><span class="seal jeok" aria-hidden="true">K</span><div><h1>' + title + '</h1><div class="note">청와대 사랑채 국민화합 체험형 문화 프로그램 「K의 나라」</div></div></div><div class="meta">기간 ' + period + "<br>작성 " + genStr + (d.range.include_staff ? " · 스태프 포함" : "") + "</div></div>"; };
    var tbl = function (list, total) { return '<table class="t"><tbody>' + list.map(function (x) { return "<tr><td>" + esc(x.k) + '</td><td class="n"><b>' + fmtInt(x.v) + '</b></td><td class="n">' + fmtPct(total ? x.v / total * 100 : null) + "</td></tr>"; }).join("") + "</tbody></table>"; };
    var dPct = p.visits > 0 ? Math.round((s.visits - p.visits) / p.visits * 100) : null;

    // 1쪽: KPI 3(미터) + 선+면 + 나이대 컬럼 + 도넛 2 + 언어·브라우저 표
    var html = '<div class="sheet">' + head("운영 통계 보고 — 방문자");
    html += '<div class="rkpis k3">' + rk("총 방문자", fmtInt(s.visits), dPct != null ? (dPct >= 0 ? "▲ " : "▼ ") + Math.abs(dPct) + "% 지난 " + d.range.days + "일 " + fmtInt(p.visits) + "명 대비" : "세션") + rk("완주율", fmtPct(s.finish_rate), "완주자 " + fmtInt(s.finished) + "명", meter(s.finish_rate)) + rk("오늘 방문자", fmtInt(d.today.visits), d.today.day) + "</div>";
    html += "<h2>일별 방문·완주 <span class=\"legend\" style=\"font-size:9pt;font-weight:400\">— 방문 실선·면 / 완주 점선</span></h2>" + lineChart([{ name: "방문", key: "visits", color: "var(--chart-1)", area: true }, { name: "완주", key: "finished", color: "var(--chart-gold)" }], days, { w: PW, h: 170, print: true });
    html += '<div class="cols2"><div><h2>나이대 <span class="note">응답자 ' + fmtInt(L.agesTotal) + "명</span></h2>" + colChart(L.ages, { w: 330, h: 150, fmt: "pct", total: L.agesTotal, print: true }) + '</div><div><h2>성별</h2>' + donut(L.genders, { print: true, size: 96 }) + "</div></div>";
    html += '<div class="cols2"><div><h2>접속 기기</h2>' + donut(L.os, { print: true, size: 96 }) + '</div><div><h2>언어</h2>' + tbl(L.langs, L.langsTotal) + "</div></div>";
    html += foot(1) + "</div>";

    // 2쪽: 기기·동의·노리개·시간대
    html += '<div class="sheet">' + head("접속 기기 · 동의 · 시간대");
    html += '<div class="cols3"><div><h2>운영체제</h2>' + tbl(L.os, dv.total) + '</div><div><h2>브라우저</h2>' + tbl(L.browsers, dv.total) + '</div><div><h2>기기 모델</h2>' + tbl(foldTop(dv.device, 6), dv.total) + "</div></div>";
    html += '<div class="cols2"><div><h2>동의 · 노리개 선물</h2><table class="t"><tbody><tr><td>동의율</td><td class="n"><b>' + fmtPct(s.consent_rate) + '</b></td><td class="n">동의 ' + fmtInt(s.consent_agreed) + " · 미동의 " + fmtInt(s.consent_declined) + "</td></tr>" + d.concepts.map(function (c) { return { k: c.orn + " (" + c.name + ")", v: c.gifts }; }).map(function (x) { return "<tr><td>" + esc(x.k) + '</td><td class="n"><b>' + fmtInt(x.v) + '</b></td><td class="n">' + fmtPct(sum(d.roles, "sessions") ? x.v / sum(d.roles, "sessions") * 100 : null) + "</td></tr>"; }).join("") + '</tbody></table></div><div><h2>환경 지표</h2><table class="t"><tbody><tr><td>모바일 비율</td><td class="n"><b>' + fmtPct(s.mobile_rate) + '</b></td></tr><tr><td>인앱 브라우저</td><td class="n"><b>' + fmtPct(s.inapp_rate) + '</b></td></tr><tr><td>센서 권한 거부</td><td class="n"><b>' + fmtPct(s.denied_rate) + '</b></td></tr><tr><td>화질 자동 하향</td><td class="n"><b>' + fmtPct(s.qd_rate) + '</b></td></tr><tr><td>WebGL 손실 세션</td><td class="n"><b>' + fmtInt(s.wl_sessions) + "</b></td></tr></tbody></table></div></div>";
    html += "<h2>시간대별 방문</h2>" + hourlyChart(d.hourly, PW, 120, true);
    html += foot(2) + "</div>";

    // 3쪽: 놀이별(2단) + 오류 요약
    var order = {}; d.catalog.rooms.forEach(function (r, i) { order[r.id] = i; });
    var gs = d.games.slice().sort(function (a, b) { return (order[a.room] - order[b.room]) || (a.no - b.no); });
    var half = Math.ceil(gs.length / 2);
    var gtbl = function (list) { return '<table class="t tiny"><thead><tr><th>지역</th><th>놀이</th><th class="n">수락률</th><th class="n">별점</th><th class="n">시도</th></tr></thead><tbody>' + list.map(function (g) { return "<tr><td>" + esc(g.room_name) + "</td><td>" + esc(g.name) + '</td><td class="n">' + fmtPct(g.accept_rate) + '</td><td class="n"><b>' + (g.avg_star == null ? "—" : g.avg_star.toFixed(1)) + '</b></td><td class="n">' + fmtInt(g.starts) + "</td></tr>"; }).join("") + "</tbody></table>"; };
    html += '<div class="sheet">' + head("놀이별 · 오류");
    html += "<h2>컨셉별 관심 · 실력</h2>" + conceptBars(d.concepts) + "<h2>DM 의뢰 놀이 — 수락률 · 별점 · 시도</h2>" + '<div class="cols2">' + gtbl(gs.slice(0, half)) + gtbl(gs.slice(half)) + "</div>";
    html += "<h2>오류 요약 — " + fmtInt(d.logs.total) + "건 · " + fmtInt(d.logs.sessions) + "세션</h2>" + (d.logs.grouped.length ? '<table class="t tiny"><thead><tr><th>메시지</th><th>브라우저</th><th class="n">건수</th><th class="n">세션</th></tr></thead><tbody>' + d.logs.grouped.slice(0, 6).map(function (x) { return '<tr><td style="word-break:break-all">' + esc(x.message.slice(0, 70)) + "</td><td>" + esc(x.browser) + " / " + esc(x.os) + '</td><td class="n">' + fmtInt(x.n) + '</td><td class="n">' + fmtInt(x.sessions) + "</td></tr>"; }).join("") + "</tbody></table>" : '<div class="note">기록된 오류 없음</div>');
    html += foot(3) + "</div>";
    return html;
  }

  /* ───── 렌더 디스패치 ───── */
  function render() {
    var d = state.data; if (!d) return;
    writeHash();
    document.querySelectorAll("#tabs button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-v") === state.view); });
    document.querySelectorAll("#period button[data-p]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-p") === state.preset); });
    if (state.preset === "custom") state.customOpen = true;
    $("customRange").hidden = !state.customOpen;
    $("toggleCustom").classList.toggle("active", state.preset === "custom");
    $("fromDate").value = state.from; $("toDate").value = state.to;
    $("rangeLabel").innerHTML = esc(d.range.from) + " ~ " + esc(d.range.to) + "<small>" + d.range.days + "일" + (d.range.include_staff ? " · 스태프 포함" : "") + "</small>";
    $("lastAt").innerHTML = "마지막 수집 <b>" + esc(kst(d.last_event_at)) + "</b>";
    $("dbInfo").textContent = "생성 " + kst(d.generated_at) + " · " + (d.db === "pg" ? "Postgres" : "SQLite(검증용)") + " · 한국 표준시";
    var v = state.view, html;
    CH = {};
    if (v === "games") html = renderGames(d);
    else if (v === "export" || v === "report") html = renderExport(d);
    else if (v === "detail" || v === "devices") { state.view = "detail"; html = renderDetail(d); }
    else { state.view = "overview"; html = renderOverview(d); }
    $("content").innerHTML = html;
    drawCharts();
    bindContent();
    window.scrollTo(0, 0);
    if (state.print && (v === "export" || v === "report")) { state.print = false; setTimeout(function () { window.print(); }, 300); }
  }
  var resizeT; window.addEventListener("resize", function () { clearTimeout(resizeT); resizeT = setTimeout(function () { if (state.data && (state.view === "overview" || state.view === "detail")) render(); }, 200); });

  function bindContent() {
    var c = $("content");
    var fr = $("fRoom");
    if (fr) {
      fr.addEventListener("change", function () { state.gf.room = fr.value; render(); });
      c.querySelectorAll("th[data-sort]").forEach(function (th) {
        th.addEventListener("click", function () {
          var k = th.getAttribute("data-sort");
          if (state.gf.sort === k) state.gf.dir = state.gf.dir === "asc" ? "desc" : "asc";
          else { state.gf.sort = k; state.gf.dir = (k === "name" || k === "room_name" || k === "kind_name") ? "asc" : "desc"; }
          render();
        });
      });
    }
    var cs = $("chkStaffDetail"); if (cs) cs.addEventListener("change", function () { state.staff = cs.checked; load().catch(showErr); });
    c.querySelectorAll("[data-csv]").forEach(function (b) {
      b.addEventListener("click", function () {
        var kind = b.getAttribute("data-csv"); b.disabled = true; b.textContent = "준비 중…";
        api("/api/export", { kind: kind, from: state.from, to: state.to, staff: state.staff ? 1 : 0 }).then(function (r) {
          if (!r.ok) throw new Error("내보내기 실패 (" + r.status + ")");
          var cd = r.headers.get("Content-Disposition") || "", m = cd.match(/filename="([^"]+)"/);
          return r.blob().then(function (blob) { return { blob: blob, name: m ? m[1] : "knara_" + kind + ".csv" }; });
        }).then(function (x) {
          if (navigator.msSaveBlob) return navigator.msSaveBlob(x.blob, x.name);
          var a = document.createElement("a"); a.href = URL.createObjectURL(x.blob); a.download = x.name; document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        }).catch(function (e) { alert(e.message); }).then(function () { b.disabled = false; b.textContent = "CSV 받기"; });
      });
    });
    var bp = $("btnPrint"); if (bp) bp.addEventListener("click", function () { window.print(); });
  }

  /* ───── 상단 컨트롤 ───── */
  document.querySelectorAll("#tabs button").forEach(function (b) { b.addEventListener("click", function () { state.view = b.getAttribute("data-v"); render(); }); });
  document.querySelectorAll("#period button[data-p]").forEach(function (b) { b.addEventListener("click", function () { state.preset = b.getAttribute("data-p"); state.customOpen = false; load().catch(showErr); }); });
  $("toggleCustom").addEventListener("click", function () { state.customOpen = !state.customOpen; $("customRange").hidden = !state.customOpen; });
  $("applyRange").addEventListener("click", function () {
    var f = $("fromDate").value, t = $("toDate").value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return alert("시작일과 종료일을 모두 고르세요.");
    if (f > t) { var x = f; f = t; t = x; }
    state.preset = "custom"; state.from = f; state.to = t; load().catch(showErr);
  });
  $("btnRefresh").addEventListener("click", function () { load().catch(showErr); });
  $("btnLogout").addEventListener("click", function () { setKey(""); showGate(""); });
  window.addEventListener("hashchange", function () { var prev = state.view; readHash(); if (state.data && state.view !== prev) render(); });
  function showErr(e) { if (/키|STATS_KEY/.test(e.message)) return showGate(e.message); $("content").innerHTML = '<div class="notice warn">' + esc(e.message) + "</div>"; }

  tooltip();
  readHash();
  if (!getKey()) showGate("");
  else { $("app").hidden = false; load().catch(function (e) { showGate(e.message); }); }
})();
