// WebSocket 설정
let ws = null;
const wsURL = 'ws://fantatgc.iptime.org:8080';
let connectionMode = null; // 초기값 null: 사용자가 선택할 때까지 연결하지 않음
let testChannel = null;

// GM 뷰어 초기화 통보: 페이지 로드당 1회만 보내기 위한 플래그
let _gmResetAnnounced = false;
// 이 폰의 식별자(부팅마다 새로 생성). 폰이 2대라 자기 에코를 걸러내고
// 뷰어가 "몇 대가 보고 중인지" 셀 수 있어야 한다.
let _gmPhoneId = Math.random().toString(36).slice(2, 6);

// 재연결 관련 변수
let reconnectInterval = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const initialReconnectDelay = 1000; // 1초
const maxReconnectDelay = 30000; // 30초

// 연결 모드 선택 및 연결
function connectMode(mode) {
  connectionMode = mode;

  document.getElementById('configModal').style.display = 'none';

  if (connectionMode === 'websocket') {
    connectWebSocket();
  } else {
    initTestMode();
  }
}

// WebSocket 자동 재연결 함수
function scheduleReconnect() {
  // 이미 재연결 중이면 중복 실행 방지
  if (reconnectInterval) {
    clearTimeout(reconnectInterval);
  }

  // 최대 재연결 시도 횟수 체크
  if (reconnectAttempts >= maxReconnectAttempts) {
    updateStatus('최대 재연결 시도 초과');
    console.error('WebSocket 재연결 실패: 최대 시도 횟수 초과');
    return;
  }

  // 지수 백오프: 재연결 시도마다 대기 시간 증가
  const delay = Math.min(initialReconnectDelay * Math.pow(2, reconnectAttempts), maxReconnectDelay);

  console.log(`${delay/1000}초 후 재연결 시도 (${reconnectAttempts + 1}/${maxReconnectAttempts})`);

  reconnectInterval = setTimeout(() => {
    if (connectionMode === 'websocket') {
      reconnectAttempts++;
      connectWebSocket();
    }
  }, delay);
}

