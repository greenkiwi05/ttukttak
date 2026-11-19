# apps/api — 백엔드 (Cloudflare Worker)

정적 사이트(`apps/web/dist`)와 같은 Worker로 배포된다. `wrangler.jsonc`의 `run_worker_first: ["/api/*"]` 때문에
`/api/*` 요청만 이 코드가 받고, 나머지는 바로 정적 자산으로 간다.

## 지금 있는 기능
| 주소 | 내용 | 데이터 |
|---|---|---|
| `GET /api/rates` | 최근 고시일 환율 (매매기준율·송금 환율, 전일 값) | 한국수출입은행 현재환율 API, KV `RATES`의 `rates:latest` |

- 갱신: 수출입은행은 영업일 11시 전후 하루 한 번 고시(일환율). 평일 KST 11:00~12:50 10분마다 + 17:00 cron → 오늘 값이 이미 있으면 건너뜀. KV가 비어 있으면 첫 요청 때 한 번 받아 온다.
- 실패해도 KV의 마지막 값을 계속 보여준다 (날짜 표시).

## 비밀 값
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
