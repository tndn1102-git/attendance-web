// 설정집 펼침면 조판: raw/<key>.png + 문안 → out/<key>.png (2400×2100)
// 사용: node compose.cjs [키...]
const { chromium } = require('D:/test2/rpa/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SPREADS = require('./spreads.cjs');
const RAW = path.resolve(__dirname, '../raw'), OUT = path.resolve(__dirname, '../out');
fs.mkdirSync(OUT, { recursive: true });
const W = 2400, H = 2100, IH = 1350;

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function rich(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/「(.+?)」/g, '<q>「$1」</q>');
}
function paras(t) { return t.split(/\n\s*\n/).map(p => '<p>' + rich(p).replace(/\n/g, '<br>') + '</p>').join(''); }
const img = k => { const f = path.join(RAW, k + '.png'); return fs.existsSync(f) ? 'data:image/png;base64,' + fs.readFileSync(f).toString('base64') : ''; };

// ── 그림 위에 얹는 문서들 ──
const DOCS = {
  forum: `<div class="doc forum" style="right:70px;top:70px;width:1000px">
    <div class="fh">▣ UNDERGROUND BOARD — 태초의 신부</div>
    ${[
      ['태초의 신부라는 보석 들어본 사람?', '스네이크라는 사람한테 연락 왔는데 보수가 짭짤하더라. 테스트해 본다더니 연락이 없네.', ['너도? 아 나도']],
      ['요즘 핫한 태초의 신부', '같이 털러 가실 분 모집 (1/4)', ['내가 듣기론 주먹만 한 붉은 보석이라던데?']],
      ['태초의 신부 그거 다 거짓말인 거 아시죠?', '미끼에 넘어가지 마세요. 절대 나 혼자 먹으려는 거 아님.', ['이러고 혼자 불 켜고 찾는 중', 'Re: 들킴ㅋ']],
      ['태초의 신부 조심하세요', '스네이크라는 이름 나오면 그냥 끄세요.', []],
    ].map((p, i) => `<div class="post"><div class="pt">${i + 1}. ${esc(p[0])}</div><div class="pb">${esc(p[1])}</div>${p[2].map(r => `<div class="re">→ Re: ${esc(r)}</div>`).join('')}</div>`).join('')}
  </div>`,
  invite: `<div class="doc invite" style="left:50%;top:330px;transform:translateX(-50%);width:880px">
    <div class="ih"><span class="dot"></span> NEW MESSAGE — SENDER UNKNOWN</div>
    <div class="ib">테스트는 끝났다.<br>당신들이 합격이다.<br><br>오늘 밤, <b>BAR The LUST</b> · VIP ROOM.</div>
    <div class="is">— S</div></div>`,
  brief: `<div class="doc brief" style="left:80px;top:80px;width:760px">
    <div class="bh">OPERATION FILE</div>
    <table><tr><th>목표</th><td>지하 13층 · 선악과</td></tr><tr><th>장소</th><td>도시 EDEN · 에덴 거리</td></tr>
    <tr><th>D-Day</th><td>폭우 대피령이 내려진 밤</td></tr><tr><th>작전명</th><td><b>EVE</b></td></tr></table></div>`,
  sins: `<div class="doc brief sins" style="right:80px;top:80px;width:720px">
    <div class="bh">일곱 자물쇠</div>
    <table>${[['BAR The LUST', '색욕'], ['CODICIA', '탐욕'], ['Salon de Envie', '질투'], ['GLUTTONY', '탐식'], ['CAFE SLOTH', '나태'], ['STOLZ', '교만'], ['NEWS STAND', '분노']]
      .map(r => `<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join('')}</table></div>`,
  letter: `<div class="doc letter" style="left:55px;top:45px;width:1080px">
    <div class="lt">To. 이브 프로젝트</div>
    <p>약 한 달 간 '아담'의 눈을 피하시느라 고생하셨습니다.</p>
    <p>르포를 보니 역시나 '아담'은 '태초의 신부'를 도난당한 사실을 공표하지 않았더군요. 그들도 비즈니스적으로 곤란할 테니까요. 앞으로 '아담'이 공식적으로 여러분을 찾는 일은 없을 것입니다.</p>
    <p>문제가 있다면 '태초의 신부'는 제가 찾던 물건이 아니라는 점이었습니다. 하지만 선악과를 통해 신체를 강화할 수 있다는 사실을 알아냈습니다. 덕분에 앞으로 '아담'을 상대하는 데 큰 도움이 될 것 같습니다.</p>
    <p>간소하지만 이에 보답하는 의미로 여러분이 전달해 주신 선악과를 정제한 알약을 만들어 두었습니다. 드셔도 좋고 큰돈을 받고 파셔도 좋습니다.</p>
    <p class="ps">PS. 앞으로 있을 '아담'과의 싸움으로 더 큰 보상을 원하신다면 제가 드리는 이 카드를 갖고 계시기 바랍니다. 준비가 되는 대로 다시 연락을 드리도록 하겠습니다.</p>
    <div class="lf">From. 스네이크</div></div>`,
  radio: `<div class="doc radio" style="right:70px;top:70px;width:760px">
    <div class="rh">● REC — CH.07</div>
    ${['지금이다. 하나씩 열어.', '…전력이 나갔다. 움직이지 마.', '복구됐다. 계속해.', '일곱 번째. 확인. 올라온다.'].map(l => `<div class="rl"><i>[S]</i> ${l}</div>`).join('')}</div>`,
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Noto+Sans+KR:wght@400;500;700;900&family=JetBrains+Mono:wght@500;700&family=Black+Han+Sans&family=Playfair+Display:ital,wght@0,600;0,800;1,600&family=Cinzel:wght@600;800&family=Pacifico&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W}px;height:${H}px;overflow:hidden;background:#1a1410}
.sp{position:relative;width:${W}px;height:${H}px;overflow:hidden}
.art{position:absolute;left:0;top:0;width:${W}px;height:${IH}px;overflow:hidden;background:#111}
.art img{width:100%;height:100%;object-fit:cover;display:block}
.art::after{content:'';position:absolute;inset:0;box-shadow:inset 0 0 0 10px #15100c, inset 0 -60px 80px -40px rgba(0,0,0,.45)}
.band{position:absolute;left:0;top:${IH}px;width:${W}px;height:${H - IH}px;
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,.35), transparent 60%),
    repeating-linear-gradient(0deg, rgba(120,90,50,.035) 0 2px, transparent 2px 5px),
    #efe2c4;
  border-top:10px solid #15100c}
.band::before{content:'';position:absolute;inset:0;background:radial-gradient(140% 120% at 50% 50%,transparent 60%,rgba(110,75,30,.28))}
.gut{position:absolute;left:${W / 2 - 1}px;top:${IH}px;width:2px;height:${H - IH}px;background:linear-gradient(180deg,rgba(60,40,20,.35),rgba(60,40,20,.05))}
.txt{position:absolute;left:110px;right:110px;top:${IH + 70}px;bottom:80px;column-count:2;column-gap:220px;column-fill:balance;
  font-family:'Gowun Batang',serif;color:#3a2a1a;font-size:46px;line-height:1.72;letter-spacing:-.3px;word-break:keep-all}
.txt p{margin:0 0 .75em;break-inside:avoid-column}
.txt b{color:#7a1d16;font-weight:700}
.txt q{quotes:none;color:#5a1f4f;font-weight:700}
.era-now .band{background:radial-gradient(120% 90% at 50% 0%,rgba(255,240,200,.5),transparent 60%),repeating-linear-gradient(0deg,rgba(120,90,50,.04) 0 2px,transparent 2px 5px),#f2dcae}
.pno{position:absolute;bottom:26px;font-family:'JetBrains Mono',monospace;font-size:26px;color:rgba(70,45,20,.55);letter-spacing:3px}
.pno.l{left:110px}.pno.r{right:110px}
.tag{position:absolute;left:110px;top:${IH + 22}px;font-family:'JetBrains Mono',monospace;font-size:24px;letter-spacing:4px;color:rgba(90,55,25,.6)}
/* 제미나이 표식 가림 = 장 번호 도장 */
.stamp{position:absolute;z-index:4;left:${W - 300}px;top:${IH - 290}px;width:250px;height:250px;border-radius:50%;
  background:radial-gradient(circle at 40% 35%,#c53a2c,#8e1d14 70%);border:8px solid #f1e3c4;box-shadow:0 10px 30px rgba(0,0,0,.55);
  display:flex;flex-direction:column;align-items:center;justify-content:center;color:#f7ead0;transform:rotate(-8deg)}
.stamp .a{font-family:'JetBrains Mono',monospace;font-size:24px;letter-spacing:4px;opacity:.85}
.stamp .b{font-family:'Black Han Sans',sans-serif;font-size:92px;line-height:1}
.doc{position:absolute;z-index:3}
.forum{background:rgba(6,14,9,.94);border:3px solid #39d36f;box-shadow:0 0 0 6px rgba(0,0,0,.4),0 0 40px rgba(57,211,111,.35);padding:26px 30px;font-family:'Noto Sans KR';color:#cfeedd}
.forum .fh{font-family:'JetBrains Mono';font-size:26px;color:#39d36f;letter-spacing:2px;margin-bottom:14px}
.forum .post{border-top:1px solid rgba(57,211,111,.35);padding:14px 0}
.forum .pt{font-size:34px;font-weight:700;color:#eafff2}
.forum .pb{font-size:28px;color:#a9cdb8;margin-top:4px;line-height:1.45}
.forum .re{font-size:26px;color:#6fe39a;margin-top:4px}
.invite{background:rgba(10,8,8,.95);border:3px solid #c0392b;box-shadow:0 0 60px rgba(192,57,43,.5);padding:34px 44px;font-family:'Noto Sans KR';color:#f3e7e5}
.invite .ih{font-family:'JetBrains Mono';font-size:26px;color:#e0584a;letter-spacing:2px}
.invite .dot{display:inline-block;width:18px;height:18px;border-radius:50%;background:#e0584a;margin-right:8px}
.invite .ib{font-size:52px;line-height:1.5;margin-top:22px;font-weight:500}
.invite .ib b{color:#ff9d8f}
.invite .is{text-align:right;font-family:'JetBrains Mono';font-size:44px;color:#e0584a;margin-top:10px}
.brief{background:#f4ecd8;color:#2c241b;border:2px solid #b9a77f;box-shadow:0 18px 40px rgba(0,0,0,.55);padding:30px 36px;transform:rotate(-1.5deg);font-family:'Noto Sans KR'}
.brief .bh{font-family:'JetBrains Mono';font-weight:700;font-size:30px;letter-spacing:4px;color:#8e1d14;border-bottom:3px double #8e1d14;padding-bottom:10px;margin-bottom:12px}
.brief table{border-collapse:collapse;width:100%}
.brief th{text-align:left;font-size:32px;padding:9px 18px 9px 0;color:#5a4a33;white-space:nowrap;font-weight:700}
.brief td{font-size:32px;padding:9px 0;border-bottom:1px dashed #c9b88f}
.brief td b{color:#8e1d14;font-size:40px}
.sins{transform:rotate(1.5deg)}
.sins th{font-family:'JetBrains Mono';font-size:30px;color:#2c241b}
.sins td{text-align:right;font-weight:700;color:#8e1d14}
.radio{background:rgba(8,10,16,.93);border:2px solid #5d7ea8;padding:26px 34px;font-family:'JetBrains Mono';color:#d6e2f2;box-shadow:0 0 40px rgba(93,126,168,.4)}
.radio .rh{color:#ff5a4a;font-size:26px;letter-spacing:3px;margin-bottom:10px}
.radio .rl{font-family:'Noto Sans KR';font-size:34px;padding:7px 0;border-top:1px solid rgba(93,126,168,.3)}
.radio i{font-style:normal;color:#8fb3e0;font-family:'JetBrains Mono'}

.sign{position:absolute;transform:translate(-50%,-50%);text-align:center;white-space:nowrap;line-height:1;z-index:2}
.sign.lust{font-family:'Pacifico';font-size:76px;color:#ffe4ff;text-shadow:0 0 10px #e04cff,0 0 26px #b02cff,0 0 50px #8a1cff}
.sign.codicia{font-family:'Playfair Display';font-weight:800;font-size:66px;letter-spacing:4px;color:#ffd6d0;text-shadow:0 0 8px #ff3b2f,0 0 24px #e0201a}
.sign.envie{font-family:'Playfair Display';font-weight:600;font-size:62px;color:#151515}
.sign.glouton{font-family:'Cinzel';font-weight:800;font-size:68px;letter-spacing:8px;color:#8a5a14;text-shadow:0 2px 0 rgba(255,240,200,.6)}
.sign.sloth{font-family:'Cinzel';font-weight:800;font-size:64px;letter-spacing:8px;color:#e2b45a;text-shadow:0 0 12px rgba(226,180,90,.5)}
.sign.stolz{font-family:'Cinzel';font-weight:800;font-size:52px;letter-spacing:10px;color:#f2e6c8}
.sign.news{font-family:'Noto Sans KR';font-weight:900;font-size:50px;letter-spacing:2px;color:#fff}
.sign.pawn{font-family:'Noto Sans KR';font-weight:900;font-size:66px;letter-spacing:6px;color:#f3f0e6}
.letter{background:linear-gradient(180deg,#e9d6b0,#dcc497);color:#2b2118;padding:40px 48px 36px;font-family:'Gowun Batang',serif;font-size:30px;line-height:1.62;word-break:keep-all;box-shadow:0 24px 50px rgba(0,0,0,.6);transform:rotate(-1.2deg);border:1px solid #b89c6c}
.letter p{margin:0 0 14px}.letter .lt{font-size:36px;font-weight:700;margin-bottom:16px}.letter .ps{font-size:29px;color:#4a3524}
.letter .lf{text-align:right;font-size:36px;font-weight:700;margin-top:8px}
.realcard{position:absolute;left:1585px;top:705px;width:740px;z-index:2;transform:rotate(-5deg);filter:drop-shadow(0 22px 26px rgba(0,0,0,.65)) drop-shadow(0 0 2px rgba(255,255,255,.15))}
/* 표지 */
.cv .band{background:#0d0a12;border-top:10px solid #000}
.cv .band::before{background:radial-gradient(80% 120% at 50% 0%,rgba(140,40,60,.35),transparent 70%)}
.cvt{position:absolute;left:0;right:0;top:${IH + 70}px;text-align:center;color:#f3e3c3}
.cvt .k{font-family:'JetBrains Mono';font-size:34px;letter-spacing:14px;color:#c9405a}
.cvt .t{font-family:'Black Han Sans';font-size:230px;line-height:1.05;margin-top:24px;letter-spacing:6px;
  background:linear-gradient(180deg,#fff3d8,#d9b880);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 6px 0 #4a1020)}
.cvt .s{font-family:'Gowun Batang';font-size:52px;margin-top:30px;color:#d9c7a3}
.cvt .f{font-family:'JetBrains Mono';font-size:26px;letter-spacing:8px;margin-top:40px;color:rgba(243,227,195,.45)}
/* 부록 */
.apx{background:#2a241e}
.apx .bg{position:absolute;inset:0;background:url('${img('appendix')}') center/cover;filter:blur(3px) brightness(.55)}
.sheet{position:absolute;top:110px;width:1060px;height:1880px;background:#fbfaf6;box-shadow:0 30px 60px rgba(0,0,0,.6);padding:80px 80px 60px;font-family:'Noto Sans KR';color:#1d1d1d}
.sheet.l{left:70px;transform:rotate(-1.2deg)}.sheet.r{right:70px;transform:rotate(1deg)}
.sheet .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:4px solid #111;padding-bottom:18px}
.sheet .lg{font-family:'Black Han Sans';font-size:72px;letter-spacing:2px}
.sheet .ti{font-size:52px;font-weight:900}
.sheet .bd{font-size:34px;line-height:1.75;margin-top:40px;word-break:keep-all}
.sheet .bd h4{font-size:36px;margin:28px 0 6px}
.sheet .bd p{margin:0 0 6px}
.sheet .x{display:inline-block;background:#111;color:#111;border-radius:2px}
.sheet .ft{position:absolute;left:80px;right:80px;bottom:60px;border-top:3px solid #111;padding-top:16px;display:flex;justify-content:space-between;font-size:30px}
.sheet .sg{font-family:'Gowun Batang';font-style:italic;font-size:40px}
.cls{position:absolute;right:150px;top:1480px;border:8px solid rgba(190,30,30,.75);color:rgba(190,30,30,.75);font-family:'Black Han Sans';font-size:96px;padding:6px 34px;transform:rotate(-14deg);letter-spacing:6px}
.memo{position:absolute;left:900px;bottom:110px;width:680px;word-break:keep-all;background:#ffe98a;padding:30px 34px;font-family:'Gowun Batang';font-size:38px;line-height:1.55;color:#3a2a10;transform:rotate(-4deg);box-shadow:0 14px 30px rgba(0,0,0,.45);z-index:5}
`;

