# knara-stats — 「K의 나라」 운영 통계 사이트

청와대 사랑채 국민화합 체험형 문화 프로그램 「K의 나라」(모바일 웹 미니게임 63종)의 **운영 통계**:
수집 스니펫(`track.js`) + 수집/집계 API + Postgres + 발주처용 대시보드 + 납품 문서.

- 개인정보·IP 미수집(제안서 11장 약속). 세션 id 무작위.
- 지출 0원 경로: Vercel Hobby + Neon Free, 또는 발주처 서버의 Node 하나 + Postgres.
- 대시보드는 의존성 없는 정적 HTML/JS 한 벌, 한국어, 접속 키 보호, 기간 필터, CSV, A4 인쇄 보고서, 1366×768·구형 엣지 호환.

```
앱(index.html) ─ track.js ─ POST /api/track ─► lib/ingest.js ─► Postgres (knara_sessions · knara_events · knara_logs)
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
| `lib/http.js` | 라우터. **Vercel 함수와 독립 서버가 같은 핸들러를 감싼다** |
| `lib/ingest.js` | 수집 검증·정규화·적재(화이트리스트, 시계 보정, (sid,seq) 중복 제거) |
| `lib/stats.js` | 집계(Postgres/SQLite 공통 SQL + Node 분위수·판정), CSV 내보내기, 보존기간 정리 |
| `lib/db.js` | DB 어댑터: `postgres://` → `pg`, `sqlite:` → `node:sqlite`(로컬 검증·폴백). 스키마 자동 생성 |
| `lib/ua.js` | UA 파서(인앱 브라우저 감지) |
| `lib/catalog.js` | 놀이 63종·방 8개·역할 카탈로그(이름·조작·목표·제한시간). **type id 는 추정 → 연동 시 확인** |
| `lib/auth.js` · `lib/csv.js` | 접속 키 검사(timingSafeEqual) · CSV(BOM) |
| `api/*.js` | Vercel 서버리스 진입점 5개(track · log · stats · export · health) — 각 3줄 |
| `server.js` | 독립 Node 서버 진입점(정적 + API). 발주처 서버·로컬용 |
| `scripts/seed.js` | 현실적 가짜 데이터(며칠치·수백 세션·도별/놀이별 편차·실패·교체·기기·오류·스태프)를 실제 HTTP 로 전송 + 정답 저장 |
| `scripts/verify.js` | 정답 ↔ `/api/stats` 대조(88항목) |
| `scripts/screenshots.js` | 크롬 headless 로 모든 화면 캡처 + A4 PDF |
| `scripts/smoke-db.js` | Neon/Postgres 연결·스키마·적재·집계 점검 |
| `scripts/purge.js` | 보존기간 정리 |
| `scripts/lint.js` | 구형 엣지/ES5 호환 구문 검사 |
| `docs/` | README(이 문서) · 연동가이드 · 운영가이드 · 데이터명세 · 개인정보처리설명 · screenshots/ |

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

## 로컬 실행 (Postgres 없이)

```powershell
cd D:\test3\knara-stats
npm install                       # pg 하나만 설치
$env:DATABASE_URL="sqlite:./data/knara.db"; $env:STATS_KEY="아무-긴-문자열"; node server.js
# → 대시보드 http://localhost:8787  (접속 키 입력 또는 /?key=아무-긴-문자열)
# → 입장 페이지 http://localhost:8787/entry/  (?hl=en 언어 지정, ?staff 스태프)
```

검증 한 바퀴(시드 → 대조 → 스크린샷):

```powershell
node scripts/seed.js --sessions 420 --days 10      # 약 4분(HTTP 로 실제 전송)
$env:STATS_KEY="아무-긴-문자열"; node scripts/verify.js
node scripts/screenshots.js                         # docs/screenshots/*.png + 13-report-A4.pdf
npm run check                                       # 문법 + 호환 린트
```

## 환경변수

| 키 | 필수 | 뜻 |
|---|---|---|
| `DATABASE_URL` | ✔ | `postgres://…?sslmode=require`(Neon) 또는 `sqlite:./data/knara.db`(로컬). 미설정이면 기동 거부 |
| `STATS_KEY` | ✔ | 대시보드·집계 API 접속 키. 16자 이상 무작위 권장(`node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"`). 미설정이면 통계 API 전부 503 |
| `TRACK_TOKEN` | 선택 | 설정 시 앱 `window.KSTAT.token` 과 같아야 적재(잡음 차단) |
| `EXHIBIT_START` / `EXHIBIT_END` | 선택 | 대시보드 "전시기간" 버튼 범위. 기본 `2026-11-02` ~ 오늘 |
| `PORT` | 선택 | 독립 서버 포트(기본 8787) |

