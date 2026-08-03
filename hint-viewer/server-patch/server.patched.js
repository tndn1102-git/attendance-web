const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');

// ---------------------------
// 공통 로그 함수 (타임스탬프 포함)
// ---------------------------
function logWithTime(message) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
}

// ---------------------------
// WebSocket 서버 (8080)
// ---------------------------
const wss = new WebSocket.Server({ host: '0.0.0.0', port: 8080 });
const clients = new Map();

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  logWithTime(`새 클라이언트 연결: ${ip}`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const clientInfo = clients.get(ws);

      // 슬레이브 등록
      if (data.type === 'slaveRegister') {
        clients.set(ws, {
          type: 'slave',
          slaveID: data.slaveID,
          slaveNickname: data.slaveNickname,
          arduinos: data.arduinos || []
        });

        broadcastToMasters({
          type: 'slaveRegister',
          slaveID: data.slaveID,
          slaveNickname: data.slaveNickname,
          arduinos: data.arduinos
        });
      }

      // 마스터 등록
      if (data.type === 'master') {
        clients.set(ws, { type: 'master', id: 'master' });
        logWithTime('마스터 연결됨');
        ws.send(JSON.stringify({ type: 'slaveList', slaves: getSlaveList() }));
      }

      // 슬레이브 상태 업데이트
      if (data.type === 'update') {
        if (clientInfo?.type === 'slave') {
          logWithTime(`상태 업데이트 ← ${clientInfo.slaveID}/${data.arduinoID}`);
          broadcastToMasters({
            type: 'update',
            slaveID: clientInfo.slaveID,
            arduinoID: data.arduinoID,
            updates: data.updates
          });
        }
      }

      // ===== [추가] GM 뷰어 원격 조작: 가짜 핀 주입 =====
      // 뷰어(master로 접속)가 보낸 simPin을, 슬레이브가 보낸 update 인 것처럼
      // 모든 master(실폰 포함)에게 브로드캐스트한다. 물리 아두이노는 건드리지 않음.
      // 기존 slave/master/command 경로는 그대로 — 순수 추가(additive).
      if (data.type === 'simPin') {
        const pin = parseInt(data.pin);
        const state = data.state === 'off' ? 'off' : 'on';
        broadcastToMasters({
          type: 'update',
          slaveID: data.slaveID,
          arduinoID: data.arduinoID,
          updates: [{ pin, state }]
        });
        logWithTime(`[SIM] 핀 주입 → ${data.slaveID}/${data.arduinoID} pin ${pin} → ${state}`);
      }

      // GM 뷰어 → 손님 폰 타이머 세팅: 모든 master(폰 포함)에 timeSync 브로드캐스트
      if (data.type === 'timeSync') {
        broadcastToMasters({ type: 'timeSync', seconds: parseInt(data.seconds) });
        logWithTime(`[TIME] 시간 동기화 → ${data.seconds}s`);
      }
      // ===============================================

      // 슬레이브 아두이노 해제
      if (data.type === 'arduinoDisconnect') {
        if (clientInfo?.type === 'slave') {
          clientInfo.arduinos = clientInfo.arduinos.filter(a => a.arduinoID !== data.arduinoID);
          logWithTime(`아두이노 해제 ← ${data.slaveID}/${data.arduinoID}`);
          broadcastToMasters({
            type: 'arduinoDisconnect',
            slaveID: data.slaveID,
            arduinoID: data.arduinoID
          });
        }
      }

      // 마스터 → 슬레이브 명령 전송
      if (data.type === 'command') {
        if (clientInfo?.type === 'master') {
          logWithTime(`명령 전달 → 슬레이브: ${data.slaveID}/${data.arduinoID} 핀 ${data.pin} → ${data.command}`);
          sendToSlave(data.slaveID, {
            arduinoID: data.arduinoID,
            pin: data.pin,
            command: data.command
          });
        }
      }

    } catch (err) {
      logWithTime(`메시지 파싱 오류: ${err.message}`);
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      logWithTime(`${client.type} 연결 종료: ${client.slaveID || client.id}`);
      clients.delete(ws);
      if (client.type === 'slave') {
        broadcastToMasters({ type: 'slaveList', slaves: getSlaveList() });
      }
    }
  });
});

// 마스터에게 메시지 전송
function broadcastToMasters(data) {
  clients.forEach((client, ws) => {
    if (client.type === 'master' && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  });
}

// 슬레이브에게 메시지 전송
function sendToSlave(slaveID, data) {
  clients.forEach((client, ws) => {
    if (client.type === 'slave' && client.slaveID === slaveID && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      logWithTime(`→ 슬레이브 전송됨: ${slaveID}/${data.arduinoID} 핀 ${data.pin} → ${data.command}`);
    }
  });
}

// 슬레이브 목록 반환
function getSlaveList() {
  return Array.from(clients.entries())
    .filter(([_, client]) => client.type === 'slave')
    .map(([_, client]) => ({
      slaveID: client.slaveID,
      slaveNickname: client.slaveNickname,
      arduinos: client.arduinos
    }));
}

logWithTime('[8080] WebSocket 서버 실행 중');

// ---------------------------
// HTTP REST API 서버 (8090)
// ---------------------------
const app = express();
const httpPort = 8090;

app.use(bodyParser.json());

// 외부 HTTP 명령 → 마스터 UI에 전달
app.get('/command', (req, res) => {
  const { slaveID, arduinoID, pin, command } = req.query;

  if (!slaveID || !arduinoID || !pin || !command) {
    logWithTime('HTTP 요청 오류: 필수 파라미터 누락');
    return res.status(400).json({ error: '필수 파라미터 누락' });
  }

  const msg = {
    type: 'externalCommand',
    slaveID,
    arduinoID,
    pin: parseInt(pin),
    command
  };

  let sent = false;
  clients.forEach((client, ws) => {
    if (client.type === 'master' && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      sent = true;
    }
  });

  if (!sent) {
    logWithTime('HTTP 명령 실패: 연결된 마스터 없음');
    return res.status(503).json({ error: '연결된 마스터 없음' });
  }

  logWithTime(`HTTP 명령 전송됨 → ${slaveID}/${arduinoID} 핀 ${pin} → ${command}`);
  res.json({ status: '명령 전달 완료', msg });
});

app.listen(httpPort, () => {
  logWithTime(`[8090] HTTP REST API 서버 실행 중`);
});
