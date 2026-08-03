# 8080 릴레이 서버 패치 — simPin(원격 조작) 추가

> **실제 `server.js`를 확보해 정확히 작성·로컬 통합테스트 완료(9/9 통과).**
> 패치본: [`server-patch/server.patched.js`](server-patch/server.patched.js)
> (원본과 **의미상 차이 = 아래 simPin 블록 + timeSync 블록**, 나머지 100% 동일)

## ⚠️ 매장에 적용된 것은 simPin **뿐**이다 (2026-08-02 확인)

매장에 가져간 `server.patched.zip`(07-28 16:22)에는 **timeSync 블록이 없다.** 그 블록은 47분 뒤
로컬 `.js` 에만 추가됐고 zip·이 문서를 다시 만들지 않았다. 그 결과 GM 뷰어의 시간 적용이
**서버에서 조용히 버려져** "뷰어와 태블릿 시간이 다르다" 사고가 났다.

**→ 지금은 서버 패치가 필요 없다.** 힌트폰 v139부터 시간 세팅은 **이미 적용돼 있는 simPin 채널**
(`__settime__`)로 간다. 아래 timeSync 블록은 **선택 사항**(있으면 그 경로로도 도달, 동작 동일).

## 중요: 모니터링은 서버 패치가 **필요 없다**

이 서버(`broadcastToMasters`)는 `type==='master'`인 **모든** 클라이언트에 브로드캐스트한다 → **다중 master 허용**.
뷰어가 master로 하나 더 붙어도 **실폰은 안 끊긴다(kick 없음)**. 그래서:

- **진행 모니터링(보기)** = 서버 **무수정·무재시작**. 지금 손님 플레이 중에도 안전.
- **원격 조작(힌트 강제)** = 아래 simPin 패치 + **재시작 1회(손님 없을 때)** 필요.

이유: 현재 master는 슬레이브에 `command`(=물리 아두이노 작동)만 보낼 수 있고, **폰을 "가짜 핀"으로 진행시키는 통로가 없다.** simPin은 슬레이브의 `update`인 척 모든 master(폰 포함)에 브로드캐스트해 폰을 진행시킨다. **물리 아두이노는 건드리지 않는다.**

## 추가되는 코드 (server.js `update` 블록 바로 아래)

```js
// ===== [추가] GM 뷰어 원격 조작: 가짜 핀 주입 =====
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
// ===============================================
```

그리고 **선택 사항**(v139부터는 없어도 됨) — GM 뷰어 시간 세팅의 두 번째 경로:

```js
// GM 뷰어 → 손님 폰 타이머 세팅
if (data.type === 'timeSync') {
  broadcastToMasters({ type: 'timeSync', seconds: parseInt(data.seconds) });
  logWithTime(`[TIME] 시간 동기화 → ${data.seconds}s`);
}
```

- 순수 추가(additive). 기존 slave/master/command/HTTP 경로는 **한 줄도 안 바뀜.**
- ⚠️ **패치본을 고쳤으면 `server.patched.zip` 도 반드시 다시 만들 것.** 매장에 실제로 들고 가는 건 zip이다.

## 적용 절차 (매장 릴레이 PC · **손님 없을 때**)

1. **백업**: `server.js` → `server.js.bak-20260728` 로 복사
2. **교체**: `server.patched.js` 내용으로 `server.js` 덮어쓰기 (또는 위 블록만 붙여넣기)
3. **재시작**: 서버 프로세스 종료 후 다시 시작(원래 켜던 방식 — start.bat / `node server.js` 등)
   - 재시작 순간 폰 ws가 몇 초 끊겼다가 **자동 재접속**됨(정상)
4. **이상 시 원복**: `server.js.bak-20260728` 를 되돌리고 재시작

> ⚠️ 재시작 방법이 불확실하면, 먼저 `힌트폰-서버찾기2.txt`의 [블록1]로 **부모 프로세스(런처)** 를 확인. start.bat이면 그걸로 껐다 켜면 됨.

## 로컬 통합테스트 결과 (server.patched.js 대상, 9/9)
- ★ 다중 master: 뷰어 접속해도 실폰 연결 유지(kick 없음)
- master 접속 시 slaveList 스냅샷 수신 / slaveRegister·update 브로드캐스트 정상
- ★ simPin: 뷰어 → 서버 → **폰이 update 수신(진행)**; 뷰어 화면도 일관
- simPin은 **슬레이브(물리 아두이노)로 안 감** — 안전
