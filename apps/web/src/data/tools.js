// 도구 레지스트리: 홈 화면, 카테고리, "다른 도구" 추천이 모두 이 목록을 쓴다.
// 새 도구를 만들면 여기에 한 줄 추가하고 status를 'live'로 바꾼다.

export const CATEGORIES = {
  file: { label: '파일 변환', emoji: '📁', desc: 'HEIC를 JPG로, 사진을 PDF로, 이미지 용량 줄이기와 PDF 합치기까지. 설치 없이 바로 쓰고, 파일은 서버로 올라가지 않고 내 브라우저 안에서만 처리돼요.' },
  photo: { label: '사진', emoji: '📷', desc: '증명사진을 반명함·여권 규격으로 자르고, 사진 속 위치정보(EXIF)를 확인해 지워요. 사진은 서버로 올라가지 않고 브라우저 안에서만 처리돼요.' },
  date: { label: '날짜', emoji: '📅', desc: '만 나이, D-day, 커플 기념일, 두 날짜 사이 기간, 음력 양력 변환까지. 날짜 계산을 설치 없이 바로 끝내요. 날짜는 숫자로 바로 입력할 수 있어요.' },
  calc: { label: '생활 계산', emoji: '🧮', desc: '평수 변환, 퍼센트·할인율, 대출 상환, 적금 이자, 해외 결제 수수료처럼 생활에서 자주 하는 계산을 바로 해요. 금리·환율은 직접 넣어 정확하게 계산해요.' },
  text: { label: '글자·문구', emoji: '✍️', desc: '자기소개서 글자수 세기, 링크·와이파이 QR코드 만들기, 경조사·명절 인사 문구까지. 글과 관련된 일을 바로 끝내요. 입력한 글은 저장되지 않아요.' },
  fun: { label: '뽑기·게임', emoji: '🎲', desc: '온라인 사다리타기, 제비뽑기, 팀 나누기, 순서 정하기처럼 공정하게 정해야 할 때 바로 써요. 브라우저의 보안 난수로 누구에게도 유리하지 않게 섞어요.' },
};

/**
 * @typedef {Object} Tool
 * @property {string} slug    URL 경로 (/tools/{slug}/)
 * @property {string} title   페이지 제목 = 주 검색 키워드
 * @property {string} short   카드에 보이는 한 줄 설명
 * @property {string} [keywords] 검색용 별칭 (사람들이 실제로 치는 말, 쉼표 구분)
 * @property {keyof typeof CATEGORIES} category
 * @property {'live'|'planned'} status
 */

