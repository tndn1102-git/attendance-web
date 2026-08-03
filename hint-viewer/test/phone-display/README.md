# 힌트폰 미션/디테일 표시 검증 (v140)

"플레이 중간중간 메인 미션과 미션 디테일 칸이 비어 있다"를 고친 뒤 회귀를 막기 위한 테스트.
실제 `app.js`를 브라우저에 띄우고 `checkPinStatus()`를 직접 구동해 **화면에 실제로 보이는지**
(계산된 `display`·`opacity`)를 본다.

## 돌리는 법

`npm test`에는 안 붙였다 — Playwright가 이 저장소의 의존성이 아니고(다른 프로젝트 것을 빌려 쓴다)
한 번 도는 데 3분쯤 걸린다. 표시 로직을 건드렸을 때만 수동으로 돌린다.

```bash
node test/phone-display/assets.test.mjs       # 참조 이미지 존재 + v139와 이미지 집합 대조 (즉시)
node test/phone-display/overlap.test.mjs      # 단계 겹침·스냅샷 재생 (약 2분)
node test/phone-display/playthrough.test.mjs  # 정상 플레이 20단계 회귀 (약 3분)
```

- 대상은 로컬 미러 `D:\test3\hint-phone` (= 라이브와 같은 파일). 정적 서버를 띄워 로드한다.
- Playwright는 `D:\test3\fantastrick-homepage\node_modules`에서 빌려 쓴다.

## 무엇을 지키는 테스트인가

| 테스트 | 지키는 것 |
|---|---|
| overlap A·B | 안전가옥 ①→② 를 0.6초 안에 연속 태그해도 미션이 안 지워진다 (원래 버그) |
| overlap C | 게임 도중 재시작 → 스냅샷 재생이 **도착 순서가 아니라 진행 순서**로 최종 단계를 그린다 |
| overlap D·E | 늦게 터지는 예약(15~30초)이 최신 미션을 옛것으로 되돌리지 않는다 |
| overlap F | 화면 표시가 취소돼도 **SNS 개방(sideEffect)** 은 반드시 실행된다 |
| overlap G | 엔딩 뒤에 미션이 뒤늦게 다시 뜨지 않는다 |
| playthrough | 20단계 전부 규격대로의 mission/details/location/inprogress + SNS 개방·종료 |

⚠ 단계 순서를 바꾸거나 새 단계를 넣으면 `app.js`의 `rank`(뷰어 `statemachine.js`의 STEPS 순서와 동일)도
같이 고쳐야 한다. 스냅샷 따라잡기가 이 값으로 "어느 단계가 더 진도가 나갔는지"를 판단한다.
