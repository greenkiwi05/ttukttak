# AGENTS.md — 뚝딱 (생활 도구 모음 사이트)

이 저장소에서 작업하는 모든 코딩 에이전트(Claude Code, Codex 등)가 먼저 읽는 문서다.
작업 목록은 `docs/TASKS.md`, 도구별 상세 스펙은 `docs/TOOLS.md`에 있다.

## 프로젝트 한 줄 요약
설치·가입 없이 브라우저에서 바로 쓰는 한국어 생활 도구(계산기 + 파일 변환) 모음.
수익은 Google AdSense, 유입은 검색(SEO). 운영자는 1명이라 **유지보수가 거의 없는 도구만** 만든다.

## 절대 원칙
1. **모든 처리는 브라우저에서.** 서버·API·DB 없음. 파일을 외부로 업로드하는 코드 금지. (사이트의 핵심 셀링 포인트: "파일이 서버로 안 올라감")
2. **정부 기준값(세율, 최저임금, 4대보험 요율, 소득기준 등)을 하드코딩하는 도구는 만들지 않는다.** 금리·시급처럼 바뀌는 값은 사용자가 입력하게 한다.
3. **로직과 UI 분리.** 계산·변환 로직은 `src/lib/*.js` 순수 함수로 두고 `tests/*.test.js`에 `node:test` 테스트를 붙인다. UI는 Vue 컴포넌트.
4. **SEO 우선.** 도구 페이지마다 설명글(guide)과 FAQ를 반드시 채운다. 계산기만 있는 빈 페이지는 AdSense 심사에서 떨어진다.
5. **가볍게.** 무거운 라이브러리(WASM 등)는 해당 도구 페이지에서만 동적 `import()`로 불러온다. 홈 화면 JS는 0에 가깝게 유지.

## 기술 스택
- Astro 7 (정적 빌드) + `@astrojs/vue` (Vue 3 `<script setup lang="ts">`) + `@astrojs/sitemap`
- 스타일: `src/styles/global.css` 하나 (CSS 변수). Tailwind 등 추가하지 않는다.
- 배포: Cloudflare Pages (`npm run build` → `dist/`)

## 폴더 구조
```
src/
  data/site.js          사이트 이름·도메인·AdSense ID (전역 설정)
  data/tools.js         도구 레지스트리 (홈, 추천 목록이 여기서 나옴)
  layouts/Base.astro    HTML 뼈대, meta/OG/canonical, AdSense 스크립트
  layouts/ToolLayout.astro  도구 페이지 공통 틀 (제목→도구→광고→설명→FAQ→다른 도구, JSON-LD 자동)
  components/AdSlot.astro   광고 자리 (AdSense ID 없으면 렌더링 안 함)
  components/tools/*.vue    도구별 UI
  lib/*.js              도구별 순수 로직
  pages/tools/{slug}.astro  도구 페이지
tests/*.test.js         로직 테스트 (node --test)
docs/                   스펙·작업 목록·배포 가이드
```

## 새 도구 추가 절차 (기준 예시: 만 나이 계산기)
1. `docs/TOOLS.md`에서 해당 도구 스펙 확인
2. `src/lib/{name}.js`에 로직 작성 + `tests/{name}.test.js` 테스트 (경계값 포함)
3. `src/components/tools/{Name}.vue`에 UI 작성 (기존 CSS 클래스 `field`, `btn`, `result`, `big`, `sub`, `error` 재사용)
4. `src/pages/tools/{slug}.astro` 생성: `ToolLayout`으로 감싸고 `<Name client:load />`, `guide` 슬롯 설명글 3~5문단, `faq` 4~6개
5. `src/data/tools.js`에서 해당 도구 `status: 'live'`로 변경
6. `npm test && npm run build` 통과 확인
- 참고 구현: `src/lib/age.js`, `src/components/tools/KoreanAge.vue`, `src/pages/tools/korean-age.astro`

## 글쓰기 규칙 (페이지 문구)
- 한국어, 존댓말(해요체). 짧은 문장.
- `title`은 사람들이 실제로 검색하는 표현 그대로 (예: "HEIC JPG 변환", "만 나이 계산기").
- meta description은 120자 안팎, 무엇을 해주는지 + 차별점(서버 업로드 없음 등).
- 법·제도 언급은 확정된 사실만. 불확실하면 쓰지 않는다.

## 명령어
- `npm run dev` 개발 서버 (http://localhost:4321)
- `npm test` 로직 테스트
- `npm run build` 정적 빌드 (`dist/`)

## 작업 방식 (Orca 병렬 worktree)
- 한 worktree = 한 도구(= `docs/TASKS.md`의 한 항목). 다른 도구 파일은 건드리지 않는다.
- 공용 파일(`tools.js`, `global.css`, 레이아웃)은 꼭 필요한 최소 변경만. `tools.js`는 자기 도구 줄의 `status`만 바꾼다.
- 커밋 전 `npm test && npm run build` 필수.
