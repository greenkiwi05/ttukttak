// 날짜 도구 공용 함수. 모든 날짜는 'YYYY-MM-DD' 문자열, 계산은 UTC 일(day) 단위 정수로 한다.
import { parseDate, todayKST } from './age.js';

export { parseDate, todayKST };

const DAY = 86400000;
export const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** 'YYYY-MM-DD' → 1970-01-01부터의 일수. 형식이 틀리면 null */
export function toDayNum(str) {
  const p = parseDate(str);
  return p ? Date.UTC(p.y, p.m - 1, p.d) / DAY : null;
}

/** 일수 → 'YYYY-MM-DD' */
export function fromDayNum(n) {
  return new Date(n * DAY).toISOString().slice(0, 10);
}

export const addDays = (str, n) => fromDayNum(toDayNum(str) + n);

/** n개월 뒤. 말일을 넘으면 그 달 말일로 맞춘다 (1/31 + 1개월 = 2/28) */
export function addMonths(str, n) {
  const p = parseDate(str);
  const total = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(total / 12), m = (total % 12) + 1;
  const d = Math.min(p.d, daysInMonth(y, m));
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 0=일 … 6=토 */
export const weekday = (str) => new Date(toDayNum(str) * DAY).getUTCDay();

const WD = ['일', '월', '화', '수', '목', '금', '토'];
/** '2026-11-15' → '2026. 11. 15. (일)' */
export function formatKo(str) {
  const p = parseDate(str);
  return `${p.y}. ${p.m}. ${p.d}. (${WD[weekday(str)]})`;
}

/** start~end 사이 달력상 개월 수와 남은 일수 (start ≤ end) */
export function monthsAndDays(start, end) {
  const s = parseDate(start), e = parseDate(end);
  let months = (e.y - s.y) * 12 + (e.m - s.m);
  if (months > 0 && toDayNum(addMonths(start, months)) > toDayNum(end)) months--;
  if (months < 0) months = 0;
  return { months, days: toDayNum(end) - toDayNum(addMonths(start, months)) };
}
