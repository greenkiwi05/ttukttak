# 뚝딱 — 생활 계산·파일 변환 도구

설치·가입 없이 브라우저에서 바로 쓰는 한국어 생활 도구 모음입니다.
모든 계산과 파일 처리는 브라우저 안에서만 이루어지며, 서버로 데이터를 전송하지 않습니다.

## 기술 스택
- [Astro](https://astro.build) 정적 사이트 생성 + Vue 3 아일랜드 컴포넌트
- 계산 로직은 순수 함수로 분리, `node:test`로 테스트
- Cloudflare Pages 배포, JSON-LD 구조화 데이터·사이트맵으로 SEO 대응

## 실행
```bash
npm install
npm run dev     # http://localhost:4321
npm test
npm run build
```

## 문서
- `AGENTS.md` — 개발 원칙과 구조 (코딩 에이전트용)
- `docs/TOOLS.md` — 도구별 스펙
- `docs/TASKS.md` — 작업 목록
- `docs/DEPLOY.md` — 배포·검색 등록·AdSense
