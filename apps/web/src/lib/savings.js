// 예금·적금 이자. 금리와 세율은 모두 사용자 입력값을 인자로 받는다 (AGENTS.md 원칙 2: 세율 하드코딩 금지).
// UI의 세율 버튼은 입력칸을 채우는 편의 기능일 뿐이다.
//  - 예금: 처음에 amount를 한 번 넣고 months개월 둔다.
//  - 적금: 매달 초 amount를 넣는다(정액적립식). k번째 납입금은 (months - k + 1)개월 이자를 받는다.
//  - 단리: 원금 × 연이율 × 개월/12, 월복리: 원금 × ((1 + 연이율/12)^개월 − 1)
// 세금은 세전 이자 × 세율, 원 미만 버림. 실제 금융기관은 세목별로 10원 미만을 절사해 몇십 원 차이가 날 수 있다.

/**
 * @param {{ type:'deposit'|'installment', amount:number, months:number, annualRate:number, compound:'simple'|'monthly', taxRate:number }} p
 * @returns {{ principal:number, interest:number, tax:number, afterTax:number, total:number } | { error:string }}
 */
export function calcSavings({ type, amount, months, annualRate, compound, taxRate }) {
  if (!(amount > 0)) return { error: type === 'deposit' ? '예치금을 입력해 주세요.' : '월 납입액을 입력해 주세요.' };
  if (!Number.isInteger(months) || months < 1 || months > 600) return { error: '기간을 1~600개월 사이로 입력해 주세요.' };
  if (!(annualRate >= 0) || annualRate > 100) return { error: '연 금리를 0~100% 사이로 입력해 주세요.' };
  if (!(taxRate >= 0) || taxRate > 100) return { error: '세율을 0~100% 사이로 입력해 주세요.' };

  const r = annualRate / 100;
  const grow = (p, m) => (compound === 'monthly' ? p * ((1 + r / 12) ** m - 1) : (p * r * m) / 12);

  let principal, raw;
  if (type === 'deposit') {
    principal = amount;
    raw = grow(amount, months);
  } else {
    principal = amount * months;
    raw = 0;
    for (let k = 1; k <= months; k++) raw += grow(amount, months - k + 1);
  }
  const interest = Math.round(raw);
  const tax = Math.floor((interest * taxRate) / 100);
  const afterTax = interest - tax;
  return { principal, interest, tax, afterTax, total: principal + afterTax };
}

/** 세율 입력 편의 버튼. 값은 바뀔 수 있으므로 계산 로직에서 직접 쓰지 않는다. */
export const TAX_PRESETS = [
  { label: '일반과세', rate: 15.4 },
  { label: '비과세', rate: 0 },
  { label: '세금우대', rate: 9.5 },
];
