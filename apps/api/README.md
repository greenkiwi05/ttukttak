# apps/api — 백엔드 (예정, 아직 비어 있음)

지금은 모든 도구가 브라우저에서만 동작하므로 백엔드 코드는 없다.
서버가 꼭 필요한 기능이 생기면 여기에 만든다.

## 정해 둔 방향
- 런타임: Cloudflare Workers (+ 필요하면 Hono), DB가 필요하면 D1
- 시작할 때: `apps/api/package.json` 생성 → 루트 `package.json`의 `workspaces`에 `apps/api` 추가
- 비밀 값(API 키 등): 로컬은 `apps/api/.dev.vars`(gitignore됨), 배포는 `wrangler secret put` — **코드·커밋에 절대 넣지 않는다**
- 프론트(`apps/web`)와 공유할 로직이 생기면 그때 `packages/shared`를 만든다
- 백엔드를 쓰는 기능은 페이지에 "서버를 거친다"는 사실을 명시한다 (파일 변환 도구는 계속 브라우저 처리 원칙 유지)
