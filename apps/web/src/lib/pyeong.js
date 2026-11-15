// 평 ↔ ㎡. 1평 = 400/121 ㎡ (= 3.3057851…㎡). 법정 단위 환산 비율이라 바뀌지 않는다.
export const M2_PER_PYEONG = 400 / 121;

const round = (n, digits) => Math.round(n * 10 ** digits) / 10 ** digits;

export const pyeongToM2 = (p, digits = 2) => round(p * M2_PER_PYEONG, digits);
export const m2ToPyeong = (m2, digits = 2) => round(m2 / M2_PER_PYEONG, digits);

/** 입력 문자열 → 0 이상 숫자. 쉼표 허용. 비었거나 이상하면 null */
export function parseArea(str) {
  const s = String(str ?? '').replace(/,/g, '').trim();
  if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.$/.test(s)) return null;
  return Number(s);
}

/** 아파트에서 자주 보는 전용면적(㎡) */
export const COMMON_M2 = [39, 49, 59, 74, 84, 101, 114, 135];
