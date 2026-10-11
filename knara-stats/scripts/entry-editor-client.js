/* 입장 페이지 편집기 — scripts/entry-editor.js 가 페이지 끝에 주입하는 스크립트. 원본 파일에는 들어가지 않는다.
   페이지가 남긴 data-k 표식(JSON 키)을 보고 글자를 contenteditable 로 열고, 고친 값을 window.__entry.data 에 되돌린 뒤
   저장 때 JSON 전체를 서버로 보낸다. 편집이 켜진 동안은 버튼·칩이 눌리지 않는다(글자만 고치게). */
(function () {
  var E = window.__entry;
  if (!E) { alert("편집기: 페이지 손잡이(window.__entry)가 없습니다"); return; }
  var LIVE = window.__EDITOR_LIVE__ || "";
  var dirty = false;

  var style = document.createElement("style");
  style.setAttribute("data-editor", "1");
  style.textContent = [
    "#ed-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;",
    "  background:#211E1A;color:#F5EFE4;border:1px solid #5a534a;border-radius:10px;padding:8px 10px;white-space:nowrap;",
    '  font:500 12.5px/1.4 "Noto Sans KR",system-ui,sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.34)}',
    "#ed-bar button{font:inherit;border-radius:7px;border:1px solid #6b635a;background:#38332d;color:#F5EFE4;padding:6px 11px;cursor:pointer;margin-right:6px}",
    "#ed-bar button:hover{background:#4a443d}",
    "#ed-bar button.primary{background:#B38C33;border-color:#B38C33;color:#fff;font-weight:700}",
    "#ed-bar button.primary:hover{background:#c99d3d}",
    "#ed-bar button.deploy{background:#2F5FA8;border-color:#2F5FA8;color:#fff;font-weight:700}",
    "#ed-bar button.deploy:hover{background:#3a6fc0}",
    "#ed-bar button.on{background:#2d5a3a;border-color:#2d5a3a;color:#fff}",
    "#ed-msg{min-width:120px;color:#cfc6b8;font-size:11.5px;text-align:right;white-space:normal;max-width:260px}",
    "#ed-msg.ok{color:#8fd4a5}#ed-msg.err{color:#f09a93}",
    "body.ed-on{padding-bottom:70px}",
    "body.ed-on [data-k]{outline:1px dashed transparent;outline-offset:3px;border-radius:2px;transition:outline-color .12s;cursor:text}",
    "body.ed-on [data-k]:hover{outline-color:#B38C33}",
    "body.ed-on [data-k]:focus{outline:2px solid #B38C33;outline-offset:3px;background:rgba(179,140,51,.10)}",
    "body.ed-on .chip[data-k]{opacity:1}",
    "body.ed-on #btnStart[disabled]{opacity:1}",
    "@media print{#ed-bar{display:none!important}}"
  ].join("\n");
  document.head.appendChild(style);

  var bar = document.createElement("div");
  bar.id = "ed-bar";
  bar.setAttribute("data-editor", "1");
  bar.innerHTML =
    '<button id="ed-toggle" class="on" title="편집 켜기/끄기 (꺼지면 버튼·칩이 실제로 눌린다)">편집 켜짐</button>' +
    '<button id="ed-reload" title="파일에서 다시 불러오기 (저장 안 한 수정은 버림)">되돌리기</button>' +
    '<button id="ed-save" class="primary" title="Ctrl+S — entry/index.html 에 저장">저장</button>' +
    '<button id="ed-deploy" class="deploy" title="wrangler deploy — 실제 주소에 반영">배포</button>' +
    '<span id="ed-msg"></span>';
  document.body.appendChild(bar);
  var msg = bar.querySelector("#ed-msg");
  function say(t, cls) { msg.textContent = t; msg.className = cls || ""; }

  /* ── 값 읽기/쓰기 ── */
  function lang() { return E.state.lang; }
  function textOf(el) {
    var c = el.cloneNode(true);
    var gaps = c.querySelectorAll(".gap");
    for (var i = 0; i < gaps.length; i++) gaps[i].parentNode.replaceChild(document.createTextNode(" "), gaps[i]);
    return (c.innerText || c.textContent || "").replace(/\s+/g, " ").trim();
  }
  /* 고친 내용을 "글자 + <br>" 로 정리: Enter 가 만든 <div>·<br> 은 <br> 로, 다른 태그는 벗기고, &amp; 같은 엔티티는 글자로 되돌린다 */
  function htmlOf(el) {
    var h = el.innerHTML.replace(/<div><br><\/div>/gi, "<br>").replace(/<div>/gi, "<br>").replace(/<\/div>/gi, "")
      .replace(/<p>/gi, "<br>").replace(/<\/p>/gi, "").replace(/&nbsp;/g, " ").replace(/<br\s*\/?>/gi, "<br>")
      .replace(/<(?!br>)[^>]+>/g, "");
    var ta = document.createElement("textarea"); ta.innerHTML = h.replace(/<br>/g, "\u0001");
    return ta.value.replace(/\u0001/g, "<br>").replace(/^(\s|<br>)+/, "").replace(/(\s|<br>)+$/, "").replace(/[ 	]+/g, " ");
  }
  function put(key, el) {
    var T = E.data.T[lang()];
    if (key === "title") { T.title = textOf(el); return; }   // 세로 제목은 줄바꿈 없이
    if (key.indexOf("common.") === 0) { E.data.common[key.slice(7)] = htmlOf(el); return; }
    var m = key.match(/^(ages|genders)\.(\d+)$/);
    if (m) { T[m[1]][+m[2]] = htmlOf(el); return; }
    if (key === "collect" || key === "no" || key === "why") {
      var parts = htmlOf(el).split(/\s*·\s*/).filter(function (s) { return s; });
      if (parts.length) T[key] = parts;
      return;
    }
    T[key] = htmlOf(el);
  }

  /* ── 편집 대상 열기/닫기 (render 마다 다시) ── */
  var on = true;
  function mark() {
    var els = document.querySelectorAll("[data-k]");
    for (var i = 0; i < els.length; i++) (function (el) {
      el.setAttribute("contenteditable", on ? "true" : "false");
      el.setAttribute("spellcheck", "false");
      if (el.tagName === "BUTTON") { if (on) { el.__wasDisabled = el.disabled; el.disabled = false; } else if (el.__wasDisabled) el.disabled = true; }
      if (el.__edBound) return;
      el.__edBound = true;
      el.addEventListener("input", function () { dirty = true; put(el.getAttribute("data-k"), el); say("수정됨 · 저장 필요"); });
      el.addEventListener("blur", function () { if (on && dirty) E.render(); });   // 같은 키를 쓰는 다른 자리(선택 사항 등)도 맞춤
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && el.getAttribute("data-k") === "title") { e.preventDefault(); el.blur(); }   // 세로 제목만 줄바꿈 없음(나머지는 Enter = 줄바꿈)
      });
    })(els[i]);
  }
  window.__onEntryRender = mark;

  // 편집 중엔 버튼·칩·링크가 동작하지 않게 (캡처 단계에서 막음). 언어 선택은 그대로 쓴다.
  document.addEventListener("click", function (e) {
    if (!on) return;
    var t = e.target && e.target.closest ? e.target.closest("[data-k], #btnStart, #btnSkip, .chip") : null;
    if (t) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "s") { e.preventDefault(); e.stopImmediatePropagation(); save(); return; }
    if (on && e.target && e.target.isContentEditable && e.key !== "Enter") e.stopImmediatePropagation();
  }, true);

  /* ── 저장 · 배포 · 되돌리기 ── */
  function save() {
    say("저장 중…");
    return fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(E.data) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.ok) { dirty = false; say("저장됨 " + j.time, "ok"); } else say("실패: " + (j.error || "?"), "err"); return j; })
      .catch(function (e) { say("실패: " + e.message, "err"); return { ok: false }; });
  }
  function deploy() {
    var go = function () {
      say("배포 중… (30초쯤)");
      bar.querySelector("#ed-deploy").disabled = true;
      fetch("/api/deploy", { method: "POST" }).then(function (r) { return r.json(); }).then(function (j) {
        bar.querySelector("#ed-deploy").disabled = false;
        if (j.ok) say("배포됨 → " + (j.url || LIVE), "ok"); else say("배포 실패: " + (j.log || "").split("\n").pop(), "err");
      }).catch(function (e) { bar.querySelector("#ed-deploy").disabled = false; say("배포 실패: " + e.message, "err"); });
    };
    if (dirty) save().then(function (j) { if (j.ok) go(); }); else go();
  }
  bar.querySelector("#ed-save").addEventListener("click", save);
  bar.querySelector("#ed-deploy").addEventListener("click", function () { if (confirm("저장하고 실제 주소에 배포할까요?\n" + LIVE)) deploy(); });
  bar.querySelector("#ed-reload").addEventListener("click", function () {
    if (dirty && !confirm("저장하지 않은 수정이 있습니다. 버리고 다시 불러올까요?")) return;
    dirty = false; location.reload();
  });
  bar.querySelector("#ed-toggle").addEventListener("click", function () {
    on = !on;
    document.body.classList.toggle("ed-on", on);
    this.textContent = on ? "편집 켜짐" : "편집 꺼짐";
    this.classList.toggle("on", on);
    mark();
    say(on ? "글자를 클릭해 고치세요" : "미리보기 — 버튼이 실제로 눌립니다");
  });
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  document.body.classList.add("ed-on");
  mark();
  say("글자를 클릭해 고치세요 · 언어는 위 선택 상자로");
})();
