// 통화별 환율 계산기 페이지 목록 (페이지 위 통화 바로가기에 쓰임). 도구 정보는 tools.js에 parent: 'exchange-rate'로 등록
export const FX_PAGES = [
  { slug: 'dollar-exchange-rate', code: 'USD', label: '🇺🇸 달러' },
  { slug: 'yen-exchange-rate', code: 'JPY', label: '🇯🇵 엔화' },
  { slug: 'euro-exchange-rate', code: 'EUR', label: '🇪🇺 유로' },
  { slug: 'yuan-exchange-rate', code: 'CNH', label: '🇨🇳 위안화' },
  { slug: 'baht-exchange-rate', code: 'THB', label: '🇹🇭 바트' },
  { slug: 'aud-exchange-rate', code: 'AUD', label: '🇦🇺 호주 달러' },
];
