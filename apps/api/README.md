# apps/api — 백엔드 (Cloudflare Worker)

정적 사이트(`apps/web/dist`)와 같은 Worker로 배포된다. `wrangler.jsonc`의 `run_worker_first: ["/api/*"]` 때문에
`/api/*` 요청만 이 코드가 받고, 나머지는 바로 정적 자산으로 간다.

## 지금 있는 기능
| 주소 | 내용 | 데이터 |
|---|---|---|
| `GET /api/rates` | 최근 고시일 환율 (매매기준율·송금 환율, 전일 값) | 한국수출입은행 현재환율 API, KV `RATES`의 `rates:latest` |
| `GET /api/rates/day?date=YYYY-MM-DD` | 그날(없으면 직전 고시일) 전체 통화 환율 + 저장 기간 | D1 `DB`의 `rates` 테이블 |
| `GET /api/rates/history?code=USD&from=&to=` | 한 통화의 기간별 매매기준율 `[[date, base], ...]` | D1 `rates` |
| `GET /api/lotto` | 로또 전체 회차 번호 `[[회차, 날짜, n1..n6, 보너스], ...]` + 최신 회차 상세 | KV `lotto:all` (D1 `lotto`에서 만든 요약본) |
| `GET /api/holidays` | 공휴일 `{ years: { '2026': [{ date, name }] }, fetchedAt }` (2016년~내년) | KV `holidays:all` |
| `GET /api/solar-terms` | 24절기 `{ years: { '2026': [{ date, name, time, longitude }] } }` | KV `solarterms:all` |
| `GET /api/fuel` | 전국·시도별 평균 유가 `{ date, national: [{ code, name, price, diff }], sido: { B027: [...] } }` | KV `fuel:latest` (오피넷) |
| `GET /api/lotto/round?n=1250` | 한 회차 상세 (등수별 당첨자 수·당첨금, 판매액) | D1 `lotto` |

- 갱신: 수출입은행은 영업일 11시 전후 하루 한 번 고시(일환율). 평일 KST 11:00~12:50 10분마다 + 17:00 cron → 오늘 값이 이미 있으면 건너뜀. KV가 비어 있으면 첫 요청 때 한 번 받아 온다.
- 실패해도 KV의 마지막 값을 계속 보여준다 (날짜 표시).
- 과거 환율: 받은 값을 D1 `rates(date, code, unit, name, base, send, receive)`에 쌓는다. 테이블은 Worker가 `CREATE TABLE IF NOT EXISTS`로 직접 만든다.
- 과거 채우기: 매시 5분 cron이 KV `backfill:cursor` 날짜부터 거꾸로 25일씩 받아 `2016-01-01`까지 채운다 (하루 최대 600회, 다 채우면 호출 없음). 한도 초과·오류면 멈췄다가 다음 시간에 이어서.
- D1 조회 응답은 Cloudflare 캐시(Cache API)에 담아 같은 요청은 DB를 다시 읽지 않는다.
- 로또: 매시 35분 cron. 저장된 마지막 회차 < 지금쯤 나왔어야 할 회차(1회 2002-12-07 + 매주 토 21시)일 때만 동행복권을 부른다 → 평소 호출 0, 토요일 밤에만 몇 번.
  출처 주소는 동행복권 홈페이지 내부 조회 주소(`/lt645/selectPstLt645InfoNew.do`)라 공식 API가 아니다. 바뀌거나 막히면 `src/lotto.js`만 고친다. 실패 이유는 `/api/lotto` 503 응답의 reason에 나온다.

## 정기 작업 (일정표)
- **`src/schedule.js`** 한 곳에 모든 정기 작업의 시각(cron, UTC)·출처·필요한 키·호출량을 적는다. 내용은 `src/jobs.js`.
- `npm run schedule` 로 일정표를 표로 본다.
- 새 작업을 넣을 때: `jobs.js`에 함수 → `schedule.js`에 한 줄 → `wrangler.jsonc` `triggers.crons`에 cron 추가 (테스트가 둘을 비교).
- 한 cron의 `maxCalls` 합은 50 이하 (Cloudflare 무료 플랜 실행당 외부 요청 한도).

## 비밀 값
- `OPINET_KEY`: 오피넷 무료 API 인증키 (오피넷 홈페이지에서 신청). 없으면 주유비 계산기는 유가 직접 입력으로만 동작.
- `HOLIDAY_KEY`: 공공데이터포털 "한국천문연구원_특일 정보" 일반 인증키(**Decoding** 키). 배포는 EXIM_KEY와 같은 곳(Variables and Secrets, Secret).
  - 공휴일 갱신: 매시 5분 cron에서 없는 해 + 하루 한 번 올해·내년만 호출. 내년은 발표 전이면 빈 목록 → 저장 안 하고 다음에 다시 확인.
- `EXIM_KEY`: 한국수출입은행 Open API 인증키. **코드·커밋에 절대 넣지 않는다.**
  - 배포: Cloudflare 대시보드 → Workers → ttukttak → Settings → Variables and Secrets → `EXIM_KEY` (Secret)
  - 로컬: 루트에 `.dev.vars` 파일 (gitignore됨)에 `EXIM_KEY=...`
  - 개인정보 보유기간(2년)이 지나면 키가 파기된다 (result 3 = 인증키 오류). 만료 전 오는 "개인정보 수집 재동의" 메일에 동의하면 2년 연장. 파기됐으면 새로 발급받아 Secret 교체.
  - 하루 1000회 제한 (넘으면 result 4). 지금 구조는 하루 최대 십여 회만 부른다.

## 원칙
- 공개 데이터를 **받아 오기만** 한다. 사용자의 입력값·파일은 받지 않는다.
- 로직은 `src/*.js` 순수 함수 + `tests/*.test.js` (`npm test`가 같이 돌린다).
- 프론트(`apps/web`)와 파일을 서로 import하지 않는다. 공유가 필요해지면 `packages/shared`.

## 로컬 실행
`npm run build` 후 `npx wrangler dev` (한글 경로에서는 Node 24.11 버그로 wrangler가 멈출 수 있음 — 영문 경로에 복사해서 실행).
