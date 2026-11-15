// 대출 상환 스케줄. 금리는 사용자 입력(연 %), 이자는 월 단위(연 금리 ÷ 12)로 계산한다.
// 매달 이자는 원 단위 반올림, 원금 반올림 오차는 마지막 회차에서 남은 잔액으로 보정한다.
// 거치기간 동안은 이자만 낸다.

export const METHODS = {
  'equal-payment': '원리금균등',
  'equal-principal': '원금균등',
  bullet: '만기일시',
};

/**
 * @param {{ principal:number, annualRate:number, months:number, method:keyof typeof METHODS, graceMonths?:number }} p
 * @returns {{ rows:{ no:number, payment:number, principal:number, interest:number, balance:number }[], totalInterest:number, totalPayment:number, firstPayment:number, lastPayment:number } | { error:string }}
 */
export function loanSchedule({ principal, annualRate, months, method, graceMonths = 0 }) {
  if (!(principal > 0)) return { error: '대출금을 입력해 주세요.' };
  if (!(annualRate >= 0) || annualRate > 100) return { error: '연 금리를 0~100% 사이로 입력해 주세요.' };
  if (!Number.isInteger(months) || months < 1 || months > 600) return { error: '대출 기간을 1~600개월 사이로 입력해 주세요.' };
  if (!Number.isInteger(graceMonths) || graceMonths < 0 || graceMonths >= months) return { error: '거치기간은 대출 기간보다 짧아야 해요.' };
  if (!(method in METHODS)) return { error: '상환 방식을 골라 주세요.' };

  const r = annualRate / 100 / 12;
  const n = months - graceMonths; // 원금을 갚는 회차 수
  const rows = [];
  let balance = Math.round(principal);
  const interestOf = (b) => Math.round(b * r);

  for (let i = 1; i <= graceMonths; i++) {
    const interest = interestOf(balance);
    rows.push({ no: i, payment: interest, principal: 0, interest, balance });
  }

  const fixedPayment = method === 'equal-payment'
    ? (r === 0 ? balance / n : (balance * r * (1 + r) ** n) / ((1 + r) ** n - 1))
    : 0;
  const fixedPrincipal = balance / n;

  for (let k = 1; k <= n; k++) {
    const interest = interestOf(balance);
    let pay;
    if (k === n) pay = balance; // 마지막 회차: 남은 원금 전부
    else if (method === 'equal-payment') pay = Math.round(fixedPayment) - interest;
    else if (method === 'equal-principal') pay = Math.round(fixedPrincipal);
    else pay = 0; // 만기일시: 이자만
    pay = Math.min(Math.max(pay, 0), balance);
    balance -= pay;
    rows.push({ no: graceMonths + k, payment: pay + interest, principal: pay, interest, balance });
  }

  const totalInterest = rows.reduce((s, x) => s + x.interest, 0);
  return {
    rows,
    totalInterest,
    totalPayment: Math.round(principal) + totalInterest,
    firstPayment: rows[graceMonths].payment,
    lastPayment: rows[rows.length - 1].payment,
  };
}

/** 상환표 → CSV 문자열 (엑셀 한글 깨짐 방지 BOM 포함) */
export function scheduleToCsv(rows) {
  const head = '회차,상환금,원금,이자,잔액';
  return '﻿' + [head, ...rows.map((x) => [x.no, x.payment, x.principal, x.interest, x.balance].join(','))].join('\r\n');
}
