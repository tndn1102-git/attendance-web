# knara-stats — 「K의 나라」 운영 통계 사이트

청와대 사랑채 국민화합 체험형 문화 프로그램 「K의 나라」(노리개 편 모바일 웹 게임)의 **운영 통계**:
수집 스니펫(`track.js`) + 수집/집계 API + Cloudflare D1 + 대시보드.
게임은 발주처 납품물이고, **통계 사이트는 납품하지 않고 판타스트릭이 직접 보며 운영한다.**

- 개인정보·IP 미수집(제안서 11장 약속). 세션 id 무작위.
- 호스팅·DB = Cloudflare Workers + D1 한 곳뿐(유료 플랜 사용 중). 다른 DB 는 쓰지 않는다.
- 보존: 수집 120일 뒤 `npm run wipe -- --yes` 로 **전부 수동 삭제**(자동 정리 없음).
- 대시보드는 의존성 없는 정적 HTML/JS 한 벌, 한국어, 접속 키 보호, 기간 필터, CSV, A4 인쇄 보고서, 1366×768·구형 엣지 호환.

```
앱(index.html) ─ track.js ─ POST /api/track ─► lib/ingest.js ─► D1 (knara_sessions · knara_events · knara_logs)
                                                                      ▲
대시보드(index.html + assets/) ─ GET /api/stats · /api/export ─ lib/stats.js ──┘   (접속 키 필요)
```

## 폴더

| 경로 | 역할 |
|---|---|
| `track.js` | 수집 스니펫(ES5). 오프라인 큐·배치·중복 제거 번호(seq)·오류 후킹·WebGL 손실 감지·동의/opt-out(`kstat:optout`)·세션 인계(`?sid=&s0=`, `handoffUrl()`) |
| `scripts/entry-editor.js` (+ `-client.js`) | 입장 페이지 **문구 편집기**(로컬). `npm run edit-entry` → 브라우저에서 글자 수정 → 저장 → 배포 |
| `entry/index.html` | **입장 페이지**(QR → 안내·동의·언어·나이대·성별 → 게임). 상단 `CONFIG` 로 게임 주소·동의 버전·미동의 입장 허용·발주처 표기 설정. 5개 언어(ko 원문, 나머지 검수 필요) |
| `assets/theme.css` | 디자인 토큰·공용 컴포넌트(게임 컨셉: 한지·먹·오방색·놋쇠, Hahmlet/Gowun Batang/Noto Sans KR). 입장·대시보드·보고서 공통. 사양 = `docs/디자인가이드.md` |
| `index.html` · `assets/dash.js` · `assets/dash.css` · `assets/print.css` | 대시보드(정적). 탭 3개: 개요(총 방문자·완주율·오늘 + 나이대·성별·언어·기기 % + 일별) · 놀이별(도·놀이·유형·성공률·시도 5열) · 내보내기/인쇄(CSV 8종 + A4 3쪽) + 오른쪽 끝 "자세히"(동의율·시간대·노리개·기기 전체·센서·퍼널·도별·오류·스태프 포함 체크) |
| `worker.js` | 운영 진입점(Cloudflare Workers). 정적은 Assets, `/api/*` 는 `lib/http.js` |
| `lib/http.js` | 라우터. 운영(`worker.js`)과 로컬 시험 서버(`server.js`)가 같은 핸들러를 감싼다 |
| `lib/ingest.js` | 수집 검증·정규화·적재(화이트리스트, 시계 보정, (sid,seq) 중복 제거) |
| `lib/stats.js` | 집계(SQLite 방언 SQL + Node 분위수·판정), CSV 내보내기 |
| `lib/db.js` | DB 어댑터: 운영 = D1(`useD1`), 로컬 시험 = `node:sqlite`(같은 SQLite 방언). 스키마 자동 생성 |
| `lib/ua.js` | UA 파서(인앱 브라우저 감지) |
| `lib/catalog.js` · `lib/catalog-dm.js` | 방 8개·놀이 카탈로그 · 노리개 편 DM 75건(`node scripts/extract-dm-catalog.mjs` 로 게임에서 추출) |
| `lib/auth.js` · `lib/csv.js` | 접속 키 검사(timingSafeEqual) · CSV(BOM) |
| `server.js` | 로컬 시험 서버(정적 + API, DB = 로컬 SQLite 파일) |
| `scripts/seed.js` | 현실적 가짜 데이터(며칠치·수백 세션·도별/놀이별 편차·실패·교체·기기·오류·스태프)를 실제 HTTP 로 전송 + 정답 저장 |
| `scripts/verify.js` | 정답 ↔ `/api/stats` 대조(112항목) |
| `scripts/screenshots.js` | 크롬 headless 로 모든 화면 캡처 + A4 PDF |
| `scripts/wipe.mjs` | 운영 D1 전체 삭제(직전 사본을 `data/wipe-backup/` 에 저장). `npm run wipe` = 건수만, `-- --yes` = 삭제 |
| `scripts/lint.js` | 구형 엣지/ES5 호환 구문 검사 |
| `docs/` | README(이 문서) · 연동가이드 · 운영가이드 · 데이터명세 · 개인정보처리설명 · screenshots/ · client-report/(발주처 제작 보고서) |

