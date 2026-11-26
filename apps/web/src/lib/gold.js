// 금값 계산기 로직. 시세는 사용자가 넣는다(하드코딩하지 않음). 단위·순도는 바뀌지 않는 정의값이다.
// 순도별 금액은 "금 함량" 기준 계산이라, 금은방이 실제로 쳐주는 18K·14K 가격과는 다를 수 있다.

/** 무게 단위 → g */
export const UNITS = {
  g: { label: 'g', grams: 1 },
  don: { label: '돈', grams: 3.75 },
  nyang: { label: '냥', grams: 37.5 },
  oz: { label: '트로이온스', grams: 31.1034768 },
};

/** 순도: 순금 대비 금 함량 비율 */
export const PURITY = {
  '24k': { label: '순금 (24K)', ratio: 1 },
  '18k': { label: '18K', ratio: 0.75 },
  '14k': { label: '14K', ratio: 0.585 },
};

/** 자주 찾는 무게 (돈 기준) */
export const WEIGHT_PRESETS = [0.5, 1, 2, 3, 5, 10];

/** 숫자 칸 값 → 숫자 (쉼표·공백 허용). 비었거나 이상하면 NaN */
export function num(v) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[,\s원]/g, '');
  return s === '' ? NaN : Number(s);
}

/** 입력한 시세 → 순금 1g 가격. basis: 'g' 또는 'don' (1돈 가격으로 넣었을 때) */
export function pricePerGram(price, basis = 'don') {
  const p = num(price);
  if (!(p > 0) || !Number.isFinite(p)) return null;
  return basis === 'g' ? p : p / UNITS.don.grams;
}

const toGrams = (w, unit) => num(w) * (UNITS[unit]?.grams ?? NaN);

/**
 * 무게 → 금액
 * @returns {null | { grams: number, don: number, won: number }}
 */
export function valueOf(weight, unit, purity, perGram) {
  const g = toGrams(weight, unit);
  const r = PURITY[purity]?.ratio;
  if (!(g > 0) || !Number.isFinite(g) || !r || !(perGram > 0)) return null;
  return { grams: g, don: g / UNITS.don.grams, won: Math.round(g * perGram * r) };
}

/**
 * 금액(예산) → 살 수 있는 무게
 * @returns {null | { grams: number, don: number }}
 */
export function weightFor(budget, purity, perGram) {
  const b = num(budget);
  const r = PURITY[purity]?.ratio;
  if (!(b > 0) || !Number.isFinite(b) || !r || !(perGram > 0)) return null;
  const g = b / (perGram * r);
  return { grams: g, don: g / UNITS.don.grams };
}

/** 단위 바꾸기 */
export function convert(weight, from, to) {
  const g = toGrams(weight, from);
  if (!(g >= 0) || !Number.isFinite(g) || !UNITS[to]) return null;
  return g / UNITS[to].grams;
}

/** 순도별·무게별 한눈에 보기 표 */
export function priceTable(perGram, dons = [1, 2, 3, 5, 10]) {
  if (!(perGram > 0)) return [];
  return dons.map((d) => ({ don: d, values: Object.fromEntries(Object.keys(PURITY).map((k) => [k, valueOf(d, 'don', k, perGram).won])) }));
}

/** 무게 표시: 소수 둘째 자리까지, 필요 없는 0은 뺀다 */
export function fmtWeight(n, digits = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '-';
  return (Math.round(n * 10 ** digits) / 10 ** digits).toLocaleString('ko-KR', { maximumFractionDigits: digits });
}
