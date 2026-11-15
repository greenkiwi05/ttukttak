// 도구 레지스트리: 홈 화면, 카테고리, "다른 도구" 추천이 모두 이 목록을 쓴다.
// 새 도구를 만들면 여기에 한 줄 추가하고 status를 'live'로 바꾼다.

export const CATEGORIES = {
  file: { label: '파일 변환', emoji: '📁' },
  photo: { label: '사진', emoji: '📷' },
  date: { label: '날짜', emoji: '📅' },
  calc: { label: '생활 계산', emoji: '🧮' },
  text: { label: '문구 생성', emoji: '💌' },
};

/**
 * @typedef {Object} Tool
 * @property {string} slug    URL 경로 (/tools/{slug}/)
 * @property {string} title   페이지 제목 = 주 검색 키워드
 * @property {string} short   카드에 보이는 한 줄 설명
 * @property {keyof typeof CATEGORIES} category
 * @property {'live'|'planned'} status
 */

/** @type {Tool[]} */
export const TOOLS = [
  // 날짜
  { slug: 'korean-age', title: '만 나이 계산기', short: '생년월일로 만 나이와 연 나이를 바로 계산', category: 'date', status: 'live' },
  { slug: 'd-day', title: 'D-day 계산기', short: '목표일까지 남은 날, 지난 날 계산', category: 'date', status: 'live' },
  { slug: 'couple-anniversary', title: '커플 기념일 계산기', short: '사귄 날로 100일·1000일·주년 날짜 한눈에', category: 'date', status: 'live' },
  { slug: 'days-between', title: '날짜 사이 일수 계산', short: '두 날짜 사이의 일수·주·개월 계산', category: 'date', status: 'live' },
  // 생활 계산
  { slug: 'pyeong', title: '평수 계산기 (평 ↔ ㎡)', short: '평과 제곱미터를 바로 변환', category: 'calc', status: 'live' },
  { slug: 'percent', title: '퍼센트·할인율 계산기', short: '할인가, 증감률, 비율 계산', category: 'calc', status: 'live' },
  { slug: 'loan-repayment', title: '대출 원리금 상환 계산기', short: '원리금균등·원금균등 상환표', category: 'calc', status: 'live' },
  { slug: 'savings-interest', title: '적금·예금 이자 계산기', short: '단리·월복리, 세전·세후 이자', category: 'calc', status: 'live' },
  // 파일 변환
  { slug: 'heic-to-jpg', title: 'HEIC JPG 변환', short: '아이폰 사진(HEIC)을 JPG로, 서버 업로드 없이', category: 'file', status: 'live' },
  { slug: 'image-compress', title: '이미지 용량 줄이기 (MB 지정)', short: '"2MB 이하"처럼 목표 용량에 맞춰 압축', category: 'file', status: 'live' },
  { slug: 'pdf-merge-split', title: 'PDF 합치기·나누기', short: 'PDF 여러 개 합치기, 페이지 나누기', category: 'file', status: 'live' },
  { slug: 'hwp-to-pdf', title: 'HWP PDF 변환', short: '한글 파일을 설치 없이 열고 PDF로', category: 'file', status: 'planned' },
  // 사진
  { slug: 'id-photo', title: '증명사진 규격 맞추기', short: '이력서·여권·반명함 사이즈로 자르기', category: 'photo', status: 'planned' },
  // 문구 생성
  { slug: 'greeting-message', title: '경조사 문구 생성기', short: '축하·조의·감사·명절 인사 문구를 상황에 맞게', category: 'text', status: 'live' },
];

export const liveTools = () => TOOLS.filter((t) => t.status === 'live');
export const getTool = (slug) => TOOLS.find((t) => t.slug === slug);

/** 같은 카테고리 우선, 그다음 다른 live 도구 */
export function relatedTools(slug, limit = 4) {
  const me = getTool(slug);
  const others = liveTools().filter((t) => t.slug !== slug);
  const same = others.filter((t) => t.category === me?.category);
  const rest = others.filter((t) => t.category !== me?.category);
  return [...same, ...rest].slice(0, limit);
}
