/* 샘플 보고서 편집기 클라이언트 — edit.mjs 가 /report 에 끼워 넣는다. 운영 파일에는 들어가지 않는다. */
(function () {
  var doc = document.querySelector(".doc");
  if (!doc) return;
  var dirty = false, editing = false;

  var css = document.createElement("style");
  css.textContent =
    "#ed-bar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;background:#211E1A;color:#F5EFE4;font:600 13px/1 'Noto Sans KR','Malgun Gothic',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);white-space:nowrap}" +
    "#ed-bar button{border:0;border-radius:999px;padding:9px 14px;background:#F5EFE4;color:#211E1A;font:700 13px/1 inherit;cursor:pointer}" +
    "#ed-bar button.on{background:#DFA42A;color:#211E1A}#ed-bar button:disabled{opacity:.45;cursor:default}" +
    "#ed-msg{max-width:360px;overflow:hidden;text-overflow:ellipsis;opacity:.9}" +
    "#ed-bar a{color:#FFD9A0;text-decoration:underline}" +
    ".ed-on .doc{outline:2px dashed rgba(31,74,140,.55);outline-offset:8px;cursor:text}" +
    ".ed-on .doc img{pointer-events:none;user-select:none}" +
    "@media print{#ed-bar{display:none}}";
  document.head.appendChild(css);

  var bar = document.createElement("div"); bar.id = "ed-bar";
  bar.innerHTML = '<button id="ed-toggle">편집 켜기</button><button id="ed-save" disabled>저장 (Ctrl+S)</button><button id="ed-pdf">PDF 만들기</button><span id="ed-msg">글자를 클릭해 고치세요 · Enter = 줄바꿈</span>';
  document.body.appendChild(bar);
  var $ = function (id) { return document.getElementById(id); };
  function msg(s, html) { if (html) $("ed-msg").innerHTML = s; else $("ed-msg").textContent = s; }

  function setEditing(on) {
    editing = on;
    doc.contentEditable = on ? "true" : "false";
    document.body.classList.toggle("ed-on", on);
    $("ed-toggle").textContent = on ? "편집 끄기(미리보기)" : "편집 켜기";
    $("ed-toggle").classList.toggle("on", on);
    if (on) { try { document.execCommand("defaultParagraphSeparator", false, "br"); } catch (_) {} msg("글자를 클릭해 고치세요 · Enter = 줄바꿈 · Ctrl+S 저장"); }
  }
  $("ed-toggle").addEventListener("click", function () { setEditing(!editing); });

  // Enter = <br> (문단 쪼개지 않음) — 표 셀·설명·제목 어디서나 같은 동작
  doc.addEventListener("keydown", function (e) {
    if (!editing) return;
    if (e.key === "Enter") { e.preventDefault(); document.execCommand("insertLineBreak"); mark(); }   // insertHTML("<br>") 는 블록 끝에서 무시됨 → insertLineBreak
  });
  doc.addEventListener("input", mark);
  doc.addEventListener("paste", function (e) {   // 서식 없는 글자만 붙이기
    if (!editing) return;
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData("text");
    document.execCommand("insertText", false, t); mark();
  });
  function mark() { dirty = true; $("ed-save").disabled = false; msg("저장 안 됨 — Ctrl+S"); }

  function cleanHtml() {
    var c = doc.cloneNode(true);
    c.querySelectorAll("[contenteditable]").forEach(function (el) { el.removeAttribute("contenteditable"); });
    c.querySelectorAll("#ed-bar, script, style").forEach(function (el) { el.remove(); });
    return c.innerHTML;
  }
  function save() {
    if (!dirty) { msg("바뀐 내용이 없습니다"); return; }
    msg("저장 중…");
    fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html: cleanHtml() }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j.ok) { dirty = false; $("ed-save").disabled = true; msg(j.msg + " · PDF 만들기를 누르면 PDF 도 갱신됩니다"); } else msg("실패: " + j.msg); })
      .catch(function (e) { msg("실패: " + e.message); });
  }
  $("ed-save").addEventListener("click", save);
  document.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) { e.preventDefault(); save(); } });

  $("ed-pdf").addEventListener("click", function () {
    if (dirty) { msg("먼저 저장(Ctrl+S)하세요"); return; }
    $("ed-pdf").disabled = true; msg("PDF 만드는 중… (10초쯤)");
    fetch("/api/pdf", { method: "POST" }).then(function (r) { return r.json(); }).then(function (j) {
      $("ed-pdf").disabled = false;
      if (j.ok) msg(j.msg + (j.pages > 1 ? " ⚠️ 한 장을 넘었습니다 — 글을 줄이세요" : "") + ' · <a href="/pdf" target="_blank">PDF 열기</a>', true);
      else msg("실패: " + j.msg);
    }).catch(function (e) { $("ed-pdf").disabled = false; msg("실패: " + e.message); });
  });

  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  setEditing(true);
})();
