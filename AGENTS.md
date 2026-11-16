# AGENTS.md — 뚝딱 (생활 도구 모음 사이트)

이 저장소에서 작업하는 모든 코딩 에이전트(Claude Code, Codex 등)가 먼저 읽는 문서다.
작업 목록은 `docs/TASKS.md`, 도구별 상세 스펙은 `docs/TOOLS.md`에 있다.

## 프로젝트 한 줄 요약
설치·가입 없이 브라우저에서 바로 쓰는 한국어 생활 도구(계산기 + 파일 변환) 모음.
수익은 Google AdSense, 유입은 검색(SEO). 운영자는 1명이라 **유지보수가 거의 없는 도구만** 만든다.

## 절대 원칙
1. **모든 처리는 브라우저에서.** 서버·API·DB 없음. 파일을 외부로 업로드하는 코드 금지. (사이트의 핵심 셀링 포인트: "파일이 서버로 안 올라감")
2. **정부 기준값(세율, 최저임금, 4대보험 요율, 소득기준 등)을 하드코딩하는 도구는 만들지 않는다.** 금리·시급처럼 바뀌는 값은 사용자가 입력하게 한다.
3. **로직과 UI 분리.** 계산·변환 로직은 `apps/web/src/lib/*.js` 순수 함수로 두고 `apps/web/tests/*.test.js`에 `node:test` 테스트를 붙인다. UI는 Vue 컴포넌트.
4. **SEO 우선.** 도구 페이지마다 설명글(guide)과 FAQ를 반드시 채운다. 계산기만 있는 빈 페이지는 AdSense 심사에서 떨어진다.
5. **가볍게.** 무거운 라이브러리(WASM 등)는 해당 도구 페이지에서만 동적 `import()`로 불러온다. 홈 화면 JS는 0에 가깝게 유지.
6. **비밀정보 커밋 금지 (public 저장소).** 비밀번호, DB 접속 정보, API 키·토큰, 개인키, 개인 이메일·전화번호 등은 코드·문서·테스트·커밋 메시지 어디에도 넣지 않는다. 필요하면 `.env`/`.dev.vars`(gitignore됨)나 Cloudflare 환경변수로 둔다. pre-commit 훅(`scripts/check-secrets.mjs`)이 검사하며, 훅을 `--no-verify`로 우회하지 않는다. 예시 값은 `example.com`, `XXXX` 같은 자리표시자만 쓴다.

## 기술 스택
- Astro 7 (정적 빌드) + `@astrojs/vue` (Vue 3 `<script setup lang="ts">`) + `@astrojs/sitemap`
- 스타일: `apps/web/src/styles/global.css` 하나 (CSS 변수). Tailwind 등 추가하지 않는다.
- 배포: Cloudflare Workers 정적 자산 (`wrangler.jsonc`, `npm run build` → `apps/web/dist/`), 백엔드도 추후 Workers

## 폴더 구조
npm workspaces 모노레포. 프론트와 백엔드를 폴더로 분리한다.
```
apps/
  web/                  프론트 (Astro 정적 사이트) — 아래 경로는 모두 apps/web 기준
    src/data/site.js          사이트 이름·도메인·AdSense ID (전역 설정)
    src/data/tools.js         도구 레지스트리 (홈, 추천 목록이 여기서 나옴)
    src/layouts/Base.astro    HTML 뼈대, meta/OG/canonical, AdSense 스크립트
    src/layouts/ToolLayout.astro  도구 페이지 공통 틀 (제목→도구→광고→설명→FAQ→다른 도구, JSON-LD 자동)
    src/components/AdSlot.astro   광고 자리 (AdSense ID 없으면 렌더링 안 함)
    src/components/DateInput.vue     공용 날짜 입력 (키보드 19980510·1998.5.10 + 연·월 선택 달력). 날짜 입력은 type="date" 대신 이걸 쓴다
    src/components/SiteHeader.astro  상단바 (카테고리 메뉴, CSS 드롭다운 · 모바일 가로 스크롤)
    src/pages/category/[key].astro  카테고리 페이지 (tools.js의 CATEGORIES에서 자동 생성)
    src/components/tools/*.vue    도구별 UI
    src/lib/*.js              도구별 순수 로직
    src/pages/tools/{slug}.astro  도구 페이지
    tests/*.test.js           로직 테스트 (node --test)
  api/                  백엔드 자리 (예정, 아직 비어 있음 — apps/api/README.md 참고)
scripts/check-secrets.mjs   커밋 전 비밀정보 검사 (pre-commit 훅)
docs/                   스펙·작업 목록·배포 가이드
```
- 프론트 코드는 `apps/web`, 백엔드 코드는 `apps/api`에만 둔다. 서로의 파일을 직접 import하지 않는다 (공유가 필요해지면 `packages/shared` 생성).
- 백엔드는 사용자가 따로 요청한 기능에만 만든다. 그 전까지 원칙 1(브라우저 처리)이 그대로 적용된다.

## 새 도구 추가 절차 (기준 예시: 만 나이 계산기)
1. `docs/TOOLS.md`에서 해당 도구 스펙 확인
2. `apps/web/src/lib/{name}.js`에 로직 작성 + `apps/web/tests/{name}.test.js` 테스트 (경계값 포함)
3. `apps/web/src/components/tools/{Name}.vue`에 UI 작성 (기존 CSS 클래스 `field`, `btn`, `result`, `big`, `sub`, `error` 재사용)
4. `apps/web/src/pages/tools/{slug}.astro` 생성: `ToolLayout`으로 감싸고 `<Name client:load />`, `guide` 슬롯 설명글 3~5문단, `faq` 4~6개
5. `apps/web/src/data/tools.js`에서 해당 도구 `status: 'live'`로 변경
6. `npm test && npm run check && npm run build` 통과 확인
- 참고 구현: `apps/web/src/lib/age.js`, `apps/web/src/components/tools/KoreanAge.vue`, `apps/web/src/pages/tools/korean-age.astro`

## 글쓰기 규칙 (페이지 문구)
- 한국어, 존댓말(해요체). 짧은 문장.
- `title`은 사람들이 실제로 검색하는 표현 그대로 (예: "HEIC JPG 변환", "만 나이 계산기").
- meta description은 70~100자, 무엇을 해주는지 + 차별점(서버 업로드 없음 등). 한글은 길면 검색 결과에서 잘린다.
- 법·제도 언급은 확정된 사실만. 불확실하면 쓰지 않는다.

## 명령어
- `npm run dev` 개발 서버 (http://localhost:4321)
- `npm test` 로직 테스트
- `npm run check` 타입 검사 (`astro check` + `vue-tsc`)
- `npm run build` 정적 빌드 (`apps/web/dist/`)
- 명령은 저장소 루트에서 실행한다 (루트 스크립트가 `apps/web`으로 위임). 패키지 추가는 `npm i <pkg> -w apps/web`

## 작업 방식 (Orca 병렬 worktree)
- 한 worktree = 한 도구(= `docs/TASKS.md`의 한 항목). 다른 도구 파일은 건드리지 않는다.
- 공용 파일(`tools.js`, `global.css`, 레이아웃)은 꼭 필요한 최소 변경만. `tools.js`는 자기 도구 줄의 `status`만 바꾼다.
- 커밋 전 `npm test && npm run check && npm run build` 필수.