// WebSocket 연결
function connectWebSocket() {
  // 기존 연결이 있으면 정리
  if (ws) {
    ws.onclose = null; // 재연결 중복 방지
    ws.close();
  }

  updateStatus('연결 중...');

  try {
    ws = new WebSocket(wsURL);
  } catch (error) {
    console.error('WebSocket 생성 실패:', error);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('WebSocket 연결됨');
    updateStatus('WebSocket 연결됨');

    // 연결 성공 시 빨간 점 숨기기
    const indicator = document.getElementById('connectionIndicator');
    if (indicator) {
      indicator.style.display = 'none';
    }

    // 연결 성공 시 재연결 카운터 초기화
    reconnectAttempts = 0;
    if (reconnectInterval) {
      clearTimeout(reconnectInterval);
      reconnectInterval = null;
    }

    ws.send(JSON.stringify({ type: 'master' }));

    // GM 뷰어에 "폰 프로그램 초기화됨" 1회 통보 (페이지 로드당 딱 한 번)
    // 재연결(네트워크 끊김 복구)에는 안 보냄 → 게임 중 끊겼다 붙어도 뷰어가 안 지워짐
    if (!_gmResetAnnounced) {
      _gmResetAnnounced = true;
      // 10탭으로 새로고침 직전에 이미 통보했으면 여기서 또 보내지 않는다(중복 초기화 방지)
      if (_gmTakeResetSentFlag()) console.log('[GM] 10탭 통보 후 재접속 — 중복 통보 생략');
      else _gmAnnounceReset(1);
    }

    // 타이머 복구 (앱이 백그라운드에서 돌아왔을 때)
    if (typeof restoreTimer === 'function') {
      restoreTimer();
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    } catch (error) {
      console.error('메시지 파싱 오류:', error);
    }
  };

  ws.onclose = (event) => {
    console.log('WebSocket 연결 종료:', event.code, event.reason);
    updateStatus('연결 끊김');

    // 연결 끊김 시 빨간 점 표시
    const indicator = document.getElementById('connectionIndicator');
    if (indicator && connectionMode === 'websocket') {
      indicator.style.display = 'block';
    }

    // 정상 종료가 아닌 경우에만 재연결
    if (event.code !== 1000 && connectionMode === 'websocket') {
      scheduleReconnect();
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket 오류:', error);
    updateStatus('연결 오류');

    // 오류 시에도 빨간 점 표시
    const indicator = document.getElementById('connectionIndicator');
    if (indicator && connectionMode === 'websocket') {
      indicator.style.display = 'block';
    }

    // onerror 후 onclose가 호출되므로 여기서는 재연결하지 않음
  };
}

// WebSocket 메시지 처리
function handleWebSocketMessage(data) {
  switch(data.type) {
    case 'update':
      // GM 뷰어 SNS/DM 원격 제어 (simPin '__snsctl__' 채널)
      // 다른 폰이 터치로 켠 것도 이 채널로 온다 → 폰 2대가 같은 상태를 공유
      if (data.slaveID === '__snsctl__' && data.updates && data.updates[0]) {
        var _p = parseInt(data.updates[0].pin);
        if (_p === 1) _gmActivateSNS();
        else if (_p === 2) _gmActivateDM();
        break;
      }
      // 다른 폰(또는 뷰어)의 초기화 통보 → 이 폰도 "새로고침"으로 초기화.
      // resetScreen 만으로는 부족하다: pinProgress 가 비면 5초 뒤 오는 슬레이브 스냅샷이
      // 통째로 재생돼 화면이 겹치고 게임이 저절로 시작된다. 앱이 상정한 완전 초기화는 새로고침뿐.
      // 재통보 방지 플래그를 남겨두므로 폰끼리 무한 초기화는 일어나지 않는다.
      // 자기 에코는 "서버까지 도달했다"는 확인 → 그때 비로소 새로고침한다.
      if (data.slaveID === '__reset__') {
        if (String(data.arduinoID || '').indexOf(_gmPhoneId) === -1) {
          console.log('[GM] 다른 폰 초기화 감지 → 이 폰도 새로고침');
          _gmSetResetSentFlag();   // 새로고침 후 되받아치는 통보 금지(무한루프 방지)
          _gmReloadNow();
        } else if (_gmPendingReload) { _gmPendingReload = false; _gmReloadNow(); }
        break;
      }
      // 내부 보고 채널(__time__ __status__ 등)은 게임 로직에 넣지 않음
      if (data.slaveID && data.slaveID.indexOf('__') === 0) break;
      if (data.updates) {
        data.updates.forEach(update => {
          _gmPinRemember(data.slaveID, data.arduinoID, update.pin, update.state);
          checkPinStatus(data.slaveID, data.arduinoID, update.pin, update.state);   // 실제 조작 → 항상 반영
        });
      }
      break;
    case 'slaveRegister':
      // 슬레이브는 5초마다 재등록하며 전체 핀 스냅샷을 다시 뿌린다.
      // 스냅샷은 "지금 걸려 있는 상태"일 뿐 새 조작이 아니다 → 값이 바뀐 핀만 게임 로직에 넣는다.
      // (처음 보는 핀은 기억만 한다. 안 그러면 새로고침 직후 걸려 있던 핀이 한꺼번에 재생돼
      //  화면이 겹치고 게임이 저절로 시작된다.)
      if (data.arduinos) {
        data.arduinos.forEach(arduino => {
          (arduino.pins || []).forEach(pin => {
            if (_gmPinChanged(data.slaveID, arduino.arduinoID, pin.pin, pin.state)) {
              checkPinStatus(data.slaveID, arduino.arduinoID, pin.pin, pin.state);
            }
          });
        });
      }
      break;
    case 'pin_change':
      // 테스트 모드에서 받은 핀 변경 이벤트
      if (data.data) {
        checkPinStatus(data.data.slaveID, data.data.arduinoID, data.data.pinNumber, data.data.state);
      }
      break;
    case 'timeSync':
      // GM 뷰어에서 보낸 타이머 세팅 (남은 초). timeSync 메시지가 올 때만 실행 — 평소 게임 영향 없음
      if (data.seconds != null && typeof timeRemaining !== 'undefined') {
        timeRemaining = parseInt(data.seconds);
        if (typeof startTimer === 'function') startTimer();
        else if (typeof updateTimerDisplay === 'function') updateTimerDisplay();
      }
      break;
  }
}

// 테스트 모드 초기화
function initTestMode() {
  console.log('테스트 모드 활성화');
  updateStatus('테스트 모드');

  // 연결 인디케이터 숨기기
  const indicator = document.getElementById('connectionIndicator');
  if (indicator) {
    indicator.style.display = 'none';
  }

  // BroadcastChannel 생성
  testChannel = new BroadcastChannel('pin_control_channel');

  testChannel.onmessage = function(event) {
    console.log('테스트 채널 메시지:', event.data);
    handleWebSocketMessage(event.data);
  };
}

// 상태 업데이트 (콘솔)
function updateStatus(message) {
  console.log('[상태]', message);
}

// GM 뷰어 시간 공유: 타이머가 도는 동안 10초마다 남은시간을 보고
// (simPin 채널 재사용, slaveID '__time__'은 게임 로직과 절대 안 겹침 → 게임 무영향)
setInterval(() => {
  try {
    if (ws && ws.readyState === WebSocket.OPEN &&
        typeof timerInterval !== 'undefined' && timerInterval &&
        typeof timeRemaining !== 'undefined') {
      ws.send(JSON.stringify({ type: 'simPin', slaveID: '__time__', arduinoID: '__t__', pin: Math.max(0, Math.round(timeRemaining)), state: 'on' }));
    }
  } catch (e) {}
}, 10000);


// ── GM 뷰어: 개인 SNS / 개인 메시지(DM) 원격 활성화 + 상태 보고 ──
// 활성화는 터치(15탭/10탭)와 동일 동작을 함수로 재사용. 상태는 5초마다 뷰어로 보고.
function _gmActivateSNS(){
  try {
    var snsImg = document.getElementById('sns-button');
    if (snsImg) snsImg.src = 'assets/phone-img/SNS-activate.png';
    if (typeof isSNSActivated !== 'undefined') isSNSActivated = true;
    _gmLastBits |= 1;   // 원격/전파로 켠 것 → 되쏘지 않음
    console.log('[GM] SNS 원격 활성화');
  } catch(e){}
}
function _gmActivateDM(){
  try {
    if (typeof isSNSDMActivated !== 'undefined') isSNSDMActivated = true;
    var b = document.getElementById('snsDMBtn'); if (b) b.src = 'assets/sns-img/dm_button_new.png';
    var c = document.getElementById('no-dm'); if (c) c.style.display = 'none';
    var d = document.getElementById('dm-detail'); if (d) d.style.display = 'block';
    _gmLastBits |= 2;   // 원격/전파로 켠 것 → 되쏘지 않음
    console.log('[GM] DM 원격 활성화');
  } catch(e){}
}
function _gmBits(){
  return ((typeof isSNSActivated !== 'undefined' && isSNSActivated) ? 1 : 0)
       + ((typeof isSNSDMActivated !== 'undefined' && isSNSDMActivated) ? 2 : 0);
}
setInterval(function(){
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      // arduinoID 에 폰 식별자를 실어 보낸다 → 뷰어가 폰 대수를 셀 수 있음(서버 수정 불필요)
      ws.send(JSON.stringify({ type:'simPin', slaveID:'__status__', arduinoID:'snsdm-' + _gmPhoneId, pin: _gmBits(), state:'on' }));
    }
  } catch(e){}
}, 5000);