## 현재 배포 (2026-10-11, 외부 접속 가능)

| 항목 | 값 |
|---|---|
| 대시보드 | https://knara.tndn1102.workers.dev (접속 키 = Worker 비밀 `STATS_KEY`, 로컬 사본 `.env`) |
| 손님 입장(동의) 페이지 | https://knara.tndn1102.workers.dev/entry/ — QR 은 이 주소. 열면 언어 선택 팝업이 먼저 뜬다. `?hl=en` 등 언어 지정 시 팝업 생략 |
| 수집 스니펫 | `https://knara.tndn1102.workers.dev/track.js` → 전송 `https://knara.tndn1102.workers.dev/api/track` |
| 상태 확인 | https://knara.tndn1102.workers.dev/api/health → `{"ok":true,"db":"d1","key_set":true}` |
| 호스팅 | Cloudflare Workers(계정 tndn1102@gmail.com) + Workers Static Assets. 워커 이름 `knara`, 진입점 `worker.js`, 설정 `wrangler.jsonc` |
| DB | Cloudflare D1 `knara-stats` (SQLite, 바인딩 `DB`, id `fe4a6176-4a6d-409b-abe6-ef7381b633f2`). 테이블은 첫 요청 때 자동 생성 |
| 재배포 | `cd D:\test3\knara-stats; wrangler deploy` (정적 파일은 `.assetsignore` 에 적힌 것 빼고 전부 올라감 — lib·docs·data·설정·.env 제외) |

## 로컬 실행 (시험용)

운영 DB 는 D1 뿐이다. 로컬에선 D1 과 같은 SQLite 방언을 Node 내장 `node:sqlite` 파일로 흉내 내 시험한다(설치할 것 없음).

```powershell
cd D:\test3\knara-stats
npm install                       # 런타임 의존성 없음(wrangler 만 npx 로 사용)
node server.js                    # .env 의 DATABASE_URL=sqlite:./data/knara.db, STATS_KEY 사용
# → 대시보드 http://localhost:8787  (접속 키 입력 또는 /?key=…)
# → 입장 페이지 http://localhost:8787/entry/  (?hl=en 언어 지정, ?staff 스태프)
```

검증 한 바퀴(시드 → 대조 → 스크린샷). 빈 DB 에서 돌려야 정답과 맞는다(`DATABASE_URL=sqlite::memory:` 로 서버를 띄우면 편하다):

```powershell
node scripts/seed.js --sessions 420 --days 10      # 약 4분(HTTP 로 실제 전송)
$env:STATS_KEY="…"; node scripts/verify.js           # 112항목
node scripts/screenshots.js                         # docs/screenshots/*.png + 13-report-A4.pdf
npm run check                                       # 문법 + 호환 린트
```