const X = n => `<span class="x">${'■'.repeat(n)}</span>`;
function appendixHTML() {
  return `<div class="sp apx"><div class="bg"></div>
  <div class="sheet l"><div class="hd"><div class="lg">ADAM Inc.</div><div class="ti">&lt;사건보고서&gt;</div></div>
   <div class="bd">
    <p>- 사건 장소: ${X(3)}시 에덴 거리</p>
    <p>- 사고명: 선악과의 씨앗 = 코드명 &lt;태초의 신부&gt; 도난 사건</p>
    <p>- 사고 일시: 2017. 01. ${X(2)}</p>
    <p>- 사고 유형: &lt;태초의 신부&gt; 보관 챔버 파손 및 선악과 도난</p>
    <p>- 피해 현황: 에덴 거리 하수처리시설과 챔버 파손 및 선악과 유실</p>
    <h4>- 사고 내용</h4>
    <p>2017. 01. ${X(2)}경, 에덴 거리로 위장한 태초의 신부 보안 시스템이 허가 요청 없이 해체됨. 이후 챔버가 지상으로 올라오게 되고, 선악과의 씨앗이 수분에 반응하여 급속 생장하게 됨. 이후 자동 자폭 시스템으로 인해 챔버가 폭파됨.</p>
    <h4>- 사고 원인</h4>
    <p>기록적인 폭우와 낙뢰로 인한 추가 보안 조치 미흡<br>보안 인원들의 원격 관리로 인한 즉각적 대응 미흡<br>내부에서의 보안 내용 유출</p>
   </div><div class="ft"><span>&lt;1/2&gt;</span><span>ADAM Inc.</span></div></div>
  <div class="sheet r"><div class="hd"><div class="lg">ADAM Inc.</div><div class="ti">&lt;사건보고서&gt;</div></div>
   <div class="bd" style="font-size:31px;line-height:1.66">
    <h4 style="margin-top:0">- 사건 과정 (2017년 01월 ${X(2)}일)</h4>
    <p>1) ${X(2)}시 ${X(2)}분: The Lust Bar에서 작전 관련 미팅이 있던 것으로 추정, 이후 The Lust Bar 보안 해체</p>
    <p>2) ${X(2)}시 ${X(2)}분: 갑작스런 폭우 및 낙뢰</p>
    <p>3) ${X(2)}시 ${X(2)}분: 에덴 거리 전력 차단, 이후 전력 복구 확인</p>
    <p>4) ${X(2)}시 ${X(2)}분: 태초의 신부 보관 챔버 보안 수동 해체 이후, 챔버 지하 13층에서 지상으로 상승 확인</p>
    <p>5) ${X(2)}시 ${X(2)}분: 하수처리시설 폭파, 이후 PAWN Shop 보안 해체</p>
    <p>6) ${X(2)}시 ${X(2)}분: PAWN Shop에서 비상용 총으로 챔버 환기구 격벽 커버가 파손됨</p>
    <p>7) ${X(2)}시 ${X(2)}분: 태초의 신부 강제 성장 이후, 자동 자폭 시스템이 가동됨</p>
    <h4>- 조치 내역</h4>
    <p>▶ 보안 관련 내용들이 내부에서 유출된 것으로 추정됨에 따라, 내부에 잠입한 불온분자를 색출 중.</p>
    <p>▶ 현재 관리센터 내부에 유출, 혹은 조력자가 있는 것으로 파악되며 관리센터 로그 및 관리자들 간 연락 추적 중 통신 내역에서 반복적으로 'SNAKE'라는 이름이 발견됨. 현재 유력 용의자는 The Lust Bar 임시 담당자이며, 선악과 도난 이후 행방이 묘연한 상태.</p>
   </div><div class="ft"><span>&lt;2/2&gt;</span><span class="sg">보안관리팀장 A. Grey</span></div></div>
  <div class="cls">CLASSIFIED</div>
  <div class="memo">녀석들, 끝까지 'SNAKE' 꼬리만 붙잡고 있었지.<br>팀 EVE가 누군지는 지금도 모른단다.</div>
  </div>`;
}


