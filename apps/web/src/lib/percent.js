// 퍼센트 계산. 결과는 소수 둘째 자리 반올림, 0으로 나누면 null.
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** A의 B%는? */
export const percentOf = (a, b) => round2((a * b) / 100);

/** A는 B의 몇 %? */
export const ratio = (a, b) => (b === 0 ? null : round2((a / b) * 100));

/** A → B 증감률(%) */
export const changeRate = (a, b) => (a === 0 ? null : round2(((b - a) / Math.abs(a)) * 100));

/** 정가·할인율(%) → 할인가와 할인액 */
export function discountPrice(price, rate) {
  const sale = round2(price * (1 - rate / 100));
  return { sale, off: round2(price - sale) };
}

/** 정가·할인가 → 할인율(%) */
export const discountRate = (price, sale) => (price === 0 ? null : round2(((price - sale) / price) * 100));

/** 입력 문자열 → 숫자(음수·소수·쉼표 허용). 비었으면 null */
export function num(str) {
  const s = String(str ?? '').replace(/,/g, '').trim();
  if (s === '' || !/^-?\d*\.?\d*$/.test(s) || s === '-' || s === '.') return null;
  return Number(s);
}