## 환경변수

| 키 | 어디서 | 뜻 |
|---|---|---|
| `STATS_KEY` | 운영 = `wrangler secret put STATS_KEY` / 로컬 = `.env` | 대시보드·집계 API 접속 키. 미설정이면 통계 API 전부 503 |
| `TRACK_TOKEN` | 선택(비밀) | 설정 시 앱 `window.KSTAT.token` 과 같아야 적재(잡음 차단) |
| `EXHIBIT_START` / `EXHIBIT_END` | `wrangler.jsonc` vars | 대시보드 "전시기간" 버튼 범위. 기본 `2026-11-02` ~ 오늘 |
| `DATABASE_URL` | 로컬 `.env` 만 | `sqlite:./data/knara.db` 또는 `sqlite::memory:`. 운영에선 쓰지 않는다(D1 바인딩) |
| `PORT` | 로컬만 | 로컬 시험 서버 포트(기본 8787) |

## 배포 — Cloudflare Workers + D1

파일 역할: `worker.js`(진입점) · `wrangler.jsonc`(이름·D1 바인딩·vars) · `.assetsignore`(올리지 않을 파일) · `_headers`(noindex·캐시·track.js CORS) · `lib/db.js` 의 `useD1()`.

1. `wrangler login` (tndn1102@gmail.com 계정) — 이미 로그인돼 있으면 생략.
2. 배포: `wrangler deploy` (= `npm run deploy`) → `https://knara.tndn1102.workers.dev`. CF API 504 가 가끔 나는데 다시 돌리면 된다.
3. 접속 키 변경: `wrangler secret put STATS_KEY`.
4. 확인: `/api/health` → `{"ok":true,"db":"d1","key_set":true}` · 대시보드 `/?key=<STATS_KEY>` · 입장 `/entry/` · 게임 `/game/`.
5. 데이터 직접 보기·백업:
   ```powershell
   wrangler d1 execute knara-stats --remote --command "SELECT count(*) AS sessions FROM knara_sessions"
   wrangler d1 export knara-stats --remote --output backup-$(Get-Date -Format yyyyMMdd).sql
   ```
6. 한도: 계정이 Workers 유료 플랜이라 D1 은 월 쓰기 5천만 행·읽기 250억 행까지 포함(넘으면 소액 추가 과금). 하루 1천 세션이어도 월 수백만 행 수준이라 여유.

## 기록 삭제 (120일 뒤, 수동)

입장 화면 안내대로 수집 120일 뒤 전부 지운다. 자동 정리는 두지 않았다.

```powershell
cd D:\test3\knara-stats
npm run wipe              # 현재 건수만 보여 줌
npm run wipe -- --yes     # ① data/wipe-backup/knara-<날짜>.sql 사본 저장 ② 세션·이벤트·오류 3개 표 비우기
```
- 사본도 남기지 않으려면 `-- --yes --no-backup`. 사본은 개인정보가 없지만 필요 없어지면 파일을 지운다.
- 표 구조는 남으므로 지운 뒤에도 수집은 계속된다(전시 연장 시 그대로 사용).

## 보안 메모
- 수집 API 는 무인증·CORS 전면 허용(쓰기 전용, 익명). 잡음 차단이 필요하면 `TRACK_TOKEN`.
- 통계 API 는 키 필요(내부용). 키는 URL `?key=` 로 받아 즉시 주소에서 지우고 `sessionStorage` 에만 둠(헤더로 전송). 페이지에 `noindex`, 리퍼러 차단.
- 입력은 전부 길이·범위·문자집합 검증(`lib/ingest.js`). SQL 은 전부 파라미터 바인딩.

## 검증 기록
- 2026-10-13 저장소를 D1 하나로 정리(Postgres/Neon 경로·`pg` 의존성·purge·smoke-db 삭제, `wipe` 추가) 후 로컬 SQLite 로 verify **112/112**.
