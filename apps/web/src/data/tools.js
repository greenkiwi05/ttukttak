// 도구 레지스트리: 홈 화면, 카테고리, "다른 도구" 추천이 모두 이 목록을 쓴다.
// 새 도구를 만들면 여기에 한 줄 추가하고 status를 'live'로 바꾼다.

export const CATEGORIES = {
  file: { label: '파일 변환', emoji: '📁', desc: 'HEIC, PDF, 이미지 파일을 설치 없이 바꾸고 줄여요. 파일은 서버로 올라가지 않고 내 브라우저 안에서만 처리돼요.' },
  photo: { label: '사진', emoji: '📷', desc: '증명사진처럼 규격이 정해진 사진을 원하는 크기로 바로 맞춰요. 사진은 서버로 올라가지 않아요.' },
  date: { label: '날짜', emoji: '📅', desc: '만 나이, D-day, 기념일, 두 날짜 사이 기간까지. 날짜 계산을 한 번에 끝내요.' },
  calc: { label: '생활 계산', emoji: '🧮', desc: '평수 변환, 할인율, 대출 상환, 적금 이자처럼 생활에서 자주 하는 계산을 바로 해요.' },
  text: { label: '글자·문구', emoji: '✍️', desc: '글자수 세기, QR코드 만들기, 경조사 문구까지. 글과 관련된 일을 바로 끝내요.' },
  fun: { label: '뽑기·게임', emoji: '🎲', desc: '사다리타기, 제비뽑기, 팀 나누기처럼 공정하게 정해야 할 때 바로 써요.' },
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
  { slug: 'lunar-calendar', title: '음력 양력 변환', short: '음력 생일을 양력으로, 양력 날짜를 음력으로', category: 'date', status: 'live' },
  { slug: 'days-between', title: '날짜 사이 일수 계산', short: '두 날짜 사이의 일수·주·개월 계산', category: 'date', status: 'live' },
  // 생활 계산
  { slug: 'pyeong', title: '평수 계산기 (평 ↔ ㎡)', short: '평과 제곱미터를 바로 변환', category: 'calc', status: 'live' },
  { slug: 'percent', title: '퍼센트·할인율 계산기', short: '할인가, 증감률, 비율 계산', category: 'calc', status: 'live' },
  { slug: 'loan-repayment', title: '대출 원리금 상환 계산기', short: '원리금균등·원금균등 상환표', category: 'calc', status: 'live' },
  { slug: 'travel-payment', title: '해외 결제 수수료 계산기', short: '여행지 카드 결제, 실제 원화 청구액 계산', category: 'calc', status: 'live' },
  { slug: 'savings-interest', title: '적금·예금 이자 계산기', short: '단리·월복리, 세전·세후 이자', category: 'calc', status: 'live' },
  // 파일 변환
  { slug: 'heic-to-jpg', title: 'HEIC JPG 변환', short: '아이폰 사진(HEIC)을 JPG로, 서버 업로드 없이', category: 'file', status: 'live' },
  { slug: 'image-compress', title: '이미지 용량 줄이기 (MB 지정)', short: '"2MB 이하"처럼 목표 용량에 맞춰 압축', category: 'file', status: 'live' },
  { slug: 'pdf-merge-split', title: 'PDF 합치기·나누기', short: 'PDF 여러 개 합치기, 페이지 나누기', category: 'file', status: 'live' },
  { slug: 'jpg-to-pdf', title: 'JPG PDF 변환', short: '사진 여러 장을 PDF 하나로, 서버 업로드 없이', category: 'file', status: 'live' },
  { slug: 'image-convert', title: '이미지 변환·크기 조절', short: 'PNG·JPG·WEBP 변환, 픽셀·비율로 크기 조절', category: 'file', status: 'live' },
  { slug: 'hwp-to-pdf', title: 'HWP PDF 변환', short: '한글 파일을 설치 없이 열고 PDF로', category: 'file', status: 'planned' },
  // 사진
  { slug: 'id-photo', title: '증명사진 규격 맞추기', short: '이력서·여권·반명함 사이즈로 자르기', category: 'photo', status: 'live' },
  { slug: 'exif-remove', title: '사진 위치정보 지우기', short: '사진 속 GPS·촬영 정보(EXIF) 확인하고 삭제', category: 'photo', status: 'live' },
  // 글자·문구
  { slug: 'char-count', title: '글자수 세기', short: '공백 포함·제외 글자수, 바이트, 원고지 매수', category: 'text', status: 'live' },
  { slug: 'qr-code', title: 'QR코드 만들기', short: '링크·와이파이·연락처 QR코드 무료 생성', category: 'text', status: 'live' },
  { slug: 'greeting-message', title: '경조사 문구 생성기', short: '축하·조의·감사·명절 인사 문구를 상황에 맞게', category: 'text', status: 'live' },
  // 뽑기·게임
  { slug: 'ladder', title: '사다리타기', short: '참가자와 결과를 넣고 공정하게 사다리 타기', category: 'fun', status: 'live' },
  { slug: 'random-pick', title: '제비뽑기·랜덤 뽑기', short: '당첨자 뽑기, 팀 나누기, 순서 정하기', category: 'fun', status: 'live' },
];

export const liveTools = () => TOOLS.filter((t) => t.status === 'live');
/** 카테고리별 도구 (live 먼저) */
export const toolsIn = (cat) => TOOLS.filter((t) => t.category === cat).sort((a, b) => (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1));
export const getTool = (slug) => TOOLS.find((t) => t.slug === slug);

/** 같은 카테고리 우선, 그다음 다른 live 도구 */
export function relatedTools(slug, limit = 4) {
  const me = getTool(slug);
  const others = liveTools().filter((t) => t.slug !== slug);
  const same = others.filter((t) => t.category === me?.category);
  const rest = others.filter((t) => t.category !== me?.category);
  return [...same, ...rest].slice(0, limit);
}
