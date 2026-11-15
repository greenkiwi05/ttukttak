// 해외 결제 금액 계산. 환율·수수료율은 모두 사용자 입력값 (바뀌는 값이라 하드코딩하지 않는다).
//  1) 현지 가격 + 세금·봉사료(%)  = 현지 결제액
//  2) 현지 결제액 × 환율(원 / 단위)  = 원화 기준 금액
//  3) 카드(현지 통화 결제): + 브랜드 수수료(%) + 카드사 해외이용 수수료(%) — 둘 다 원화 기준 금액에 단순 적용
//  4) 원화 결제(DCC): 카드 결제액에 가맹점 환전 마진(%)이 더 붙는다고 보고 비교
// 실제 카드 청구액은 결제일·매입일 환율, 카드사 계산 방식에 따라 조금 달라질 수 있다 (예상치).

export const CURRENCIES = {
  IDR: { label: '인도네시아 루피아', unit: 100, symbol: 'Rp', bills: [10000, 20000, 50000, 100000, 500000, 1000000] },
  USD: { label: '미국 달러', unit: 1, symbol: '$', bills: [1, 5, 10, 20, 50, 100] },
  JPY: { label: '일본 엔', unit: 100, symbol: '¥', bills: [100, 500, 1000, 5000, 10000] },
  EUR: { label: '유로', unit: 1, symbol: '€', bills: [1, 5, 10, 20, 50, 100] },
  THB: { label: '태국 바트', unit: 1, symbol: '฿', bills: [20, 50, 100, 500, 1000] },
  VND: { label: '베트남 동', unit: 100, symbol: '₫', bills: [10000, 50000, 100000, 200000, 500000] },
  PHP: { label: '필리핀 페소', unit: 1, symbol: '₱', bills: [20, 50, 100, 500, 1000] },
  TWD: { label: '대만 달러', unit: 1, symbol: 'NT$', bills: [100, 500, 1000] },
  CNY: { label: '중국 위안', unit: 1, symbol: '¥', bills: [1, 10, 50, 100] },
  GBP: { label: '영국 파운드', unit: 1, symbol: '£', bills: [5, 10, 20, 50] },
};

/**
 * @param {{ amount:number, rate:number, unit:number, taxPct?:number, brandPct?:number, issuerPct?:number, dccPct?:number }} p
 *   rate: unit(1 또는 100) 현지 통화당 원화
 */
export function travelPay({ amount, rate, unit, taxPct = 0, brandPct = 0, issuerPct = 0, dccPct = 0 }) {
  if (!(amount > 0)) return { error: '현지 가격을 입력해 주세요.' };
  if (!(rate > 0)) return { error: '환율을 입력해 주세요.' };
  for (const [v, name] of [[taxPct, '세금·봉사료'], [brandPct, '브랜드 수수료'], [issuerPct, '해외이용 수수료'], [dccPct, '원화결제 추가 비용']]) {
    if (!(v >= 0) || v > 100) return { error: `${name}를 0~100% 사이로 입력해 주세요.` };
  }
  // 부동소수 오차(181499.9999…) 때문에 반올림이 1원 어긋나지 않도록 소수 3자리에서 정리
  const fix = (n) => Math.round(n * 1000) / 1000;
  const local = fix((amount * (100 + taxPct)) / 100);
  const base = fix((local * rate) / unit);
  const brandFee = Math.round((base * brandPct) / 100);
  const issuerFee = Math.round((base * issuerPct) / 100);
  const card = Math.round(base) + brandFee + issuerFee;
  const dcc = Math.round(card * (1 + dccPct / 100));
  return { local, base: Math.round(base), brandFee, issuerFee, card, dcc, dccDiff: dcc - card, feeRate: card / base - 1 };
}

/** 현지 금액 → 원화 (암산용 표). 수수료를 포함하려면 feePct를 넣는다 */
export const toKrw = (amount, rate, unit, feePct = 0) => Math.round(((amount * rate) / unit) * (1 + feePct / 100));

/** 입력 문자열 → 숫자 (쉼표 허용) */
export function num(s) {
  const t = String(s ?? '').replace(/,/g, '').trim();
  return t === '' || !/^\d*\.?\d+$/.test(t) ? NaN : Number(t);
}
