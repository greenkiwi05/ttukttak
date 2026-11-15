# 작업 목록

Orca에서 항목 하나를 worktree 하나에 배정한다. 같은 단계 안의 항목은 서로 독립적이라 **병렬 실행 가능**.
각 항목의 완료 조건: `docs/TOOLS.md` 스펙 충족 + 테스트 + guide/FAQ 작성 + `tools.js` status 'live' + `npm test && npm run build` 통과.

## 0단계 — 뼈대 ✅ 완료
- [x] Astro + Vue + sitemap 설정, 공통 레이아웃, 도구 레지스트리
- [x] 참고 구현: 만 나이 계산기 (`korean-age`)
- [x] 개인정보처리방침, 소개, 404, robots.txt, favicon

## 1단계 — 쉬운 도구 (병렬 6개) ✅ 완료
- [x] `d-day` D-day 계산기
- [x] `couple-anniversary` 커플 기념일 계산기
- [x] `days-between` 날짜 사이 일수 계산
- [x] `pyeong` 평수 계산기
- [x] `percent` 퍼센트·할인율 계산기
- [x] `image-compress` 이미지 용량 줄이기

> 1단계가 끝나면 도메인 연결 + 배포 + 구글 서치 콘솔 등록 (`docs/DEPLOY.md`). 색인은 빨리 시작할수록 좋다.

## 2단계 — 중간 난이도 (병렬 5개)
- [ ] `heic-to-jpg` HEIC JPG 변환
- [ ] `pdf-merge-split` PDF 합치기·나누기
- [ ] `loan-repayment` 대출 원리금 상환 계산기
- [ ] `savings-interest` 적금·예금 이자 계산기
- [ ] `greeting-message` 경조사 문구 생성기

## 3단계 — 어려운 도구
- [ ] `id-photo` 증명사진 규격 맞추기 (크롭·리사이즈)
- [ ] `hwp-to-pdf` 스파이크 → 결과 보고 진행 여부 결정

## 공통 개선 (아무 때나, 단독 worktree)
- [ ] 홈 화면 도구 검색창 (클라이언트 필터)
- [ ] Lighthouse 모바일 성능·SEO·접근성 90+ 확인 및 개선
- [ ] OG 이미지(공유 썸네일) 기본 1장
- [ ] Cloudflare Web Analytics 스니펫 추가 (쿠키 없음)

## 에이전트에게 줄 프롬프트 예시
```
AGENTS.md와 docs/TOOLS.md를 읽고, `d-day` 도구를 만들어줘.
참고 구현(korean-age)과 같은 구조로: apps/web의 src/lib + tests + Vue 컴포넌트 + 페이지(guide, faq).
끝나면 tools.js에서 d-day status를 live로 바꾸고 npm test && npm run build 통과시켜줘.
```
