// 두 날짜 사이 기간. 종료일 - 시작일 = 일수, includeStart면 +1(시작일을 1일째로).
// 평일 수는 실제로 세는 날짜 범위(포함 여부 반영)에서 월~금만 센다. 공휴일은 빼지 않는다.
import { toDayNum, monthsAndDays, fromDayNum } from './date.js';

/** fromNum~toNum(양 끝 포함, 일수) 중 월~금 개수 */
export function countWeekdays(fromNum, toNum) {
  if (toNum < fromNum) return 0;
  const total = toNum - fromNum + 1;
  let count = Math.floor(total / 7) * 5;
  const startWd = new Date(fromNum * 86400000).getUTCDay();
  for (let i = 0; i < total % 7; i++) {
    const wd = (startWd + i) % 7;
    if (wd !== 0 && wd !== 6) count++;
  }
  return count;
}

/** @returns {{ days:number, weeks:number, restDays:number, months:number, monthRestDays:number, weekdays:number, swapped:boolean } | { error:string }} */
export function daysBetween(startStr, endStr, includeStart = false) {
  let s = toDayNum(startStr), e = toDayNum(endStr);
  if (s === null) return { error: '시작일을 올바르게 입력해 주세요.' };
  if (e === null) return { error: '종료일을 올바르게 입력해 주세요.' };
  const swapped = s > e;
  if (swapped) [s, e] = [e, s];
  const plus = includeStart ? 1 : 0;
  const days = e - s + plus;
  const md = monthsAndDays(fromDayNum(s), fromDayNum(e));
  return {
    days,
    weeks: Math.floor(days / 7), restDays: days % 7,
    months: md.months, monthRestDays: md.days + plus,
    weekdays: countWeekdays(includeStart ? s : s + 1, e),
    swapped,
  };
}
