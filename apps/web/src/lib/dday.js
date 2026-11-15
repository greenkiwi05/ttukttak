// D-day 계산. diff = 목표일 - 기준일 (일).
// includeToday: 기준일(오늘)을 1일째로 센다 → 남은/지난 일수에 1을 더한다 (D-Day 당일은 그대로).
import { toDayNum, monthsAndDays } from './date.js';

/**
 * @returns {{ label:string, days:number, diff:number, weeks:number, restDays:number, months:number, monthRestDays:number } | { error:string }}
 */
export function calcDday(targetStr, baseStr, includeToday = false) {
  const t = toDayNum(targetStr), b = toDayNum(baseStr);
  if (t === null) return { error: '목표일을 올바르게 입력해 주세요.' };
  if (b === null) return { error: '기준일을 올바르게 입력해 주세요.' };
  const diff = t - b;
  const plus = includeToday && diff !== 0 ? 1 : 0;
  const days = Math.abs(diff) + plus;
  const label = diff === 0 ? 'D-Day' : diff > 0 ? `D-${days}` : `D+${days}`;
  const [from, to] = diff >= 0 ? [baseStr, targetStr] : [targetStr, baseStr];
  const md = monthsAndDays(from, to);
  return {
    label, days, diff,
    weeks: Math.floor(days / 7), restDays: days % 7,
    months: md.months, monthRestDays: md.days + plus,
  };
}
