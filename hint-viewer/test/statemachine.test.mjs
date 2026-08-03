// 상태머신 검증 — app.js 진행 순서/분기를 그대로 재현하는지 확인
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const LDC = require('../src/statemachine.js');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } }
const pin = (st, t, state = 'on', opts) => LDC.applyPin(st, t[0], t[1], t[2], state, opts);
const T = LDC.TP;

// 1) 메인 플로우 전체를 순서대로 눌러 20스텝 모두 완료되는지
(function mainFlow() {
  const st = LDC.createState();
  const seq = [
    ['streetmegaPin22', T.p22],
    ['safehousePin23', T.s23],
    ['safehousePin25', T.s25],
    ['safehousePin27', T.s27],
    ['disinfectPin23', T.d23],
    ['streetmegaPin23', T.st23],      // 1차 (선행 조건 없음)
    ['streetmegaPin24', T.st24],
    ['barPin23', T.b23],
    ['barPin26', T.b26],
    ['barPin31', T.b31],
    ['streetmegaPin23_2nd', T.st23],  // 2차 (pin24/bar 선행됨)
    ['disinfectPin34', T.d34],
    ['safehousePin24', T.s24, {timeRemaining: 4000}], // 남은시간≤70분 게이트 → v7
    ['streetmegaPin23_3rd', T.st23],  // 3차 (disinfect34/safe24 선행됨)
    ['safehousePin28', T.s28],
    ['safehousePin30', T.s30],
    ['doctorPin27', T.dr27],
    ['doctorPin24', T.dr24],
    ['doctorPin26', T.dr26],
    ['streetmegaPin26', T.end],
  ];
  seq.forEach(([flag, t, opts]) => { pin(st, t, 'on', opts); ok(st.P[flag] === true, 'main flow expected flag ' + flag); });
  ok(LDC.currentStageIndex(st) === LDC.STEPS.length - 1, 'currentStageIndex at ending');
  ok(st.flags.end === true, 'ending flag set');
  ok(st.flags.mission === true, 'mission flag set');
})();

// 2) street pin23 3회 분기: 선행조건 없으면 1차만, 반복해도 2·3차로 안 넘어가면 안 됨
(function st23Branch() {
  const st = LDC.createState();
  pin(st, T.st23); ok(st.P.streetmegaPin23 && !st.P.streetmegaPin23_2nd, 'st23 1st only');
  pin(st, T.st23); ok(!st.P.streetmegaPin23_2nd, 'st23 2nd blocked without precondition');
  pin(st, T.b23);  // bar23 → 2차 조건 충족
  pin(st, T.st23); ok(st.P.streetmegaPin23_2nd, 'st23 2nd after bar23');
  ok(!st.P.streetmegaPin23_3rd, 'st23 3rd not yet');
  pin(st, T.d34);  // disinfect34 → 3차 조건
  pin(st, T.st23); ok(st.P.streetmegaPin23_3rd, 'st23 3rd after disinfect34');
})();

// 3) safehouse pin24 이중 (라이브 2026-07-07): 남은시간≤4200이면 v7, DM은 barPin31+safe28 필요
(function s24Dual() {
  const a = LDC.createState();
  pin(a, T.s24, 'on', {timeRemaining: 6000}); ok(!a.P.safehousePin24, 's24 ignored when time > 70min');
  pin(a, T.s24, 'on', {timeRemaining: 4200}); ok(a.P.safehousePin24, 's24 → v7 when time <= 70min (pin31 무관)');

  const b = LDC.createState();
  pin(b, T.s28);                 // safehousePin28만
  pin(b, T.s24, 'on', {timeRemaining: 6000});
  ok(b.flags.dm === false, 'DM needs barPin31 too');
  pin(b, T.b31);                 // barPin31 추가
  pin(b, T.s24, 'on', {timeRemaining: 6000});
  ok(b.flags.dm === true, 's24 → DM after barPin31+safe28');
  ok(!b.P.safehousePin24, 's24 did not mark v7 in DM branch (time > 70min)');
})();

// 4) off 이벤트는 진행시키지 않음
(function offNoop() {
  const st = LDC.createState();
  pin(st, T.p22, 'off'); ok(!st.P.streetmegaPin22, 'off does not progress');
})();

// 5) CCTV 퀘스트: 30·31·32 모두여야 cctv
(function cctv() {
  const st = LDC.createState();
  const P32 = ['streetmega','streetmega-2',32], P31 = ['streetmega','streetmega-2',31], P30 = ['streetmega','streetmega-2',30];
  pin(st, P30); pin(st, P31); ok(!st.P.cctv, 'cctv needs 32 too');
  pin(st, P32); ok(st.P.cctv, 'cctv after 30·31·32');
})();

// 6) 단일 퀘스트 핀
(function quests() {
  const st = LDC.createState();
  pin(st, ['streetmega','streetmega-2',42]); ok(st.P.streetmegaPin42, 'roch quest');
  pin(st, ['streetmega','streetmega-2',33]); ok(st.P.streetmegaPin33, 'collector quest');
})();

// 7) onFirstPin 은 최초 마크 1회만
(function firstPin() {
  const st = LDC.createState();
  let n = 0;
  LDC.applyPin(st, T.p22[0], T.p22[1], T.p22[2], 'on', { onFirstPin: () => n++ });
  LDC.applyPin(st, T.s23[0], T.s23[1], T.s23[2], 'on', { onFirstPin: () => n++ });
  ok(n === 1, 'onFirstPin fires exactly once (got ' + n + ')');
})();

console.log('\\n' + (fail === 0 ? '✅ ALL PASS' : '❌ FAIL') + '  pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