/** @type {Tool[]} */
export const TOOLS = [
  // 날짜
  { slug: 'korean-age', title: '만 나이 계산기', short: '생년월일로 만 나이와 연 나이를 바로 계산', keywords: '나이 계산, 만나이, 연나이, 세는나이, 몇살, 생년월일, 띠', category: 'date', status: 'live' },
  { slug: 'd-day', title: 'D-day 계산기', short: '목표일까지 남은 날, 지난 날 계산', keywords: '디데이, 디데이 계산, 며칠 남았는지, 수능, 카운트다운, 날짜', category: 'date', status: 'live' },
  { slug: 'couple-anniversary', title: '커플 기념일 계산기', short: '사귄 날로 100일·1000일·주년 날짜 한눈에', keywords: '커플, 100일, 1000일, 기념일, 사귄날, 연애, 주년', category: 'date', status: 'live' },
  { slug: 'lunar-calendar', title: '음력 양력 변환', short: '음력 생일을 양력으로, 양력 날짜를 음력으로', keywords: '음력, 양력, 음력생일, 윤달, 설날, 추석, 간지, 달력', category: 'date', status: 'live' },
  { slug: 'work-hours', title: '근무시간 계산기', short: '출퇴근 시각으로 하루·주간 근무시간 합계', keywords: '근무시간, 알바, 아르바이트, 출퇴근, 시급, 주간근무, 시간계산', category: 'date', status: 'live' },
  { slug: 'time-calculator', title: '시간 계산기', short: '몇 시간 뒤 몇 시, 두 시각 사이, 시간 합계', keywords: '시간 계산, 시간 더하기, 시간 빼기, 몇시간 후, 시간 합계, 분 계산, 공부 시간', category: 'date', status: 'live' },
  { slug: 'days-between', title: '일수 계산기 (날짜 사이 며칠)', short: '두 날짜 사이의 일수·주·개월 계산', keywords: '일수 계산기, 며칠, 기간, 날짜 차이, 날짜 계산, 평일 수', category: 'date', status: 'live' },
  // 생활 계산
  { slug: 'calculator', title: '공학용 계산기', short: 'sin·log·제곱근까지, 식을 한 번에 계산', keywords: '계산기, 일반 계산기, 온라인 계산기, 공학 계산기, 삼각함수, 로그, 제곱근', category: 'calc', status: 'live' },
  { slug: 'pyeong', title: '평수 계산기 (평 ↔ ㎡)', short: '평과 제곱미터를 바로 변환', keywords: '평, 제곱미터, ㎡, 면적, 아파트, 평형, 84', category: 'calc', status: 'live' },
  { slug: 'percent', title: '퍼센트(%)·할인율 계산기', short: '할인가, 증감률, 비율 계산', keywords: '%, 퍼센트, 백분율, 할인, 할인율, 증감률, 비율', category: 'calc', status: 'live' },
  { slug: 'loan-repayment', title: '대출 원리금 상환 계산기', short: '원리금균등·원금균등 상환표', keywords: '대출, 이자, 원리금균등, 원금균등, 주택담보대출, 상환표, 월 상환액', category: 'calc', status: 'live' },
  { slug: 'dutch-pay', title: '더치페이 계산기', short: '1차·2차 참여자별 N빵 정산, 정산 문구 복사', keywords: 'N빵, 엔빵, 정산, 회식비, 나눠내기, 1차 2차, 총무', category: 'calc', status: 'live' },
  { slug: 'unit-convert', title: '단위 변환기', short: '인치·파운드·화씨·갤런 등 단위 바로 변환', keywords: '단위, 인치, cm, 파운드, kg, 화씨, 섭씨, 갤런, 온도, 길이, 무게', category: 'calc', status: 'live' },
  { slug: 'travel-payment', title: '해외 결제 수수료 계산기', short: '여행지 카드 결제, 실제 원화 청구액 계산', keywords: '해외결제, 카드 수수료, 환율, 여행, 발리, 루피아, 엔화, 달러, DCC', category: 'calc', status: 'live' },
  { slug: 'savings-interest', title: '적금·예금 이자 계산기', short: '단리·월복리, 세전·세후 이자', keywords: '적금, 예금, 이자, 세후, 단리, 복리, 만기', category: 'calc', status: 'live' },
  // 파일 변환
  { slug: 'heic-to-jpg', title: 'HEIC JPG 변환', short: '아이폰 사진(HEIC)을 JPG로, 서버 업로드 없이', keywords: '아이폰 사진, heic, jpg, 사진 변환, 이미지 변환', category: 'file', status: 'live' },
  { slug: 'image-compress', title: '사진 용량 줄이기', short: '"2MB 이하"처럼 목표 용량에 맞춰, 여러 장 한 번에', keywords: '사진 용량, 이미지 용량, 압축, 용량 줄이기, jpg 용량, kb, mb', category: 'file', status: 'live' },
  { slug: 'pdf-merge-split', title: 'PDF 합치기·나누기', short: 'PDF 여러 개 합치기, 페이지 나누기', keywords: 'pdf 병합, pdf 합치기, pdf 나누기, pdf 분할, 페이지 추출, pdf 페이지 삭제', category: 'file', status: 'live' },
  { slug: 'jpg-to-pdf', title: 'JPG PDF 변환', short: '사진 여러 장을 PDF 하나로, 서버 업로드 없이', keywords: '사진 pdf, 이미지 pdf, jpg pdf, 사진을 pdf로, 스캔', category: 'file', status: 'live' },
  { slug: 'image-convert', title: '이미지 변환·크기 조절', short: 'PNG·JPG·WEBP 변환, 픽셀·비율로 크기 조절', keywords: '이미지 크기, 사진 크기, 해상도, png, jpg, webp, 리사이즈, 픽셀', category: 'file', status: 'live' },
  { slug: 'video-compress', title: '동영상 용량 줄이기', short: '화질·목표 용량을 골라 영상 압축, 서버 업로드 없이', keywords: '동영상 용량, 영상 압축, 동영상 압축, mp4, 영상 용량, 비디오', category: 'file', status: 'live' },
  { slug: 'pdf-compress', title: 'PDF 용량 줄이기', short: '스캔·사진 PDF를 작게, 서버 업로드 없이', keywords: 'pdf 압축, pdf 용량, pdf 파일 용량 줄이기, pdf 크기 줄이기, pdf 줄이기', category: 'file', status: 'live' },
  { slug: 'pdf-to-jpg', title: 'PDF JPG 변환', short: 'PDF 페이지를 이미지로, 서버 업로드 없이', keywords: 'pdf 이미지, pdf jpg, pdf png, pdf를 사진으로', category: 'file', status: 'live' },
  { slug: 'hwp-to-pdf', title: 'HWP PDF 변환', short: '한글 파일을 설치 없이 열고 PDF로 저장', keywords: '한글 파일, hwp, hwpx, 한글 pdf, 한글 뷰어, 한컴', category: 'file', status: 'live' },
  // 사진
  { slug: 'id-photo', title: '증명사진·여권사진 규격 맞추기', short: '여권·주민등록증·운전면허·반명함 사이즈로 자르기', keywords: '증명사진, 여권사진, 반명함, 이력서 사진, 사진 규격, 운전면허 사진, 민증 사진', category: 'photo', status: 'live' },
  { slug: 'image-merge', title: '사진 합치기', short: '여러 장을 세로·가로로 한 장에 이어 붙이기', keywords: '사진 합치기, 이미지 합치기, 캡처 이어붙이기, 사진 붙이기', category: 'photo', status: 'live' },
  { slug: 'exif-remove', title: '사진 위치정보 지우기', short: '사진 속 GPS·촬영 정보(EXIF) 확인하고 삭제', keywords: '위치정보, gps, exif, 메타데이터, 개인정보, 사진 정보', category: 'photo', status: 'live' },
  // 글자·문구
  { slug: 'char-count', title: '글자수 세기', short: '공백 포함·제외 글자수, 바이트, 원고지 매수', keywords: '글자수, 자소서, 자기소개서, 바이트, 공백 제외, 원고지', category: 'text', status: 'live' },
  { slug: 'qr-code', title: 'QR코드 만들기', short: '링크·와이파이·연락처 QR코드 무료 생성', keywords: 'qr, 큐알코드, 와이파이, 링크, qr 생성', category: 'text', status: 'live' },
  { slug: 'greeting-message', title: '경조사 문구 생성기', short: '축하·조의·감사·명절 인사 문구를 상황에 맞게', keywords: '축하 문구, 조의, 결혼, 명절 인사, 감사 인사, 경조사', category: 'text', status: 'live' },
  { slug: 'name-romanize', title: '한글 이름 영어 변환', short: '여권·서류용 영문 이름 표기, 성 표기 고르기', keywords: '영어이름, 영문이름, 이름 영어로, 로마자 표기, 여권 영문, 영문 성', category: 'text', status: 'live' },
  { slug: 'stamp-maker', title: '도장 만들기', short: '이름으로 원형·사각 도장 이미지, 투명 PNG', keywords: '도장, 온라인 도장, 무료 도장 만들기, 전자 도장, 인감, 직인', category: 'text', status: 'live' },
  { slug: 'signature-maker', title: '사인 만들기', short: '손글씨 사인 이미지, 한글·영문, 투명 PNG', keywords: '사인, 서명, 싸인, 전자서명, 이메일 서명, 손글씨', category: 'text', status: 'live' },
  // 뽑기·게임
  { slug: 'ladder', title: '사다리타기', short: '참가자와 결과를 넣고 공정하게 사다리 타기', keywords: '사다리, 사다리게임, 내기, 당첨, 뽑기', category: 'fun', status: 'live' },
  { slug: 'lotto', title: '로또 번호 생성기', short: '6/45 번호 무작위 뽑기, 고정수·제외수', keywords: '로또, 로또번호, 번호 생성, 자동번호, 6/45', category: 'fun', status: 'live' },
  { slug: 'random-pick', title: '제비뽑기·랜덤 뽑기', short: '당첨자 뽑기, 팀 나누기, 순서 정하기', keywords: '제비뽑기, 추첨, 랜덤, 팀 나누기, 순서 정하기, 당첨자', category: 'fun', status: 'live' },
];

export const liveTools = () => TOOLS.filter((t) => t.status === 'live');
/** 카테고리별 공개 도구. planned(준비 중)는 홈·카테고리·메뉴 어디에도 보이지 않는다 */
export const toolsIn = (cat) => TOOLS.filter((t) => t.category === cat && t.status === 'live');
export const getTool = (slug) => TOOLS.find((t) => t.slug === slug);

/** 같은 카테고리 우선, 그다음 다른 live 도구 */
export function relatedTools(slug, limit = 4) {
  const me = getTool(slug);
  const others = liveTools().filter((t) => t.slug !== slug);
  const same = others.filter((t) => t.category === me?.category);
  const rest = others.filter((t) => t.category !== me?.category);
  return [...same, ...rest].slice(0, limit);
}
