// 졸업년도 계산기 로직. 한국 학제(초 6·중 3·고 3년, 3월 입학·2월 졸업) 기준.
// - 초등학교 입학: 만 6세가 되는 해의 다음 해 3월 = 출생연도 + 7
// - 빠른년생: 2008학년도까지는 3월~다음 해 2월생이 한 학년이라, 2002년 이전 1·2월생은 한 해 일찍(출생연도 + 6) 입학했다.
//   2009학년도부터 1월~12월생이 한 학년 (2002년 1·2월생은 이미 2008학년도에 입학)
// - 조기입학·입학 유예, 재수, 휴학은 사람마다 달라서 사용자가 조정한다.

export const LAST_EARLY_YEAR = 2002;

/** 빠른년생인지 (출생월을 모르면 false) */
export const isEarlyBorn = (birthYear, birthMonth) => birthYear <= LAST_EARLY_YEAR && (birthMonth === 1 || birthMonth === 2);

const okYear = (y) => Number.isInteger(y) && y >= 1930 && y <= 2030;

/** 초등학교 입학 연도. adjust: 조기입학 -1, 입학 유예 +1 */
export function elementaryEntry(birthYear, birthMonth, adjust = 0) {
  const y = Number(birthYear);
  if (!okYear(y)) return null;
  const m = Number(birthMonth) || 0;
  return y + 7 - (isEarlyBorn(y, m) ? 1 : 0) + (Number(adjust) || 0);
}

/**
 * 학교별 입학·졸업 연도
 * @param {{ birthYear:number, birthMonth?:number, adjust?:number, retake?:number, leave?:number, uniYears?:number }} o
 * - retake: 재수 등으로 대학을 늦게 들어간 햇수, leave: 대학 휴학(군 휴학 포함) 햇수, uniYears: 대학 수업 연한(2·3·4·6)
 * @returns {null | { early:boolean, rows:{ key:string, name:string, entry:number, grad:number }[], hakbeon:string }}
 */
export function schoolTimeline(o) {
  const e = elementaryEntry(o.birthYear, o.birthMonth, o.adjust);
  if (e === null) return null;
  const retake = clampInt(o.retake, 0, 10), leave = clampInt(o.leave, 0, 10);
  const uni = [2, 3, 4, 5, 6].includes(Number(o.uniYears)) ? Number(o.uniYears) : 4;
  const uEntry = e + 12 + retake;
  return {
    early: isEarlyBorn(Number(o.birthYear), Number(o.birthMonth) || 0),
    rows: [
      { key: 'elem', name: '초등학교', entry: e, grad: e + 6 },
      { key: 'mid', name: '중학교', entry: e + 6, grad: e + 9 },
      { key: 'high', name: '고등학교', entry: e + 9, grad: e + 12 },
      { key: 'uni', name: `대학교 (${uni}년제)`, entry: uEntry, grad: uEntry + uni + leave },
    ],
    hakbeon: String(uEntry % 100).padStart(2, '0'),
  };
}

function clampInt(v, min, max) {
  const n = Math.trunc(Number(v) || 0);
  return Math.min(max, Math.max(min, n));
}

/**
 * 오늘 기준 학년. 학년도는 3월에 바뀐다 (1·2월은 전 학년도)
 * @param {number} entry 초등학교 입학 연도
 * @param {string} today 'YYYY-MM-DD'
 */
export function gradeNow(entry, today) {
  const [y, m] = today.split('-').map(Number);
  const schoolYear = m >= 3 ? y : y - 1;
  const g = schoolYear - entry + 1;
  if (g < 1) return { schoolYear, label: '초등학교 입학 전' };
  if (g <= 6) return { schoolYear, label: `초등학교 ${g}학년` };
  if (g <= 9) return { schoolYear, label: `중학교 ${g - 6}학년` };
  if (g <= 12) return { schoolYear, label: `고등학교 ${g - 9}학년` };
  return { schoolYear, label: '고등학교 졸업' };
}