// 간판 글자 (그림의 빈 간판 자리에 얹음): [글자, 가운데x%, 가운데y%, 폭%, 스타일]
const CARD = 'data:image/png;base64,' + fs.readFileSync(path.resolve(__dirname,'../card/black_card_comic.png')).toString('base64');
const EXTRA = { s12c: `<img class="realcard" src="${CARD}">` };
const SIGNS = {
  s06: [['The LUST',24.6,13.0,26,'lust'],['CODICIA',75.2,13.6,24,'codicia'],['Salon de Envie',24.5,58.2,28,'envie'],['GLUTTONY',74.6,58.6,28,'glouton']],
  s07: [['CAFE SLOTH',25.5,8.2,30,'sloth'],['STOLZ',75.3,16.6,20,'stolz'],['NEWS STAND',24.9,57.6,24,'news'],['PAWN SHOP',75.5,59.3,30,'pawn']],
};
function signHTML(k){ return (SIGNS[k]||[]).map(([t,x,y,w,c])=>`<div class="sign ${c}" style="left:${x}%;top:${y}%;width:${w}%">${t}</div>`).join(''); }

function spreadHTML(s, idx) {
  if (s.kind === 'appendix') return appendixHTML();
  if (s.kind === 'cover') return `<div class="sp cv"><div class="art"><img src="${img('cover')}"></div>
    <div class="band"></div>
    <div class="cvt"><div class="k">FANTASTRICK · 1호점</div><div class="t">태초의 신부</div>
    <div class="s">할아버지가 들려주는 이브 프로젝트 이야기</div><div class="f">PROJECT · EVE</div></div>
    <div class="stamp" style="background:radial-gradient(circle at 40% 35%,#c9405a,#5a1020 70%)"><div class="a">EDEN</div><div class="b" style="font-size:64px">EVE</div></div></div>`;
  const p = idx * 2 - 1;
  return `<div class="sp era-${s.era}"><div class="art"><img src="${img(s.key)}">${signHTML(s.key)}</div>
    ${s.doc ? DOCS[s.doc] : ''}${EXTRA[s.key]||''}
    <div class="band"></div><div class="gut"></div>
    <div class="tag">${s.era === 'now' ? '— 지금, 아지트에서' : '— 2017년 1월, EDEN'}</div>
    <div class="txt">${paras(s.text)}</div>
    <div class="pno l">${p}</div><div class="pno r">${p + 1}</div>
    <div class="stamp"><div class="a">CHAPTER</div><div class="b">${String(idx).padStart(2, '0')}</div></div></div>`;
}

(async () => {
  const want = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  let i = 0;
  for (const s of SPREADS) {
    const idx = i++;
    if (want.length && !want.includes(s.key)) continue;
    const need = s.kind === 'appendix' ? 'appendix' : s.key;
    if (!fs.existsSync(path.join(RAW, need + '.png'))) { console.log('NO_RAW', s.key); continue; }
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${spreadHTML(s, idx)}</body></html>`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    // 글이 넘치면 글자 크기를 줄여 맞춘다
    const fs_ = await page.evaluate(() => {
      const t = document.querySelector('.txt'); if (!t) return null;
      let f = 46; while (t.scrollWidth > t.clientWidth + 2 && f > 30) { f -= 1; t.style.fontSize = f + 'px'; }
      return f;
    });
    await page.screenshot({ path: path.join(OUT, s.key + '.png') });
    console.log('OK', s.key, fs_ ? 'font=' + fs_ : '');
  }
  await browser.close();
})();