// ── 폰 2대 공유 상태: 이 폰에서 터치로 켠 SNS/DM 을 다른 폰·뷰어에도 전파 ──
// app.js 터치 핸들러를 건드리지 않고 플래그 변화(0→1)만 감시해서 __snsctl__ 로 알린다.
// 켜짐(ON)만 전파한다. isSNSDMActivated 는 DM 탭을 열면 스스로 꺼지는 "알림 떴음" 플래그라,
// 꺼짐까지 맞추면 한쪽이 DM 을 읽을 때 다른 폰 알림을 지워버린다.
var _gmLastBits = 0;
setInterval(function(){
  try {
    var bits = _gmBits();
    var turnedOn = bits & ~_gmLastBits;
    _gmLastBits = bits;
    if (turnedOn && ws && ws.readyState === WebSocket.OPEN) {
      if (turnedOn & 1) ws.send(JSON.stringify({ type:'simPin', slaveID:'__snsctl__', arduinoID:'ctl-' + _gmPhoneId, pin:1, state:'on' }));
      if (turnedOn & 2) ws.send(JSON.stringify({ type:'simPin', slaveID:'__snsctl__', arduinoID:'ctl-' + _gmPhoneId, pin:2, state:'on' }));
      console.log('[GM] 로컬 활성화 전파 (bits ' + turnedOn + ')');
    }
  } catch(e){}
}, 1000);


// (v135) 소프트 리셋(_gmSoftReset)은 제거했다.
// resetScreen 은 pinProgress 만 비울 뿐이라, 5초마다 오는 슬레이브 스냅샷이 그 빈 자리를 채우며
// 진행을 통째로 재생해버렸다(화면 겹침 + 자동 시작). 원격 초기화도 새로고침으로 통일한다.


// ── GM 뷰어: 폰 프로그램 초기화 통보 ──
// 폰을 초기화(10탭 새로고침 / resetScreen)하면 뷰어도 전기능을 처음 준비상태로 되돌린다.
// simPin 채널 재사용, slaveID '__reset__'은 게임 로직과 안 겹침(폰 쪽은 '__' 접두 가드로 무시).
//   pin 1 = 프로그램 초기화(새로고침·부팅)   pin 2 = resetScreen() 호출
function _gmAnnounceReset(kind){
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      // arduinoID 에 보낸 폰 식별자를 실어 자기 에코를 구분한다
      ws.send(JSON.stringify({ type:'simPin', slaveID:'__reset__', arduinoID:'boot-' + _gmPhoneId, pin: kind, state:'on' }));
      console.log('[GM] 초기화 통보 전송 (kind=' + kind + ')');
    }
  } catch(e){}
}

