// 락다운시티 힌트폰 GM 뷰어 — 단일 페이지(HTML+CSS+JS)
// Cloudflare Worker가 이 문자열을 "/" 에서 서빙한다.
// 상태머신은 /statemachine.js (LDC) 단일 소스를 <script src>로 로드해 사용.
// 브라우저는 같은 오리진의 wss "/live" 로 붙고, Worker가 8080 observer로 브릿지한다.

export const PAGE_HTML = /* html */ `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>락다운시티 GM 뷰어</title>
<style>
  :root{
    --bg:#0d1017; --panel:#151a24; --panel2:#1b2230; --line:#26304250;
    --tx:#e7ecf3; --mut:#8a97ab; --accent:#4f8cff; --ok:#37d67a; --warn:#ffb020; --danger:#ff5470;
  }
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Malgun Gothic",sans-serif}
  a{color:var(--accent)}
  .wrap{max-width:1180px;margin:0 auto;padding:12px}
  header{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:6px 2px 12px}
  header h1{font-size:16px;margin:0;font-weight:700;letter-spacing:.3px}
  .badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:4px 10px;border-radius:999px;background:var(--panel2);color:var(--mut)}
  .dot{width:8px;height:8px;border-radius:50%;background:#5a6b82}
  .dot.g{background:var(--ok);box-shadow:0 0 8px var(--ok)} .dot.r{background:var(--danger)} .dot.y{background:var(--warn)}
  .grid{display:grid;grid-template-columns:1.35fr .9fr;gap:12px}
  @media(max-width:880px){.grid{grid-template-columns:1fr}}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:12px}
  .card h2{font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:var(--mut);margin:0 0 10px}
  .timer{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
  .timer .clock{font:700 40px/1 "SF Mono",ui-monospace,Menlo,Consolas,monospace;letter-spacing:1px}
  .timer .clock.warn{color:var(--warn)} .timer .clock.danger{color:var(--danger)}
  .timer .note{font-size:11px;color:var(--mut);max-width:190px}
  .btnrow{display:flex;gap:6px;flex-wrap:wrap}
  button{font:inherit;cursor:pointer;border:1px solid var(--line);background:var(--panel2);color:var(--tx);padding:7px 11px;border-radius:9px}
  button:hover{border-color:#3a465c}
  button.p{background:var(--accent);border-color:var(--accent);color:#fff}
  button.d{background:transparent;border-color:var(--danger);color:var(--danger)}
  button.sm{padding:5px 8px;font-size:12px}
  button:disabled{opacity:.4;cursor:not-allowed}
  input[type=text]{font:inherit;background:#0e1320;border:1px solid var(--line);color:var(--tx);border-radius:8px;padding:7px 9px;width:82px}
  .steps{display:flex;flex-direction:column;gap:2px}
  .step{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px}
  .step .mk{width:16px;height:16px;border-radius:50%;border:2px solid #38445c;flex:0 0 auto}
  .step.done .mk{background:var(--ok);border-color:var(--ok);box-shadow:0 0 6px var(--ok)}
  .step.done{background:#12321f22}
  .step .lb{flex:1;min-width:0}
  .step .lb b{font-weight:600} .step .lb small{color:var(--mut);display:block;font-size:11px}
  .step .ts{font:12px ui-monospace,monospace;color:var(--mut)}
  .quests{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
  .q{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:9px;background:var(--panel2);opacity:.45;font-size:12px}
  .q.done{opacity:1;background:#2a2410;border:1px solid #6b551b}
  .q .qi{font-size:14px}
  .flags{display:flex;gap:8px;flex-wrap:wrap}
  .flag{font-size:12px;padding:5px 10px;border-radius:999px;background:var(--panel2);color:var(--mut)}
  .flag.on{background:#123a24;color:var(--ok)}
  .log{height:210px;overflow:auto;background:#0a0e16;border:1px solid var(--line);border-radius:10px;padding:8px;font:12px/1.5 ui-monospace,monospace}
  .log div{white-space:pre-wrap;word-break:break-all}
  .log .t{color:#5f6f88} .log .on{color:var(--ok)} .log .off{color:#7c8aa0} .log .sys{color:var(--accent)} .log .err{color:var(--danger)}
  .armbar{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;background:#241016;border:1px solid #5a2130;margin-bottom:10px}
  .armbar.on{background:#10240f;border-color:#2f6b23}
  .switch{position:relative;width:52px;height:28px;flex:0 0 auto}
  .switch input{opacity:0;width:0;height:0}
  .switch .sl{position:absolute;inset:0;background:#3a2530;border-radius:999px;transition:.2s}
  .switch .sl:before{content:"";position:absolute;width:22px;height:22px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
  .switch input:checked + .sl{background:var(--ok)} .switch input:checked + .sl:before{transform:translateX(24px)}
  .ctl-note{font-size:11px;color:var(--mut)}
  .ctlgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;margin-top:8px}
  .ctlgrid button{font-size:12px;text-align:left}
  .rawrow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:10px}
  .rawrow input{width:auto;min-width:70px}
  .hidden{display:none!important}
  .mini{font-size:11px;color:var(--mut)}
  .card h2.split{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
  .card h2.split .mini{text-transform:none;letter-spacing:.06em}
  .hintbig{display:flex;align-items:baseline;gap:8px}
  .hintbig #hintNum{font:900 42px/1 "SF Mono",ui-monospace,Menlo,Consolas,monospace;color:var(--ok);
    text-shadow:0 0 12px #37d67a66;font-variant-numeric:tabular-nums}
  .hintbig #hintNum.warn{color:var(--warn);text-shadow:0 0 12px #ffb02066}
  .hintbig #hintNum.alert{color:var(--danger);text-shadow:0 0 12px #ff547066}
  .hintbig .hintunit{font-size:14px;color:var(--mut)}
  .codes{display:flex;flex-wrap:wrap;gap:5px;margin-top:12px}
  .codes .code{font:12px ui-monospace,monospace;background:var(--panel2);border:1px solid var(--line);
    border-radius:6px;padding:4px 8px;color:var(--tx)}
  .codes .code small{color:var(--mut);margin-left:5px;font-size:10px}
  .toast{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:50;max-width:92vw;
    background:#123a24;border:1px solid var(--ok);color:var(--ok);padding:10px 16px;border-radius:12px;
    font-size:13px;font-weight:600;box-shadow:0 6px 24px #0009;opacity:0;pointer-events:none;transition:opacity .25s}
  .toast.show{opacity:1}
</style>
</head>
<body>
<div id="toast" class="toast"></div>
<div class="wrap">
  <header>
    <h1>🔒 락다운시티 · GM 뷰어</h1>
    <span class="badge"><span id="connDot" class="dot r"></span><span id="connTxt">연결 안 됨</span></span>
    <span class="badge">수신 <b id="msgCount" style="color:var(--tx)">0</b></span>
    <span class="badge" id="stageBadge">단계: —</span>
    <span style="flex:1"></span>
    <button class="sm" id="reconnectBtn">재연결</button>
    <button class="sm d" id="resetBtn">진행 초기화</button>
  </header>

  <div class="card">
    <h2>현재 시간 <span class="mini">(폰과 자동 동기화)</span></h2>
    <div class="timer">
      <div id="clock" class="clock">1:40:00</div>
      <div class="btnrow" style="align-items:center">
        <input type="text" id="tSet" placeholder="1:40:00" title="시:분:초 / 분:초 / 분" style="width:120px;text-align:center">
        <button class="p" id="tSetBtn">시간 적용</button>
        <span class="mini" id="syncDot" style="color:var(--mut)">○ 폰 신호 없음</span>
        <span class="mini" id="ackDot" style="color:var(--mut)"></span>
        <span style="flex:1"></span>
        <button class="p" id="gameStartBtn">▶ 게임 시작 신호</button>
      </div>
      <div class="mini" style="margin-top:4px">입력 예: 1:40:00 · 85:00 · 85(분) — 적용하면 힌트폰 시간이 즉시 바뀝니다</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="card">
        <h2>메인 진행</h2>
        <div id="steps" class="steps"></div>
      </div>
      <div class="card">
        <h2>업적 퀘스트</h2>
        <div id="quests" class="quests"></div>
      </div>
    </div>
    <div>
      <div class="card">
        <h2>개인 SNS / 개인 메시지 <span class="mini">(폰 2대 공유)</span></h2>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="width:92px">개인 SNS</span>
            <span class="flag" id="snsStat">○ 확인 중…</span>
            <span style="flex:1"></span>
            <button class="sm p" id="snsAct">활성화</button>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="width:92px">개인 메시지</span>
            <span class="flag" id="dmStat">○ 확인 중…</span>
            <span style="flex:1"></span>
            <button class="sm p" id="dmAct">활성화</button>
          </div>
          <div class="mini" id="snsdmAge">폰 상태 보고 대기…</div>
        </div>
      </div>

      <div class="card">
        <h2 class="split">힌트 사용 <span class="mini" id="hintLast">—</span></h2>
        <div class="hintbig"><span id="hintNum">0</span><span class="hintunit">회 / 21개 중</span></div>
        <div class="codes" id="hintCodes"></div>
        <div class="mini" id="hintEmpty">아직 힌트를 쓰지 않았습니다</div>
      </div>

      <div class="card">
        <h2>상태 플래그</h2>
        <div class="flags" id="flags">
          <span class="flag" id="fMission">미션시작</span>
          <span class="flag" id="fSNS">SNS</span>
          <span class="flag" id="fDM">DM</span>
          <span class="flag" id="fEnd">엔딩(락다운 해제)</span>
        </div>
      </div>

    </div>
  </div>
  <p class="mini" style="text-align:center;opacity:.6">락다운시티 GM 뷰어<span id="wsUrl" style="display:none"></span></p>
</div>

<script src="/statemachine.js"></script>
<script>
/* 상태머신은 statemachine.js(LDC) 단일 소스 — node 테스트와 동일 코드 */
const {TP, STEPS, QUESTS} = LDC;
let S = LDC.createState();
function freshState(){ S = LDC.createState(); }

/* ---------- 스냅샷 재생 차단 ----------
   슬레이브는 5초마다 재등록하며 전체 핀 스냅샷을 다시 뿌린다.
   그대로 상태머신에 먹이면 초기화해도 5초 뒤 진행이 다시 채워져 "초기화가 안 되는" 것처럼 보인다.
   핀별 마지막 상태를 기억해 두고, 스냅샷은 값이 바뀐 핀만 반영한다.
   처음 보는 핀은 반영한다 → 게임 도중 뷰어를 열어도 진행을 따라잡을 수 있다.
   pinSeen 은 초기화(doFullReset) 때 비우지 않는다 — 걸려 있는 핀이 진행을 되살리면 안 되므로. */
const pinSeen=new Map();
function pinKey(s,a,p){ return s+'/'+a+'/'+p; }
function snapshotShouldApply(s,a,p,st){
  const k=pinKey(s,a,p), known=pinSeen.has(k), prev=pinSeen.get(k);
  pinSeen.set(k,st);
  return !known || prev!==st;   // 처음 보는 핀(따라잡기) 또는 값이 바뀐 핀만
}
function applyPin(slaveID, arduinoID, pinNumber, state){
  // timeRemaining: GM 타이머(폰 미러)를 안가 pin24의 70분 게이트 판정에 사용
  LDC.applyPin(S, slaveID, arduinoID, pinNumber, state, {onFirstPin, timeRemaining: tRemain});
  // 폰 타이머 동기화: 거리 pin22(streetmega-2) on → 폰과 동일하게 137초 후 100:00부터 시작
  if(state==='on' && slaveID==='streetmega' && arduinoID==='streetmega-2' && parseInt(pinNumber)===22){
    onPhoneTimerTrigger();
  }
  render();
}

/* ---------- 렌더 ---------- */
function fmtTs(ms){ if(!ms) return ''; const d=new Date(ms); return d.toTimeString().slice(0,8); }
function render(){
  const P=S.P, stamps=S.stamps, flags=S.flags;
  const stepsEl=document.getElementById('steps'); stepsEl.innerHTML='';
  STEPS.forEach((s)=>{
    const done=!!P[s.k];
    const div=document.createElement('div');
    div.className='step'+(done?' done':'');
    div.innerHTML='<span class="mk"></span><span class="lb"><b>'+s.b+'</b></span>'+
      '<span class="ts">'+(done?fmtTs(stamps[s.k]):'')+'</span>';
    stepsEl.appendChild(div);
  });
  const qEl=document.getElementById('quests'); qEl.innerHTML='';
  QUESTS.forEach(q=>{
    const done=!!P[q.k];
    const div=document.createElement('div'); div.className='q'+(done?' done':'');
    div.innerHTML='<span class="qi">'+q.i+'</span><span>'+q.name+(done?' <small style="color:#b9a24a">'+fmtTs(stamps[q.k])+'</small>':'')+'</span>';
    qEl.appendChild(div);
  });
  setFlag('fMission',flags.mission); setFlag('fSNS',flags.sns); setFlag('fDM',flags.dm); setFlag('fEnd',flags.end);
  const idx=LDC.currentStageIndex(S);
  document.getElementById('stageBadge').textContent='단계: '+(idx<0?'대기':((idx+1)+'/'+STEPS.length+' · '+STEPS[idx].b));
}
function setFlag(id,on){ document.getElementById(id).classList.toggle('on',!!on); }

/* ---------- 로그 (화면 미노출, 콘솔 전용) ---------- */
function logLine(cls,txt){ console.log('['+cls+'] '+txt); }

/* ---------- WebSocket (Worker /live) ---------- */
let ws=null, msgCount=0, manualClose=false;
function wsUrl(){ const l=location; return (l.protocol==='https:'?'wss:':'ws:')+'//'+l.host+'/live'; }
document.getElementById('wsUrl').textContent=wsUrl();
function connect(){
  manualClose=false;
  setConn('y','연결 중…');
  ws=new WebSocket(wsUrl());
  ws.onopen=()=>{ setConn('g','연결됨 (master·읽기)'); logLine('sys','● master 연결(다중 안전)'); };
  ws.onmessage=(ev)=>{
    msgCount++; document.getElementById('msgCount').textContent=msgCount;
    let data; try{ data=JSON.parse(ev.data); }catch{ return; }
    handleMessage(data);
  };
  ws.onclose=()=>{ setConn('r','연결 끊김'); if(!manualClose){ logLine('err','● 끊김 — 3초 후 재연결'); setTimeout(connect,3000);} };
  ws.onerror=()=>{ setConn('r','오류'); };
}
function setConn(c,t){ document.getElementById('connDot').className='dot '+c; document.getElementById('connTxt').textContent=t; }
function handleMessage(data){
  switch(data.type){
    case 'update':
      if(data.slaveID==='__time__'){ // 폰이 10초마다 보내는 남은시간 보고 (simPin 채널 재사용)
        const s=parseInt(data.updates&&data.updates[0]&&data.updates[0].pin);
        if(!isNaN(s)) phoneTimeReport(s, String(data.arduinoID||'__t__'));
        break;
      }
      if(data.slaveID==='__timeack__'){ // 폰이 시간 세팅을 실제로 적용했다는 회신 (폰마다 하나씩)
        timeAckReport(parseInt(data.updates&&data.updates[0]&&data.updates[0].pin), String(data.arduinoID||'ack'));
        break;
      }
      if(data.slaveID==='__settime__'){ break; } // 우리가 보낸 시간 세팅의 에코 — 무시
      if(data.slaveID==='__status__'){ // 폰 SNS/DM 상태 보고 (5초 주기, 폰마다 하나씩)
        const bits=parseInt(data.updates&&data.updates[0]&&data.updates[0].pin);
        if(!isNaN(bits)) phoneStatusReport(bits, String(data.arduinoID||'snsdm'));
        break;
      }
      if(data.slaveID==='__reset__'){ // 폰 프로그램 초기화 통보 (1=새로고침/부팅, 2=resetScreen)
        const k=parseInt(data.updates&&data.updates[0]&&data.updates[0].pin);
        doFullReset(k===2?'폰 resetScreen() 실행':'폰 프로그램 초기화(새로고침)');
        break;
      }
      if(data.slaveID==='__hint__'){ // 폰이 방금 새로 본 힌트 (pin = LC 코드 번호)
        hintSeen(parseInt(data.updates&&data.updates[0]&&data.updates[0].pin), true);
        break;
      }
      if(data.slaveID==='__hintmask__'){ // 폰이 5초마다 보내는 힌트 사용 전체 비트마스크
        hintMerge(parseInt(data.updates&&data.updates[0]&&data.updates[0].pin));
        break;
      }
      if(data.slaveID==='__snsctl__'){ break; } // 우리 제어신호 에코 — 무시
      // 그 밖의 '__' 접두 채널은 내부 통신용 — 게임 상태머신에 절대 넣지 않음
      if(data.slaveID && String(data.slaveID).indexOf('__')===0){ break; }
      if(data.updates) data.updates.forEach(u=>{ // 실제 조작 → 항상 반영
        pinSeen.set(pinKey(data.slaveID,data.arduinoID,u.pin),u.state);
        logPin(data.slaveID,data.arduinoID,u.pin,u.state); applyPin(data.slaveID,data.arduinoID,u.pin,u.state);
      });
      break;
    case 'slaveRegister': // 5초마다 반복되는 스냅샷 — 바뀐 핀만
      if(data.arduinos) data.arduinos.forEach(a=>(a.pins||[]).forEach(pn=>{
        if(!snapshotShouldApply(data.slaveID,a.arduinoID,pn.pin,pn.state)) return;
        logPin(data.slaveID,a.arduinoID,pn.pin,pn.state,true); applyPin(data.slaveID,a.arduinoID,pn.pin,pn.state);
      }));
      break;
    case 'pin_change':
      if(data.data){ const d=data.data; logPin(d.slaveID,d.arduinoID,d.pinNumber,d.state); applyPin(d.slaveID,d.arduinoID,d.pinNumber,d.state); }
      break;
    case 'slaveList': // master 접속 시 서버가 주는 스냅샷 (역시 바뀐 핀만)
      if(data.slaves) data.slaves.forEach(s=>(s.arduinos||[]).forEach(a=>(a.pins||[]).forEach(pn=>{
        if(!snapshotShouldApply(s.slaveID,a.arduinoID,pn.pin,pn.state)) return;
        logPin(s.slaveID,a.arduinoID,pn.pin,pn.state,true); applyPin(s.slaveID,a.arduinoID,pn.pin,pn.state);
      })));
      logLine('sys','● 스냅샷 수신 (슬레이브 '+(data.slaves?data.slaves.length:0)+')');
      break;
    case 'arduinoDisconnect': logLine('t','· 아두이노 해제: '+data.slaveID+'/'+data.arduinoID); break;
    case 'observer_ack': logLine('sys','● 브릿지 준비'+(data.bridge?' (Worker)':' (서버 확인)')); break;
    default: logLine('t','· '+JSON.stringify(data).slice(0,160));
  }
}
function logPin(s,a,p,state,snap){ logLine(state==='on'?'on':'off',(snap?'[snapshot] ':'')+s+'/'+a+' pin'+p+' → '+state); }

/* ---------- 개인 SNS / DM 상태 + 원격 활성화 ----------
   힌트폰은 2대가 동시에 돌아간다. 폰마다 자기 식별자를 arduinoID(snsdm-xxxx)로 실어 보내므로
   폰별로 따로 담아두고 "몇 대 중 몇 대가 켜져 있는지"를 보여준다.
   DM은 그 폰에서 DM 탭을 열면 스스로 꺼지는 알림 플래그라, 폰끼리 달라도 정상이다. */
let snsdmLastTs=0;
const phones=new Map(); // arduinoID → {bits, ts}
const PHONE_STALE_MS=15000;
function livePhones(){
  const now=Date.now(), out=[];
  phones.forEach((v,k)=>{ if(now-v.ts<=PHONE_STALE_MS) out.push(v); else phones.delete(k); });
  return out;
}
function setStat(id,on,n,total){
  const e=document.getElementById(id);
  const cnt=(total>1)?' '+n+'/'+total+'대':'';
  e.textContent=(on?'● 활성':'○ 비활성')+cnt;
  e.classList.toggle('on',on);
}
function phoneStatusReport(bits, phoneId){
  phones.set(phoneId,{bits,ts:Date.now()});
  renderPhoneStatus();
  snsdmLastTs=Date.now();
}
function renderPhoneStatus(){
  const live=livePhones(), total=live.length;
  const sns=live.filter(p=>(p.bits&1)===1).length;
  const dm =live.filter(p=>(p.bits&2)===2).length;
  setStat('snsStat', sns>0, sns, total);
  setStat('dmStat',  dm>0,  dm,  total);
  document.getElementById('snsdmAge').textContent=
    '폰 '+total+'대 보고 중 · 마지막 '+new Date().toTimeString().slice(0,8);
}
setInterval(()=>{
  if(!snsdmLastTs) return;
  if(Date.now()-snsdmLastTs>PHONE_STALE_MS){
    document.getElementById('snsdmAge').textContent='⚠ 폰 상태 보고 끊김(15초+) — 태블릿 패치 적용 확인';
  } else if(phones.size!==livePhones().length){
    renderPhoneStatus(); // 한 대가 빠지면 대수 표시를 갱신
  }
},5000);
function sendSnsCtl(kind){ // kind: 1=SNS, 2=DM
  if(!ws||ws.readyState!==WebSocket.OPEN){ alert('연결 안 됨'); return; }
  const name=kind===1?'개인 SNS':'개인 메시지(DM)';
  const n=livePhones().length;
  if(!confirm(name+' 를 접속 중인 힌트폰 '+(n||'?')+'대 전부에 활성화합니다. 계속할까요?')) return;
  ws.send(JSON.stringify({type:'simPin',slaveID:'__snsctl__',arduinoID:'ctl',pin:kind,state:'on'}));
  logLine('sys','▶ '+name+' 활성화 전송');
}
document.getElementById('snsAct').onclick=()=>sendSnsCtl(1);
document.getElementById('dmAct').onclick=()=>sendSnsCtl(2);

/* ---------- 힌트 사용 개수 ----------
   힌트 코드 LC001~LC021 을 비트마스크 하나로 관리한다(비트 0 = LC001).
   · __hint__     = 폰이 방금 새로 본 힌트 → 코드와 시각을 함께 남긴다
   · __hintmask__ = 폰이 5초마다 보내는 전체 목록 → 뷰어를 늦게 열어도 개수는 맞는다
   같은 힌트를 다시 봐도 개수는 안 오르고(폰이 이미 걸러냄), 초기화 때 함께 0으로 돌아간다. */
const HINT_MAX=21;
let hintMask=0;
const hintTimes=new Map(); // 코드번호 → 처음 본 시각(ms)
function hintCount(){ let n=0,m=hintMask; while(m){ n+=m&1; m>>>=1; } return n; }
function hintSeen(num, stamp){
  if(!(num>=1&&num<=HINT_MAX)) return;
  const bit=1<<(num-1);
  if(!(hintMask&bit)){ hintMask|=bit; if(stamp) hintTimes.set(num,Date.now()); }
  else if(stamp && !hintTimes.has(num)) hintTimes.set(num,Date.now());
  renderHints();
}
function hintMerge(mask){
  if(!(mask>0)) return;
  const merged=hintMask|mask;
  if(merged===hintMask) return;
  hintMask=merged; renderHints();   // 뷰어 접속 전에 쓴 힌트는 개수에만 반영(시각 없음)
}
function renderHints(){
  const n=hintCount();
  const numEl=document.getElementById('hintNum');
  numEl.textContent=String(n);
  numEl.className=n>=5?'alert':(n>=3?'warn':'');
  const codes=[...hintTimes.entries()].sort((a,b)=>a[1]-b[1]);
  const box=document.getElementById('hintCodes'); box.innerHTML='';
  codes.forEach(([num,ts])=>{
    const s=document.createElement('span'); s.className='code';
    s.innerHTML='LC'+String(num).padStart(3,'0')+'<small>'+new Date(ts).toTimeString().slice(0,5)+'</small>';
    box.appendChild(s);
  });
  document.getElementById('hintEmpty').style.display=n?'none':'block';
  const last=codes.length?codes[codes.length-1][1]:0;
  document.getElementById('hintLast').textContent=last?('최근 '+new Date(last).toTimeString().slice(0,8)):'—';
}

/* ---------- 게임 시작 신호 ----------
   폰 app.js의 pin22 처리엔 !pinProgress.streetmegaPin22 가드가 있어
   이미 플레이 중인 폰은 이 신호를 완전히 무시한다. 대기화면 폰만 시작됨. */
document.getElementById('gameStartBtn').onclick=()=>{
  if(!ws||ws.readyState!==WebSocket.OPEN){ alert('연결 안 됨'); return; }
  if(!confirm('게임 시작 신호를 보냅니다.\\n\\n· 대기화면인 힌트폰 → 게임 시작\\n· 이미 플레이 중인 폰 → 영향 없음(무시)\\n\\n보낼까요?')) return;
  if(S.P.streetmegaPin22 && confirm('뷰어 화면에 이전 게임 진행이 남아 있습니다.\\n뷰어 표시를 초기화하고 새 게임으로 추적할까요?\\n(취소해도 신호는 전송됩니다)')){
    doFullReset('새 게임 시작');
  }
  ws.send(JSON.stringify({type:'simPin',slaveID:'streetmega',arduinoID:'streetmega-2',pin:22,state:'on'}));
  logLine('sys','▶ 게임 시작 신호 전송');
};

/* ---------- GM 타이머 (화면 전용) ---------- */
let tRemain=6000, tEnd=null, tInt=null, autoStarted=false, phoneSyncArmed=false, phoneSyncTimer=null;
const PHONE_INTRO_MS=137000; // app.js: pin22 후 137초 뒤 startTimer
// 폰 타이머와 동기화: 거리 pin22 감지 시, 137초 후 100:00부터 시작(폰과 동일 시점)
function onPhoneTimerTrigger(){
  if(phoneSyncArmed || autoStarted || tInt) return;      // 이미 시작/예약됐으면 무시
  phoneSyncArmed=true;
  tPause(); tRemain=6000; tDraw();
  logLine('sys','⏱ 거리 pin22 감지 → 137초 후 폰과 함께 시작(100:00)');
  clearTimeout(phoneSyncTimer);
  phoneSyncTimer=setTimeout(()=>{ if(phoneSyncArmed){ autoStarted=true; tStart(); logLine('sys','⏱ 폰 타이머 시작(100:00)'); } }, PHONE_INTRO_MS);
}
function tFmt(s){ s=Math.max(0,Math.floor(s)); const h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60; return h+':'+String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0'); }
function tDraw(){ const c=document.getElementById('clock'); c.textContent=tFmt(tRemain); c.className='clock'+(tRemain<=0?' danger':tRemain<600?' warn':''); }
function tTick(){ const r=(tEnd-Date.now())/1000; tRemain=r; tDraw(); if(r<=0){ clearInterval(tInt); tInt=null; tRemain=0; tDraw(); } }
function tStart(){ if(tInt) clearInterval(tInt); tEnd=Date.now()+tRemain*1000; tInt=setInterval(tTick,250); tDraw(); }
function tPause(){ if(tInt){ clearInterval(tInt); tInt=null; } }
function parseTimeInput(v){
  v=(v||'').trim(); let m;
  if(m=v.match(/^(\\d+):(\\d{1,2}):(\\d{1,2})$/)) return (+m[1])*3600+(+m[2])*60+(+m[3]); // 시:분:초
  if(m=v.match(/^(\\d+):(\\d{1,2})$/)) return (+m[1])*60+(+m[2]);                          // 분:초
  if(/^\\d+$/.test(v)) return (+v)*60;                                                     // 분
  return null;
}
/* "시간 적용" — 뷰어 시계 변경 + 힌트폰에 즉시 반영
   두 경로로 동시에 보낸다:
    1) simPin '__settime__'  ← 실제로 먹는 경로. 매장 릴레이에 이미 있는 simPin 패치만 쓴다.
    2) timeSync              ← 서버에 timeSync 블록이 추가돼 있을 때만 도달(호환용).
   매장 서버 패치본에는 timeSync 블록이 빠져 있어서, 1번이 없으면 조용히 증발한다. */
let timeAckExpect=null, timeAckPhones=new Set(), timeAckTimer=null, timeApplyAt=0;
function applyTimeInput(){
  const s=parseTimeInput(document.getElementById('tSet').value);
  if(s===null){ alert('형식: 1:40:00 (시:분:초) · 85:00 (분:초) · 85 (분)'); return; }
  if(!ws||ws.readyState!==WebSocket.OPEN){ alert('연결이 끊겨 있어 폰에 적용할 수 없습니다.'); return; }
  tRemain=s; autoStarted=true; phoneSyncArmed=false;
  if(tInt){ tEnd=Date.now()+tRemain*1000; } else if(s>0){ tStart(); }
  tDraw();
  const sec=Math.max(0,Math.round(s));
  ws.send(JSON.stringify({type:'simPin', slaveID:'__settime__', arduinoID:'gm', pin:sec, state:'on'}));
  ws.send(JSON.stringify({type:'timeSync', seconds:sec}));
  // 방금 보낸 값이, 이미 날아오고 있던 폰 보고(10초 주기)에 곧바로 덮어써지지 않도록 잠깐 보호
  timeApplyAt=Date.now();
  // 적용 확인 대기 — 3초 안에 폰 회신이 없으면 실패를 알린다(조용한 실패 방지)
  timeAckExpect=sec; timeAckPhones.clear(); setAckDot('…폰 응답 대기','var(--mut)');
  clearTimeout(timeAckTimer);
  timeAckTimer=setTimeout(()=>{
    if(!timeAckPhones.size){
      setAckDot('✖ 폰 적용 실패 — 응답 없음','var(--danger)');
      logLine('err','⏱ 시간 적용 실패 — 폰 회신 없음 (폰이 v139 미만이거나 연결 끊김)');
    }
  },3000);
  logLine('sys','⏱ 시간 적용 전송: '+tFmt(s));
  document.getElementById('tSet').value='';
}
function setAckDot(txt,color){ const el=document.getElementById('ackDot'); if(el){ el.textContent=txt; el.style.color=color; } }
// 폰이 "적용했다"고 회신 → 몇 대에 먹었는지 표시
function timeAckReport(sec,phoneId){
  if(isNaN(sec)) return;
  timeAckPhones.add(phoneId);
  const n=timeAckPhones.size;
  const okv=(timeAckExpect===null)||Math.abs(sec-timeAckExpect)<=2;
  setAckDot((okv?'✔':'⚠')+' 폰 '+n+'대 적용'+(okv?'':' (값 불일치 '+tFmt(sec)+')'), okv?'var(--ok)':'var(--warn)');
  logLine('sys','⏱ 폰 적용 확인: '+tFmt(sec)+' ('+phoneId+')');
}
document.getElementById('tSetBtn').onclick=applyTimeInput;
document.getElementById('tSet').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); applyTimeInput(); } });
function onFirstPin(){ /* 타이머 시작은 거리 pin22 +137초 동기화(onPhoneTimerTrigger)가 담당 */ }
/* 폰 실시간 시간 보고(10초 주기) 수신 → 뷰어 타이머를 폰 값으로 강제 동기화
   arduinoID 가 폰마다 "tS-xxxx(믿을 만함) / tU-xxxx(모름)" 로 온다(v141).
   재시작한 폰은 타이머를 1:40:00 부터 다시 세므로, 그 값으로 뷰어 시계를 바꾸면 안 된다.
   (v140 이하 폰은 '__t__' 로 보내므로 믿을 만한 것으로 취급 — 하위호환) */
const phoneTimes=new Map();   // 폰id → {sec, ts}
function phoneTimeReport(sec, aid){
  const unsynced = aid.indexOf('tU-')===0;
  const pid = /^t[SU]-/.test(aid) ? aid.slice(3) : aid;
  if(unsynced){
    // 아직 다른 폰에서 시간을 못 받은 폰. 곧 자동 동기화되므로 뷰어 시계는 건드리지 않는다.
    setSyncDot('⚠ 폰 시간 미동기화 ('+pid+')','var(--warn)');
    return;
  }
  phoneTimes.set(pid,{sec,ts:Date.now()});
  // 방금 시간을 적용했다면 2.5초간은 폰 보고를 받지 않는다.
  // 폰이 값을 바꾸기 직전에 출발한 보고(10초 주기)가 도착해 GM 이 방금 넣은 값을
  // 곧바로 지워버리는 것을 막는다. 폰이 정말 안 먹었다면 이 창이 끝난 뒤 되돌아온다(= 사실 반영).
  if(timeApplyAt && Date.now()-timeApplyAt<2500) return;
  autoStarted=true; phoneSyncArmed=false;   // 추정 동기화(137초 예약)보다 실측이 우선
  tRemain=sec;
  if(sec>0){ if(tInt){ tEnd=Date.now()+sec*1000; } else { tStart(); } }
  else { tPause(); tRemain=0; }
  tDraw();
  // 두 폰이 서로 다른 시간을 보고하면 알린다(자동 동기화가 안 붙은 상황)
  const fresh=[...phoneTimes.entries()].filter(([,v])=>Date.now()-v.ts<25000);
  const gap=fresh.length>1 ? Math.max(...fresh.map(([,v])=>v.sec))-Math.min(...fresh.map(([,v])=>v.sec)) : 0;
  if(gap>5) setSyncDot('⚠ 폰 시간 불일치 '+Math.round(gap)+'초','var(--danger)');
  else setSyncDot('● 폰 시간 수신중'+(fresh.length>1?' (2대 일치)':''),'var(--ok)');
}
function setSyncDot(txt,color){
  const el=document.getElementById('syncDot'); if(!el) return;
  el.textContent=txt; el.style.color=color;
  clearTimeout(el._t); el._t=setTimeout(()=>{ el.textContent='○ 폰 신호 없음'; el.style.color='var(--mut)'; },25000);
}

/* ---------- 전체 초기화 (폰 초기화 감지 / 수동 버튼 공용) ----------
   뷰어의 "전 기능"을 새로 켠 것과 같은 준비상태로 되돌린다.
   서버·폰으로는 아무것도 보내지 않는다(화면 상태만). */
function doFullReset(reason){
  // 1) 진행 상태머신
  freshState();
  // 2) 타이머 (예약된 137초 시작도 취소)
  clearTimeout(phoneSyncTimer); phoneSyncTimer=null;
  phoneSyncArmed=false; autoStarted=false;
  tPause(); tEnd=null; tRemain=6000; tDraw();
  clearTimeout(timeAckTimer); timeAckExpect=null; timeAckPhones.clear(); timeApplyAt=0; setAckDot('','var(--mut)');
  const sd=document.getElementById('syncDot');
  if(sd){ clearTimeout(sd._t); sd.textContent='○ 폰 신호 없음'; sd.style.color='var(--mut)'; }
  phoneTimes.clear();   // 폰별 시간 보고도 비움 — 초기화 후 첫 보고부터 다시 비교한다
  document.getElementById('tSet').value='';
  // 3) 개인 SNS / DM 상태 (폰별 보고도 비움 — 초기화 후 첫 보고부터 다시 센다)
  snsdmLastTs=0; phones.clear();
  setStat('snsStat',false); document.getElementById('snsStat').textContent='○ 확인 중…';
  setStat('dmStat',false);  document.getElementById('dmStat').textContent='○ 확인 중…';
  document.getElementById('snsdmAge').textContent='폰 상태 보고 대기…';
  // 4) 힌트 사용 개수
  hintMask=0; hintTimes.clear(); renderHints();
  // 5) 수신 카운터
  msgCount=0; document.getElementById('msgCount').textContent='0';
  // 6) 그리기
  render();
  logLine('sys','⟳ 전체 초기화 — '+reason);
  toast('⟳ '+reason+' → 뷰어 초기화됨 ('+new Date().toTimeString().slice(0,8)+')');
}
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),8000);
}

/* ---------- 버튼/초기화 ---------- */
document.getElementById('reconnectBtn').onclick=()=>{ manualClose=true; if(ws) ws.close(); setTimeout(connect,200); };
document.getElementById('resetBtn').onclick=()=>{ if(confirm('뷰어를 처음 준비상태로 되돌립니다.\\n(진행·타이머·SNS/DM 표시 전부 — 서버/폰에는 영향 없음)')){ doFullReset('수동 초기화'); } };

freshState(); render(); tDraw(); renderHints(); connect();
</script>
</body>
</html>`;
