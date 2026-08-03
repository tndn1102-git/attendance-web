// 락다운시티 힌트폰 상태머신 (app.js checkPinStatus 이식, DOM/사운드 제외)
// 브라우저(window.LDC)와 node(require) 양쪽에서 동일하게 사용 — 단일 소스.
(function (root) {
  'use strict';

  // slave/arduino/pin 정의 (app.js TARGET_PIN* 과 동일)
  const TP = {
    p22:['streetmega','streetmega-2',22],
    s23:['safehouse','safemega-1',23], s25:['safehouse','safemega-1',25], s27:['safehouse','safemega-1',27],
    d23:['disinfectmega-1','disinfectmega-2',23],
    st23:['streetmega','streetmega-2',23], st24:['streetmega','streetmega-2',24],
    b23:['BAR','barmega-1',23], b26:['BAR','barmega-1',26], b31:['BAR','barmega-1',31],
    d34:['disinfectmega-1','disinfectmega-2',34],
    s24:['safehouse','safemega-1',24], s28:['safehouse','safemega-1',28], s30:['safehouse','safemega-1',30],
    dr27:['doctor','doctormega-1',27], dr24:['doctor','doctormega-1',24], dr26:['doctor','doctormega-1',26],
    end:['streetmega','streetmega-2',26],
  };
  function eq(t, s, a, p) { return t[0] === s && t[1] === a && t[2] === p; }

  // 메인 진행 스텝(표시/제어용). k = 완료판정 플래그
  // b = GM 화면 표시명(핀번호 미노출). s = 내부 참조용(개발/디버깅)
  const STEPS = [
    {k:'streetmegaPin22', t:TP.p22, b:'게임 시작 · 거리 진입', s:'street pin22 · v0'},
    {k:'safehousePin23',  t:TP.s23, b:'안전가옥 ①',   s:'safehouse pin23 · v1'},
    {k:'safehousePin25',  t:TP.s25, b:'안전가옥 ②',   s:'safehouse pin25 · v2'},
    {k:'safehousePin27',  t:TP.s27, b:'안전가옥 ③',   s:'safehouse pin27 · v3'},
    {k:'disinfectPin23',  t:TP.d23, b:'소독실 단서',   s:'disinfect pin23 · v3-2'},
    {k:'streetmegaPin23', t:TP.st23,b:'거리 ① (1차)', s:'street pin23 · v4'},
    {k:'streetmegaPin24', t:TP.st24,b:'거리 ②',   s:'street pin24 · v4-2'},
    {k:'barPin23',        t:TP.b23, b:'엔비바 ①',      s:'BAR pin23 · v4-3'},
    {k:'barPin26',        t:TP.b26, b:'엔비바 ② · 미션 정리', s:'BAR pin26 · 미션 초기화'},
    {k:'barPin31',        t:TP.b31, b:'엔비바 ③',      s:'BAR pin31 · v6'},
    {k:'streetmegaPin23_2nd', t:TP.st23, b:'거리 ③ (2차)', s:'street pin23 · v6-2'},
    {k:'disinfectPin34',  t:TP.d34, b:'소독실 미션',   s:'disinfect pin34 · v6-3'},
    {k:'safehousePin24',  t:TP.s24, b:'안전가옥 ④ (70분 이후)',   s:'safehouse pin24 · v7 (남은시간≤70분)'},
    {k:'streetmegaPin23_3rd', t:TP.st23, b:'거리 ④ (3차)', s:'street pin23 · v9-2'},
    {k:'safehousePin28',  t:TP.s28, b:'안전가옥 ⑤',   s:'safehouse pin28 · v8'},
    {k:'safehousePin30',  t:TP.s30, b:'안전가옥 ⑥ · SNS 종료', s:'safehouse pin30 · v9'},
    {k:'doctorPin27',     t:TP.dr27,b:'박사방 ①',   s:'doctor pin27 · v10'},
    {k:'doctorPin24',     t:TP.dr24,b:'박사방 ②',   s:'doctor pin24 · v10-2'},
    {k:'doctorPin26',     t:TP.dr26,b:'박사방 ③',   s:'doctor pin26 · v11'},
    {k:'streetmegaPin26', t:TP.end, b:'★ 엔딩 · 락다운 해제', s:'street pin26'},
  ];
  const QUESTS = [
    {p:30, k:'cctv', i:'📹', name:'보는 눈이 많아', note:'CCTV 30·31·32'},
    {p:33, k:'streetmegaPin33', i:'🗃️', name:'폐허의 수집가'},
    {p:34, k:'streetmegaPin34', i:'🍀', name:'거짓된 행운'},
    {p:35, k:'streetmegaPin35', i:'⏱️', name:'꼭 마지막에 되더라'},
    {p:36, k:'streetmegaPin36', i:'🤝', name:'새 친구를 사귀어 보자'},
    {p:37, k:'streetmegaPin37', i:'💍', name:'죽음이 우릴 갈라놓을 때까지'},
    {p:38, k:'streetmegaPin38', i:'🪪', name:'너의 이름은'},
    {p:40, k:'streetmegaPin40', i:'👖', name:'주머니 속 진실'},
    {p:42, k:'streetmegaPin42', i:'🏙️', name:'Roch down in city'},
  ];

  function createState() {
    return { P: {}, flags: { mission:false, sns:false, dm:false, end:false }, stamps: {} };
  }

  // st 상태를 변형. opts.now(): 타임스탬프 함수(테스트 주입 가능), opts.onFirstPin: 첫 마크 콜백
  function applyPin(st, slaveID, arduinoID, pinNumber, state, opts) {
    opts = opts || {};
    const now = opts.now || (() => Date.now());
    pinNumber = parseInt(pinNumber);
    const on = state === 'on';
    const P = st.P, flags = st.flags, stamps = st.stamps;
    let firedFirst = false;
    const mark = (k) => {
      if (!P[k]) {
        P[k] = true; stamps[k] = now();
        if (!flags.mission) { flags.mission = true; }
        if (!st._anyMarked) { st._anyMarked = true; firedFirst = true; }
      }
    };

    if (eq(TP.p22, slaveID, arduinoID, pinNumber) && on && !P.streetmegaPin22) mark('streetmegaPin22');
    if (eq(TP.s23, slaveID, arduinoID, pinNumber) && on && !P.safehousePin23) mark('safehousePin23');
    if (eq(TP.s25, slaveID, arduinoID, pinNumber) && on && !P.safehousePin25) mark('safehousePin25');
    if (eq(TP.s27, slaveID, arduinoID, pinNumber) && on && !P.safehousePin27) mark('safehousePin27');
    if (eq(TP.d23, slaveID, arduinoID, pinNumber) && on && !P.disinfectPin23) mark('disinfectPin23');

    // street pin23 — 3단계 분기 (app.js 그대로)
    if (eq(TP.st23, slaveID, arduinoID, pinNumber) && on) {
      if (!P.streetmegaPin23 && !(P.streetmegaPin24||P.barPin23||P.barPin26||P.barPin31||P.disinfectPin34||P.safehousePin24||P.safehousePin28||P.safehousePin30)) {
        mark('streetmegaPin23');
      } else if (!P.streetmegaPin23_2nd && (P.streetmegaPin24||P.barPin23||P.barPin26||P.barPin31)) {
        mark('streetmegaPin23_2nd');
      } else if (!P.streetmegaPin23_3rd && (P.disinfectPin34||P.safehousePin24||P.safehousePin28||P.safehousePin30)) {
        mark('streetmegaPin23_3rd');
      }
    }
    if (eq(TP.st24, slaveID, arduinoID, pinNumber) && on && !P.streetmegaPin24) mark('streetmegaPin24');
    if (eq(TP.b23, slaveID, arduinoID, pinNumber) && on && !P.barPin23) mark('barPin23');
    if (eq(TP.b26, slaveID, arduinoID, pinNumber) && on && !P.barPin26) mark('barPin26');
    if (eq(TP.b31, slaveID, arduinoID, pinNumber) && on && !P.barPin31) mark('barPin31');
    if (eq(TP.d34, slaveID, arduinoID, pinNumber) && on && !P.disinfectPin34) mark('disinfectPin34');

    // safehouse pin24 — v7 진행 또는 DM 활성화 분기 (라이브 app.js 2026-07-07 로직)
    // v7: 남은시간 ≤ 70분(4200초) 타이머 게이트 (pin31 무관). opts.timeRemaining = 현재 남은초(기본 6000=시작전)
    if (eq(TP.s24, slaveID, arduinoID, pinNumber) && on) {
      const tr = (opts.timeRemaining != null) ? opts.timeRemaining : 6000;
      if (!P.safehousePin24 && tr <= 4200) { mark('safehousePin24'); }
      else if (P.barPin31 && P.safehousePin28 && !P.safehousePin24_2nd) { P.safehousePin24_2nd = true; flags.dm = true; stamps['dm'] = now(); }
    }
    if (eq(TP.s28, slaveID, arduinoID, pinNumber) && on && !P.safehousePin28) mark('safehousePin28');
    if (eq(TP.s30, slaveID, arduinoID, pinNumber) && on && !P.safehousePin30) { flags.sns = false; mark('safehousePin30'); }
    if (eq(TP.dr27, slaveID, arduinoID, pinNumber) && on && !P.doctorPin27) mark('doctorPin27');
    if (eq(TP.dr24, slaveID, arduinoID, pinNumber) && on && !P.doctorPin24) mark('doctorPin24');
    if (eq(TP.dr26, slaveID, arduinoID, pinNumber) && on && !P.doctorPin26) mark('doctorPin26');
    if (eq(TP.end, slaveID, arduinoID, pinNumber) && on && !P.streetmegaPin26) { mark('streetmegaPin26'); flags.end = true; stamps['end'] = now(); }

    // 퀘스트 (streetmega-2 pin >= 28)
    if (slaveID === 'streetmega' && arduinoID === 'streetmega-2' && pinNumber >= 28 && on) {
      if ([28,29,30,31,32].indexOf(pinNumber) >= 0) {
        P['streetmegaPin' + pinNumber] = true;
        if (P.streetmegaPin30 && P.streetmegaPin31 && P.streetmegaPin32 && !P.cctv) { P.cctv = true; stamps['cctv'] = now(); }
      } else if ([33,34,35,36,37,38,40,42].indexOf(pinNumber) >= 0) {
        const k = 'streetmegaPin' + pinNumber;
        if (!P[k]) { P[k] = true; stamps[k] = now(); }
      }
    }

    if (firedFirst && typeof opts.onFirstPin === 'function') opts.onFirstPin();
    return st;
  }

  function currentStageIndex(st) {
    let idx = -1; for (let i = 0; i < STEPS.length; i++) if (st.P[STEPS[i].k]) idx = i; return idx;
  }

  const api = { TP, STEPS, QUESTS, eq, createState, applyPin, currentStageIndex };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LDC = api;
})(typeof self !== 'undefined' ? self : this);
