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
      _gmAnnounceReset(1);
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
      // 다른 폰(또는 뷰어)의 초기화 통보 → 이 폰도 초기화. 자기 에코는 무시.
      if (data.slaveID === '__reset__') {
        if (String(data.arduinoID || '').indexOf(_gmPhoneId) === -1) _gmSoftReset();
        break;
      }
      // 내부 보고 채널(__time__ __status__ 등)은 게임 로직에 넣지 않음
      if (data.slaveID && data.slaveID.indexOf('__') === 0) break;
      if (data.updates) {
        data.updates.forEach(update => {
          checkPinStatus(data.slaveID, data.arduinoID, update.pin, update.state);
        });
      }
      break;
    case 'slaveRegister':
      if (data.arduinos) {
        data.arduinos.forEach(arduino => {
          arduino.pins.forEach(pin => {
            checkPinStatus(data.slaveID, arduino.arduinoID, pin.pin, pin.state);
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


// ── 다른 폰/뷰어의 초기화 통보를 받았을 때: 새로고침 없이 이 폰만 초기화 ──
// location.reload() 를 쓰면 연결모드 선택 모달이 떠서 사람이 또 만져야 하고,
// 부팅 통보가 다시 나가 폰끼리 무한 초기화가 된다. 그래서 소프트 리셋 + 재통보 없음.
function _gmSoftReset(){
  try {
    var fn = (window.resetScreen && window.resetScreen._gmOrig) || window.resetScreen;
    if (typeof fn === 'function') fn();          // 화면·타이머·pinProgress 초기화 (app.js)
    // resetScreen 이 안 건드리는 SNS/DM 상태를 여기서 되돌린다
    if (typeof isSNSActivated !== 'undefined') isSNSActivated = false;
    if (typeof isSNSDMActivated !== 'undefined') isSNSDMActivated = false;
    var s = document.getElementById('sns-button'); if (s) s.src = 'assets/phone-img/SNS-deactivate.png';
    var b = document.getElementById('snsDMBtn');   if (b) b.src = 'assets/sns-img/dm_button.png';
    var c = document.getElementById('no-dm');      if (c) c.style.display = '';
    var d = document.getElementById('dm-detail');  if (d) d.style.display = 'none';
    _gmLastBits = 0;
    console.log('[GM] 다른 폰 초기화 감지 → 이 폰도 초기화');
  } catch(e){}
}


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
});
