// 학점(평점) 계산기 로직. 정부 기준값이 아니라 대학에서 널리 쓰는 등급별 점수표를 쓰고,
// 학교마다 다를 수 있다는 점은 페이지에서 안내한다.
// 소수 오차를 피하려고 점수는 100배 정수로 계산한다.

/** 만점별 등급 → 평점 */
export const SCALES = {
  '4.5': [['A+', 4.5], ['A0', 4.0], ['B+', 3.5], ['B0', 3.0], ['C+', 2.5], ['C0', 2.0], ['D+', 1.5], ['D0', 1.0], ['F', 0]],
  '4.3': [['A+', 4.3], ['A0', 4.0], ['A-', 3.7], ['B+', 3.3], ['B0', 3.0], ['B-', 2.7], ['C+', 2.3], ['C0', 2.0], ['C-', 1.7], ['D+', 1.3], ['D0', 1.0], ['D-', 0.7], ['F', 0]],
};
/** 평점에 들어가지 않는 성적 (P는 이수학점에만, NP는 둘 다 아님) */
export const PASS = ['P', 'NP'];

export function gradesOf(scale) {
  return [...SCALES[scale].map(([g]) => g), ...PASS];
}

function pointOf(scale, grade) {
  const hit = SCALES[scale]?.find(([g]) => g === grade);
  return hit ? hit[1] : null;
}

const cr = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 30 ? n : 0;
};

/**
 * rows: [{ credit, grade, major }]
 * 반환: { gpa, gpaCredits, earned, major: { gpa, credits }, counted }
 * - gpa: 평점평균 (P/NP 제외, F 포함). 평점 낼 과목이 없으면 null
 * - earned: 이수학점 (F·NP 제외, P 포함)
 */
export function calcGpa(rows, scale = '4.5') {
  let sum = 0, credits = 0, earned = 0, mSum = 0, mCredits = 0, counted = 0;
  for (const r of rows ?? []) {
    const c = cr(r.credit);
    if (!c || !r.grade) continue;
    counted++;
    if (r.grade === 'P') { earned += c; continue; }
    if (r.grade === 'NP') continue;
    const p = pointOf(scale, r.grade);
    if (p === null) continue;
    const pts = Math.round(p * 100) * c;
    sum += pts; credits += c;
    if (p > 0) earned += c;
    if (r.major) { mSum += pts; mCredits += c; }
  }
  return {
    gpa: credits ? sum / credits / 100 : null,
    gpaCredits: credits,
    earned,
    major: { gpa: mCredits ? mSum / mCredits / 100 : null, credits: mCredits },
    counted,
  };
}

/** 이전 누적(평점·평점 반영 학점)과 이번 학기를 합친 누적 평점 */
export function combine(prevGpa, prevCredits, curGpa, curCredits) {
  // 누적 학점은 수십~백몇십 학점이라 과목 학점 검사(cr, 30 이하)를 쓰면 안 된다
  const n0 = Number(prevCredits);
  const pc = prevCredits !== '' && Number.isFinite(n0) && n0 > 0 && n0 <= 1000 ? n0 : 0;
  const pg = Number(prevGpa);
  const hasPrev = pc > 0 && prevGpa !== '' && prevGpa !== null && prevGpa !== undefined && Number.isFinite(pg);
  const hasCur = curCredits > 0 && curGpa !== null && Number.isFinite(curGpa);
  if (!hasPrev && !hasCur) return null;
  const a = hasPrev ? pg * pc : 0;
  const b = hasCur ? curGpa * curCredits : 0;
  const n = (hasPrev ? pc : 0) + (hasCur ? curCredits : 0);
  return { gpa: (a + b) / n, credits: n };
}

/** 만점 비율 그대로 환산 (예: 4.5 만점 4.0 → 4.3 만점 3.82). 학교 공식 환산표와 다를 수 있다 */
export function convertScale(gpa, from, to) {
  if (gpa === '' || gpa === null || gpa === undefined) return null;
  const g = Number(gpa), f = Number(from), t = Number(to);
  if (!Number.isFinite(g) || !(f > 0) || !(t > 0) || g < 0 || g > f) return null;
  return (g / f) * t;
}

/**
 * 목표 평점에 닿으려면 남은 학점에서 받아야 할 평균 평점
 * 반환: { need, possible, done } — done: 이미 목표 이상, possible: 만점 안에서 가능한지
 */
export function neededGpa(curGpa, curCredits, target, remaining, max) {
  if ([curGpa, curCredits, target, remaining].some((v) => v === '' || v === null || v === undefined)) return null;
  const g = Number(curGpa), c = Number(curCredits), t = Number(target), r = Number(remaining), m = Number(max);
  if (![g, c, t, r, m].every(Number.isFinite) || c < 0 || r <= 0 || t < 0 || t > m || g < 0 || g > m) return null;
  const need = (t * (c + r) - g * c) / r;
  return { need: Math.max(0, need), possible: need <= m + 1e-9, done: need <= 0 };
}

/** 소수 둘째 자리까지 (반올림). 학교마다 버림을 쓰기도 해서 화면에 안내한다 */
export function fmt(v, digits = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-';
  return (Math.round(v * 10 ** digits + 1e-9) / 10 ** digits).toFixed(digits);
}
