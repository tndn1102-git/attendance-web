# K의 나라 — 팔도 여행 편 (game-src)

시안(`docs/restructure/시안.html`)을 본 게임으로 옮긴 소스. 빌드 결과는 `game/index.html` + `game/img/p/*.webp`.
이전 노리개(DM) 편은 `docs/game-v1-dm/` 에 그대로 보관.

## 파일
| 파일 | 하는 일 |
|---|---|
| `app.html` | 게임 화면·로직(한 파일). 문구는 모두 `L('한국어 원문')` 로 감싼다 |
| `content.json` | 카드 96·엔딩 36·미니게임 8·추천 코스 115·사진 경로 (`extract-content.mjs` 가 시안에서 뽑음, 엔딩 문구 보정 포함) |
| `i18n/source.json` | 번역할 한국어 원문 목록 (`build.mjs --strings`) |
| `i18n/{en,ja,zh,es}.json` | `{ "한국어 원문": "번역" }` |
| `photos.mjs` | 검수된 사진(docs/restructure/photos.json)을 받아 600px webp 로 → `game/img/p/` (외부 사진 서버 호출 0) |
| `e2e.mjs` | 헤드리스 크롬으로 8도 끝까지 자동 플레이 + 캡처(`.e2e/<lang>/`) + 가로 넘침 검사 |

## 다시 만들기
```
node game-src/photos.mjs            # 사진이 바뀌었을 때만
node game-src/extract-content.mjs   # 시안 카드·엔딩이 바뀌었을 때만
node game-src/build.mjs --strings   # 문구를 더했으면 → 새 원문을 i18n/*.json 에 번역 추가
node game-src/build.mjs             # game/index.html 생성 (번역 빠진 수를 언어별로 알려 줌)
node server.js  &&  node game-src/e2e.mjs ko   # 로컬 시험 (en ja zh es 도)
```

## 통계 연동 (대시보드 호환)
방 id = 예전 그대로(전남 land · 경북 speech · 충청 life · 서울경기 story · 제주 island · 전북 field · 강원 mountain · 경남 sea),
컨셉 = beauty·mukbang·food·sight·travel·trad.
- 카드: 고름 `dm_ok` / 보였지만 안 고름 `dm_skip` (game=s1·s2·s3 장면, value=카드 이름, hits=현지인 추천 1)
- 미니게임: `play_start`·`play_clear`·`star`(hits=★0~3), 촬영 생략 `x_unplug`
- 방 끝: `gift`(kind=노리개 컨셉) · `room_done` · 8도 다 돌면 `all_done`
- 결산: `result` · `type_result`(kind=컨셉쌍, room=1위 도) · `x_ending`(kind=엔딩 키, value=칭호, hits=다녀온 도 수) · 코스 화면 `x_course`(room) · 노리개 수령 `x_goods`

## 설정 (`app.html` 의 CONFIG)
- `minDo: 4` — 결산 가능한 최소 도 수
- `staffPin: '2026'` — 출구 노리개 수령 확인용 (판마다 1회, 기기에 남지 않음)
