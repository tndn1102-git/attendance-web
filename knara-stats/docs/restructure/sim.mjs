// K의 나라 선택형 개편 — 엔딩 판정 로직 + 분포 시뮬레이션 (01_구조설계.md 의 참조 구현)
// 실행: node sim.mjs                 (기본 10만 회 × 4모델 + 도달 가능성 검사)
//       node sim.mjs 200000          (회수 지정)
//       LEGEND_SUBS=40000 ALLROUND=0.3 LOCAL_MIN=10 node sim.mjs   (문턱 보정)
// judge() 는 순수 함수라 게임 코드(브라우저 ES5 로 옮길 때 화살표 함수만 풀면 됨)에 그대로 이식한다.

const N = Number(process.argv[2] || 100000);

// ───────── 0. 시드 난수 (재현용) ─────────
let seed = 20261018;
function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const ri = (n) => Math.floor(rand() * n);
const pick = (a) => a[ri(a.length)];
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = ri(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ───────── 1. 축 ─────────
// 컨셉 6축(원청 고정): B 뷰티 · M 먹방 · F 음식 · S 관광 · T 여행 · H 전통
const C = ['B', 'M', 'F', 'S', 'T', 'H'];
const NAME = { B: '뷰티', M: '먹방', F: '음식', S: '관광', T: '여행', H: '전통' };
// 추가 축 3개: style(−연출 ↔ +날것) · pace(−느긋 ↔ +꽉 찬 일정) · local(지역 몰입, 도별 누적)

// ───────── 2. 8도와 장면 형식 ─────────
const DO = ['jeonnam', 'gyeongbuk', 'chungcheong', 'sudo', 'jeju', 'jeonbuk', 'gangwon', 'gyeongnam'];
const S2_MULTI = new Set(['jeonnam', 'sudo', 'jeonbuk', 'gyeongnam']);    // S2 음식 = 사진카드 다중(1~3)
const S4_TEXT = new Set(['jeonnam', 'chungcheong', 'jeju', 'gyeongnam']); // S4 촬영방식 = 텍스트 택1 (나머지 4도 = 슬라이더)

// 장면 슬롯 템플릿 [1차 컨셉, 2차 컨셉|null]
//  규칙 ① 1차 컨셉은 도마다 각 2회, 서로 다른 두 장면에 1회씩 (같은 장면 두 칸 금지)
//       ② 촬영 장면(S3)에 빠지는 컨셉 짝을 도마다 돌린다 (레이아웃 A/B/C)
//       ③ 2차 컨셉(+절반)은 도마다 각 컨셉 1회씩
const LAYOUT = {
  // S1 도착 — 어디부터?   S2 뭐 먹지?   S3 오늘 찍을 한 장면
  A: { s1: [['T', 'S'], ['B', 'H'], ['H', null], ['S', null]], s2: [['B', 'M'], ['H', 'F'], ['M', null], ['F', null]], s3: [['M', null], ['F', 'B'], ['S', 'T'], ['T', null]] }, // S3 = 먹방·음식·관광·여행
  B: { s1: [['S', 'T'], ['T', null], ['B', 'M'], ['H', null]], s2: [['S', null], ['T', 'H'], ['M', 'F'], ['F', null]], s3: [['B', null], ['H', 'B'], ['M', 'S'], ['F', null]] }, // S3 = 뷰티·전통·먹방·음식
  C: { s1: [['M', 'F'], ['F', null], ['S', 'T'], ['T', null]], s2: [['M', 'H'], ['F', null], ['B', 'M'], ['H', null]], s3: [['S', null], ['T', 'S'], ['B', null], ['H', 'B']] }, // S3 = 관광·여행·뷰티·전통
};
const DO_LAYOUT = ['A', 'B', 'C', 'A', 'B', 'C', 'A', 'B'];

const S4_TEXT_OPTS = [ // 어떻게 찍을까 (텍스트 택1) — 4사분면 1개씩 + '안 찍기'. style·pace 합 = 0
  { id: 'cinema', style: -2, pace: -1 },               // 시네마틱 — 삼각대 세우고 공들여
  { id: 'shorts', style: -1, pace: +1 },               // 숏폼 편집 — 컷컷컷, 다음 장소로
  { id: 'live', style: +2, pace: +1 },                 // 라이브 — 지금 이대로 켠다
  { id: 'vlog', style: +1, pace: -1 },                 // 브이로그 — 손에 들고 걸으며 수다
  { id: 'unplug', style: 0, pace: 0, local: 1, unplug: true }, // (작은 글씨) 오늘은 안 찍고 그냥 즐기기 → 미니게임 생략
];

const rot = (arr, k) => arr.map((_, i) => arr[(i + k) % arr.length]);

function buildDo(i) {
  const d = DO[i], L = LAYOUT[DO_LAYOUT[i]];
  const pace1 = rot([+1, -1, +1, -1], i % 2);              // S1 장소: '찍고 다음' +1 / '눌러앉기' −1, 도마다 뒤집음
  const mk = (tpl, scene) => tpl.map(([c, c2], j) => ({
    c, c2, pace: scene === 1 ? pace1[j] : 0, local: (i + scene) % 4 === j ? 1 : 0, // 장면마다 현지인 추천 카드 1장, 위치 순환
  }));
  return { d, i, s1: mk(L.s1, 1), s2: mk(L.s2, 2), s3: mk(L.s3, 3), multi: S2_MULTI.has(d), text: S4_TEXT.has(d) };
}
const DOS = DO.map((_, i) => buildDo(i));

// ───────── 3. 엔딩 목록 ─────────
const QUAD = { PF: '방송국형', PS: '다큐형', RF: '라이브형', RS: '브이로그형' }; // P연출/R날것 × F꽉참/S느긋
const MAIN = [];
for (const c of C) for (const q of Object.keys(QUAD)) MAIN.push(`${c}-${q}`);
const HIDDEN = [...DO.map((d) => `LOCAL-${d}`), 'LEGEND', 'UNPLUG', 'ALLROUND'];

const LOCAL_MIN = Number(process.env.LOCAL_MIN || 10);        // 8도 기준 현지인 카드 누적 문턱
const LEGEND_SUBS = Number(process.env.LEGEND_SUBS || 41000); // 8도 기준 구독자 문턱
const ALLROUND_SPREAD = Number(process.env.ALLROUND || 0.3);  // (최대−최소)/최대 ≤ 이 값

// ───────── 4. 판정 (게임에 이식할 부분) ─────────
// answers[i] = { s1: idx, s2: [idx...], s3: idx, s4: {text: idx} | {slider: 0..4}, star: 0..3 }
// visited = 들른 도 인덱스 배열 (들른 순서)
function judge(answers, visited) {
  const score = Object.fromEntries(C.map((c) => [c, 0]));
  const skill = Object.fromEntries(C.map((c) => [c, 0]));
  const played = {}, depth = {}, full = {};
  let style = 0, pace = 0, lastStyle = 0, lastPace = 0, unplug = 0, subs = 0, localTotal = 0;

  for (const i of visited) {
    const D = DOS[i], a = answers[i];
    let dep = 0, dPace = 0, dStyle = 0, unp = false;
    const add = (card, w) => { score[card.c] += w; if (card.c2) score[card.c2] += w / 2; dep += card.local; };

    const c1 = D.s1[a.s1]; add(c1, 2); dPace += c1.pace;                 // S1 장소
    const k = a.s2.length; for (const j of a.s2) add(D.s2[j], 2 / k);    // S2 음식 (다중은 합 2로 정규화)
    if (D.multi) dPace += k === 1 ? -1 : k === 3 ? +1 : 0;               //   → 많이 고르면 '꽉 찬 일정'
    const c3 = D.s3[a.s3]; add(c3, 2);                                   // S3 촬영 대상
    if (D.text) {                                                        // S4 촬영 방식
      const o = S4_TEXT_OPTS[a.s4.text]; dStyle = o.style; dPace += o.pace;
      if (o.local) dep += 1; if (o.unplug) { unp = true; unplug++; }
    } else dStyle = a.s4.slider - 2;                                     //   슬라이더 0~4 → −2~+2
    style += dStyle; pace += dPace;
    if (dStyle) lastStyle = dStyle; if (dPace) lastPace = dPace;

    if (!unp) {                                                          // 촬영 미니게임(B안) ★0~3
      skill[c3.c] += a.star; played[c3.c] = (played[c3.c] || 0) + 1;
      const algo = argmax(score) === c3.c ? 1.6 : 1.0;                   // 채널 색깔과 맞는 촬영 = 알고리즘 가산
      subs += Math.round((300 + 900 * a.star) * algo * (1 + 0.15 * visited.indexOf(i)));
    }
    depth[DO[i]] = dep; localTotal += dep;
    full[DO[i]] = !!(c1.local && k <= 2 && a.s2.some((j) => D.s2[j].local) && c3.local); // 그 도에서 현지인 카드만 따라감(다중 3개 = 다 먹어보기라 몰입 아님)
  }
  // 실력 반영: 그 컨셉 촬영 평균 ★ × 0.6 (합이 아니라 평균 → 촬영 기회 수 차이에 덜 민감)
  for (const c of C) if (played[c]) score[c] += 0.6 * (skill[c] / played[c]);

  const top = argmax(score, skill);
  const vals = C.map((c) => score[c]);
  const spread = (Math.max(...vals) - Math.min(...vals)) / (Math.max(...vals) || 1);
  const sSign = style !== 0 ? Math.sign(style) : (lastStyle ? Math.sign(lastStyle) : 1);
  const pSign = pace !== 0 ? Math.sign(pace) : (lastPace ? Math.sign(lastPace) : 1);
  const quad = (sSign < 0 ? 'P' : 'R') + (pSign > 0 ? 'F' : 'S');
  const nDo = visited.length;
  const st = { score, skill, top, quad, style, pace, unplug, subs, depth, localTotal, spread, nDo };

  // 우선순위: ① 따뜻한 실패 → ② 지역 몰입(8) → ③ 레전드 → ④ 팔도 만능 → ⑤ 정규 24
  if (nDo <= 2) return { ending: 'PILOT', st };                       // ⓪ 2도 이하에서 결산 = '1화 업로드 완료'
  const textVisited = visited.filter((i) => DOS[i].text).length;
  if (textVisited >= 3 && unplug >= 3) return { ending: 'UNPLUG', st };
  const fulls = visited.filter((i) => full[DO[i]]);
  if (fulls.length && localTotal >= LOCAL_MIN * nDo / 8) {
    const r = fulls.sort((x, y) => depth[DO[y]] - depth[DO[x]] || visited.indexOf(y) - visited.indexOf(x))[0];
    return { ending: `LOCAL-${DO[r]}`, st };
  }
  if (nDo >= 6 && subs >= LEGEND_SUBS * nDo / 8) return { ending: 'LEGEND', st };
  if (nDo >= 6 && spread <= ALLROUND_SPREAD) return { ending: 'ALLROUND', st };
  return { ending: `${top}-${quad}`, st };
}

function argmax(score, skill) {
  let best = null;
  for (const c of C) if (best === null || score[c] > score[best] || (score[c] === score[best] && skill && skill[c] > skill[best])) best = c;
  return best;
}

// ───────── 5. 응답 모델 ─────────
function starOf(s) { let st = 0; const p = 0.25 + 0.6 * s; for (let t = 0; t < 3; t++) if (rand() < p) st++; return st; }

// (가) 완전 무작위: 모든 선택지 균등, 다중 1~3개 균등, 슬라이더 0~4 균등, 실력 s~U(0,1)
function randomPlayer(visited) {
  const s = rand(), ans = {};
  for (const i of visited) {
    const k = 1 + ri(3);
    ans[i] = { s1: ri(4), s2: DOS[i].multi ? shuffle([0, 1, 2, 3]).slice(0, k) : [ri(4)], s3: ri(4), s4: DOS[i].text ? { text: ri(S4_TEXT_OPTS.length) } : { slider: ri(5) }, star: starOf(s) };
  }
  return ans;
}
// (나) 취향 있는 관람객: 좋아하는 컨셉 1개(있으면 60% 그 카드), 스타일·페이스 성향 고정, 15%는 현지인 카드 선호(70%)
function personaPlayer(visited) {
  const fav = pick(C), s = rand(), sPref = rand() < 0.5 ? -1 : 1, pPref = rand() < 0.5 ? -1 : 1, loc = rand() < 0.15;
  const choose = (cards) => {
    if (loc && rand() < 0.7) return cards.findIndex((c) => c.local);
    const f = cards.map((c, j) => [c, j]).filter(([c]) => c.c === fav);
    if (f.length && rand() < 0.6) return pick(f)[1];
    return ri(cards.length);
  };
  const ans = {};
  for (const i of visited) {
    const D = DOS[i];
    let s2;
    if (D.multi) { const k = pPref > 0 ? 2 + ri(2) : 1 + ri(2); const first = choose(D.s2); s2 = [first, ...shuffle([0, 1, 2, 3].filter((x) => x !== first))].slice(0, k); }
    else s2 = [choose(D.s2)];
    let s4;
    if (D.text) {
      const r = rand();
      s4 = { text: r < 0.08 ? 4 : r < 0.25 ? ri(4) : sPref < 0 ? (pPref > 0 ? 1 : 0) : (pPref > 0 ? 2 : 3) };
    } else s4 = { slider: Math.max(0, Math.min(4, 2 + sPref * (1 + ri(2)) + (rand() < 0.2 ? -sPref * 2 : 0))) };
    ans[i] = { s1: choose(D.s1), s2, s3: choose(D.s3), s4, star: starOf(s) };
  }
  return ans;
}

// ───────── 6. 실행 ─────────
const ALL8 = [0, 1, 2, 3, 4, 5, 6, 7];
const ALLE = [...MAIN, ...HIDDEN];
function run(label, model, visitFn) {
  const cnt = Object.fromEntries(ALLE.map((e) => [e, 0]));
  const topCnt = Object.fromEntries(C.map((c) => [c, 0]));
  let subsSum = 0; const subsArr = [], spArr = [];
  for (let n = 0; n < N; n++) {
    const visited = visitFn();
    const { ending, st } = judge(model(visited), visited);
    cnt[ending]++; topCnt[st.top]++; subsSum += st.subs; subsArr.push(st.subs); spArr.push(st.spread);
  }
  const pct = (x) => 100 * x / N;
  const mainShare = MAIN.reduce((s, e) => s + cnt[e], 0);
  const mainP = MAIN.map((e) => pct(cnt[e])), allP = ALLE.map((e) => pct(cnt[e]));
  const mean = 100 / ALLE.length, meanMain = pct(mainShare) / MAIN.length;
  subsArr.sort((a, b) => a - b); spArr.sort((a, b) => a - b);
  const q = (arr, p) => arr[Math.floor(p * (arr.length - 1))];
  console.log(`\n### ${label}  (N=${N.toLocaleString()})`);
  console.log(`- 정규 24 합계 **${pct(mainShare).toFixed(1)}%** · 정규 최대 ${Math.max(...mainP).toFixed(2)}% / 최소 ${Math.min(...mainP).toFixed(2)}% · 정규 평균 ${meanMain.toFixed(2)}% → **최대/평균 ${(Math.max(...mainP) / meanMain).toFixed(2)}배**`);
  console.log(`- 전체 35 기준: 평균 ${mean.toFixed(2)}% · 최대/평균 ${(Math.max(...allP) / mean).toFixed(2)}배 · **0% 엔딩 ${allP.filter((p) => p === 0).length}개** · 평균 구독자 ${Math.round(subsSum / N).toLocaleString()}명`);
  console.log(`- (보정용) 구독자 p50 ${q(subsArr, .5)} · p98 ${q(subsArr, .98)} / 컨셉 편차 p2 ${q(spArr, .02).toFixed(3)}`);
  console.log('\n| 주 컨셉 | 방송국형(연출·꽉) | 다큐형(연출·느긋) | 라이브형(날것·꽉) | 브이로그형(날것·느긋) | 1위 컨셉 비율 |');
  console.log('|---|---|---|---|---|---|');
  for (const c of C) console.log(`| ${NAME[c]} | ${['PF', 'PS', 'RF', 'RS'].map((qq) => pct(cnt[`${c}-${qq}`]).toFixed(2) + '%').join(' | ')} | ${pct(topCnt[c]).toFixed(1)}% |`);
  console.log('\n| 숨은·희귀 | ' + HIDDEN.map((e) => e.replace('LOCAL-', '지역:')).join(' | ') + ' |');
  console.log('|---|' + HIDDEN.map(() => '---').join('|') + '|');
  console.log('| 비율 | ' + HIDDEN.map((e) => pct(cnt[e]).toFixed(2) + '%').join(' | ') + ' |');
  return cnt;
}

run('모델 가 — 완전 무작위 응답 · 8도 완주(방문 순서 무작위)', randomPlayer, () => shuffle(ALL8));
run('모델 나 — 취향 있는 관람객 · 8도 완주(방문 순서 무작위)', personaPlayer, () => shuffle(ALL8));
run('모델 다 — 완전 무작위 · 강원 미개방(11/11 전, 7도)', randomPlayer, () => shuffle([0, 1, 2, 3, 4, 5, 7]));
run('모델 라 — 완전 무작위 · 중도 종료(무작위 4도)', randomPlayer, () => shuffle(ALL8).slice(0, 4));

// ───────── 7. 도달 가능성: 노리고 고르면 나오는가 (무작위·취향 응답 혼합 탐색) ─────────
const found = new Set();
for (let t = 0; t < 200000 && found.size < ALLE.length; t++) {
  const a = rand() < 0.5 ? personaPlayer(ALL8) : randomPlayer(ALL8);
  found.add(judge(a, ALL8).ending);
}
const unreachable = ALLE.filter((e) => !found.has(e));
console.log(`\n도달 불가 엔딩(8도 완주 기준): ${unreachable.length ? unreachable.join(', ') : '없음'}`);

export { judge, DOS, C, MAIN, HIDDEN };

// ───────── 8. 같은 날 다른 문서 안(04·03)을 같은 무작위 응답으로 점검 ─────────
// 04안: 도마다 먹을 것 2장(M/F) 택1 +2, 갈 곳 4장(B/S/T/H) 택1 +2, 메인 2택1 +2 → 1위 컨셉 분포
{
  const cnt = Object.fromEntries(C.map((c) => [c, 0]));
  for (let n = 0; n < N; n++) {
    const sc = Object.fromEntries(C.map((c) => [c, 0]));
    for (let d = 0; d < 8; d++) {
      const f = pick(['M', 'F']), p = pick(['B', 'S', 'T', 'H']);
      sc[f] += 2; sc[p] += 2; sc[rand() < 0.5 ? f : p] += 2;
    }
    const mx = Math.max(...C.map((c) => sc[c])); const tops = C.filter((c) => sc[c] === mx);
    cnt[pick(tops)]++;
  }
  console.log('\n### 비교 — 04안 카드 배치(먹을 것 2장 + 갈 곳 4장)의 1위 컨셉 분포 (무작위, 동점은 무작위)');
  console.log('| ' + C.map((c) => NAME[c]).join(' | ') + ' |'); console.log('|' + C.map(() => '---').join('|') + '|');
  console.log('| ' + C.map((c) => (100 * cnt[c] / N).toFixed(1) + '%').join(' | ') + ' |');
}
// 03안: 화제/진심 카드 4장 · 혼자/함께 카드 4장, "진심 ≥ 화제", "혼자 ≥ 함께" 규칙 → 대분류 A~D 분포
{
  const g = { A: 0, B: 0, C: 0, D: 0 };
  for (let n = 0; n < N; n++) {
    let jin = 0, hon = 0; for (let t = 0; t < 4; t++) { if (rand() < 0.5) jin++; if (rand() < 0.5) hon++; }
    const sincere = jin >= 2, solo = hon >= 2;
    g[!sincere && solo ? 'A' : !sincere ? 'B' : solo ? 'C' : 'D']++;
  }
  console.log('\n### 비교 — 03안 사분면(이진 카드 4장씩, 동점=진심·혼자 쪽) 대분류 분포 (무작위)');
  console.log('| A 큰 무대 | B 축제판 | C 기록 | D 사랑방 |'); console.log('|---|---|---|---|');
  console.log('| ' + ['A', 'B', 'C', 'D'].map((k) => (100 * g[k] / N).toFixed(1) + '%').join(' | ') + ' |');
}