## 배포 A — Cloudflare Workers + D1 (현재 운영 경로)

파일 역할: `worker.js`(진입점: 정적은 Assets, `/api/*` 는 `lib/http.js`) · `wrangler.jsonc`(이름·D1 바인딩·vars) · `.assetsignore`(올리지 않을 파일) · `_headers`(noindex·track.js CORS) · `lib/db.js` 의 `useD1()`(D1 어댑터, SQLite 방언).

1. `wrangler login` (tndn1102@gmail.com 계정) — 이미 로그인돼 있으면 생략.
2. 처음 한 번: `wrangler d1 create knara-stats` → 출력된 `database_id` 를 `wrangler.jsonc` 의 `d1_databases` 에.
3. 배포: `wrangler deploy` → 주소 `https://knara.tndn1102.workers.dev`
4. 접속 키: `wrangler secret put STATS_KEY` (16자 이상 무작위. `node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"`). 바꾸면 담당자에게 새 링크 전달.
5. 확인: `/api/health` → `{"ok":true,"db":"d1","key_set":true}` · 대시보드 `/?key=<STATS_KEY>` · 입장 `/entry/`.
6. 데이터 직접 보기·백업:
   ```powershell
   wrangler d1 execute knara-stats --remote --command "SELECT count(*) AS sessions FROM knara_sessions"
   wrangler d1 export knara-stats --remote --output backup-$(Get-Date -Format yyyyMMdd).sql
   ```
7. 한도 감각: Workers 무료 10만 요청/일, D1 무료 읽기 500만 행/일·쓰기 10만 행/일·5GB. 세션당 요청 2~4건이라 하루 1,000세션도 여유. (이 계정은 Workers 유료 플랜이라 한도가 더 크다.)
8. `vercel.json`·`api/` 는 없앴다. Vercel 로 되돌리려면 Postgres(Neon 등)가 필요하다 — `lib/db.js` 의 `initPg` 는 남겨 두었다.

## 배포 B — 발주처(또는 앱이 올라간) 서버

Node 22.5+ 와 Postgres 만 있으면 된다. `lib/` 는 두 배포에서 동일 파일.

```bash
git clone … knara-stats && cd knara-stats && npm ci --omit=dev
cp .env.example .env   # DATABASE_URL, STATS_KEY 채우기
node server.js         # :8787
```
- 리버스 프록시(nginx) 예: `location /stats/ { proxy_pass http://127.0.0.1:8787/; }` → 대시보드 `https://도메인/stats/`, 수집 `https://도메인/stats/api/track`.
  (하위 경로로 올리면 `index.html` 의 `assets/` 상대경로와 `dash.js` 의 `/api/...` 절대경로 중 후자를 `api/...` 로 바꿔야 함 — 또는 서브도메인 `stats.도메인` 권장.)
- 상시 실행: systemd 서비스 또는 `pm2 start server.js --name knara-stats`. Windows 서버면 작업 스케줄러 "시작 시" + `node server.js`.
- Postgres 가 같은 서버면 `DATABASE_URL=postgres://user:pw@localhost:5432/knara` (TLS 자동 해제).
- 정리: `crontab` 월 1회 `node scripts/purge.js`.

## 보안 메모
- 수집 API 는 무인증·CORS 전면 허용(쓰기 전용, 익명). 잡음 차단이 필요하면 `TRACK_TOKEN`.
- 통계 API 는 키 필요. 키는 URL `?key=` 로 받아 즉시 주소에서 지우고 `sessionStorage` 에만 둠(헤더로 전송). 페이지에 `noindex`, 리퍼러 차단.
- 입력은 전부 길이·범위·문자집합 검증(`lib/ingest.js`). SQL 은 전부 파라미터 바인딩.

## 검증 결과 요약 (2026-10-11 3차 디자인 적용 후, 로컬 SQLite 폴백 — verify 109/109, 입장 페이지 실브라우저 시험 포함)
→ 최종 수치는 보고서(`docs/운영가이드.md` 하단 "검증 기록") 참조. Postgres 경로는 이 PC 에 Postgres 가 없어 **실 DB 로 미검증** — Neon 연결 뒤 `node scripts/smoke-db.js` 로 1분 안에 확인할 수 있게 해 두었다. SQL 은 두 방언 공통 부분집합만 쓰고 `pg` 파라미터 바인딩(`$n`)을 정본으로 작성했다.