// ── 슬레이브 스냅샷(5초마다 반복) 재생 차단 ──
// 핀별 마지막 상태를 기억해두고, 스냅샷에서 값이 "바뀐" 핀만 게임 로직에 넘긴다.
var _gmPinSeen = Object.create(null);
function _gmPinKey(s, a, p){ return s + '/' + a + '/' + p; }
function _gmPinRemember(s, a, p, st){ _gmPinSeen[_gmPinKey(s, a, p)] = st; }
function _gmPinChanged(s, a, p, st){
  var k = _gmPinKey(s, a, p);
  var known = (k in _gmPinSeen), prev = _gmPinSeen[k];
  _gmPinSeen[k] = st;
  return known && prev !== st;   // 처음 보는 핀은 기억만 하고 흘려보낸다
}

// 10탭 새로고침을 "통보 먼저, 새로고침 나중"으로 바꾸기 위한 상태
var _gmPendingReload = false, _gmReloadTimer = null;
function _gmReloadNow(){
  try { if (_gmReloadTimer) { clearTimeout(_gmReloadTimer); _gmReloadTimer = null; } } catch(e){}
  try { location.reload(); } catch(e){}
}
// 새로고침을 넘어 "이미 통보했음"을 전달 (sessionStorage 는 reload 를 견딘다)
function _gmSetResetSentFlag(){
  try { sessionStorage.setItem('_gmResetSent', '1'); } catch(e){}
}
function _gmTakeResetSentFlag(){
  try {
    if (sessionStorage.getItem('_gmResetSent')) { sessionStorage.removeItem('_gmResetSent'); return true; }
  } catch(e){}
  return false;
}

// 개발자 헬퍼 resetScreen()도 초기화로 간주 — app.js가 나중에 로드되므로 load 시점에 감싼다.
// 원본은 _gmOrig 로 보관: 원격 초기화(_gmSoftReset)는 원본을 호출해 재통보를 막는다.
window.addEventListener('load', function(){
  try {
    if (typeof window.resetScreen === 'function' && !window.resetScreen._gmWrapped) {
      var _origResetScreen = window.resetScreen;
      window.resetScreen = function(){
        var r = _origResetScreen.apply(this, arguments);
        _gmAnnounceReset(2);
        return r;
      };
      window.resetScreen._gmWrapped = true;
      window.resetScreen._gmOrig = _origResetScreen;
    }
  } catch(e){}

  // ── 좌측 하단 10탭: 다른 폰·뷰어를 "즉시" 초기화한 뒤에 이 폰을 새로고침 ──
  // app.js 의 10탭 핸들러는 바로 location.reload() 를 부른다. 그러면 통보가 나가기도 전에
  // 페이지가 날아가서, 새로고침 후 "웹소켓모드" 버튼을 눌러 재접속한 다음에야 초기화가 전파됐다.
  // 이 스크립트는 app.js 보다 먼저 로드되므로(index.html 순서) 같은 영역의 클릭 리스너도 먼저 붙는다.
  // → 우리가 먼저 받아서 app.js 핸들러를 stopImmediatePropagation 으로 막고 순서를 뒤집는다.
  try {
    var area = document.getElementById('refreshTouchArea');
    if (area && !area._gmTapBound) {
      area._gmTapBound = true;
      var taps = 0, tapTimer = null;
      area.addEventListener('click', function(ev){
        // app.js 의 즉시 reload 핸들러를 막는다 (이제 새로고침은 우리가 책임진다)
        try { if (ev && ev.stopImmediatePropagation) ev.stopImmediatePropagation(); } catch(e){}
        taps++;
        if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; }
        if (taps < 10) { tapTimer = setTimeout(function(){ taps = 0; }, 2000); return; }
        taps = 0;
        console.log('[GM] 10탭 — 다른 폰·뷰어 먼저 초기화 후 새로고침');
        try {
          _gmSetResetSentFlag();     // 새로고침 후 중복 통보 방지
          _gmPendingReload = true;
          _gmAnnounceReset(1);       // 다른 폰 + 뷰어 즉시 초기화
        } catch(e){}
        // 서버 에코가 오면 그 즉시, 안 오면 1.5초 뒤에 새로고침(연결이 끊겨 있어도 반드시 새로고침)
        _gmReloadTimer = setTimeout(function(){ _gmPendingReload = false; _gmReloadNow(); }, 1500);
      });
    }
  } catch(e){}
});
