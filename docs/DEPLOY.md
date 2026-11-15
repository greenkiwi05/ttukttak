# 배포·운영 가이드 (사람이 직접 하는 일)

## 1. GitHub 저장소
- **public 저장소**로 만들기 → 이력서·경력기술서에 링크 가능한 포트폴리오가 된다.
- README에 라이브 주소, 기술 스택, Lighthouse 점수, 구조 설계 이유를 정리해 두면 좋다.

## 2. 도메인
- 후보: 얼마지(eolmaji), 뚝딱(ttukttak), 셈터(semteo) 등. 구매처에서 사용 가능 여부 확인.
- .com → Cloudflare Registrar(원가 판매, DNS 한곳 관리) / .kr → 가비아 등 국내 업체
- 구매 후 `apps/web/src/data/site.js`의 `url`, `apps/web/public/robots.txt`의 Sitemap 주소 교체

## 3. Cloudflare Workers (정적 자산)
설정 파일은 저장소 루트 `wrangler.jsonc` (빌드 결과 `apps/web/dist`를 정적 자산으로 배포, 서버 코드 없음).
1. Cloudflare 대시보드 → Workers & Pages → Create → GitHub 저장소 `ttukttak` 연결
2. Project name: `ttukttak` (wrangler.jsonc의 `name`과 같아야 함)
3. Build command: `npm run build` / Deploy command: `npx wrangler deploy` (기본값 그대로)
4. Node 버전은 루트 `.node-version`(24)을 따름. Astro 7은 Node 22.23 이상 필요
5. 배포 후 프로젝트 상단 **Domains** 탭에서 `ttukttaktools.com`, `www.ttukttaktools.com` 추가 (DNS·HTTPS 자동)
6. 이후 main 브랜치에 push하면 자동 배포, 다른 브랜치는 미리보기 배포
- 로컬 확인: `npm run build && npx wrangler deploy --dry-run`

## 4. 검색 등록
- Google Search Console: 도메인 속성 추가 → `https://도메인/sitemap-index.xml` 제출
- 네이버 서치어드바이저: 사이트 등록 → 사이트맵 제출 (소유 확인 메타태그는 `Base.astro` head에 추가)

## 5. AdSense
- 도구 6~8개 + 각 페이지 설명글·FAQ가 채워진 뒤 신청 (빈 페이지 위주면 거절됨)
- 기존 AdSense 계정에 사이트 추가 → 승인 후 `apps/web/src/data/site.js`의 `adsenseClient`에 `ca-pub-...` 입력
- 광고 단위 slot ID를 `ToolLayout.astro`의 `<AdSlot slot="..." />`에 넣기
- `apps/web/public/ads.txt` 파일 추가 (AdSense가 알려주는 한 줄)

## 6. 판단 시점
- 2~3개월 뒤 Search Console 노출 수 추이 확인 → 오르면 도구 추가, 정체면 키워드 재점검
