// 커플 기념일. 한국 커플 관행은 사귄 날을 1일로 센다(startIsDay1=true).
// N일 기념일 = 시작일 + (N-1)일 (startIsDay1) / 시작일 + N일 (아니면).
// 주년은 날짜 기준(2/29 시작은 평년에 3/1).
import { toDayNum, addDays, parseDate, isLeap } from './date.js';

export function dayCount(startStr, todayStr, startIsDay1 = true) {
  return toDayNum(todayStr) - toDayNum(startStr) + (startIsDay1 ? 1 : 0);
}

export function nthDayDate(startStr, n, startIsDay1 = true) {
  return addDays(startStr, startIsDay1 ? n - 1 : n);
}

export function yearDate(startStr, k) {
  const p = parseDate(startStr);
  const y = p.y + k;
  let m = p.m, d = p.d;
  if (m === 2 && d === 29 && !isLeap(y)) { m = 3; d = 1; }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * 100~3000일, 1~10주년 표. 날짜순 정렬, 지난 것(past)과 다가오는 첫 기념일(next) 표시.
 * @returns {{ today:number, list:{ name:string, date:string, dLeft:number, past:boolean, next:boolean }[] } | { error:string }}
 */
export function anniversaries(startStr, todayStr, startIsDay1 = true) {
  const s = toDayNum(startStr), t = toDayNum(todayStr);
  if (s === null) return { error: '사귄 날을 올바르게 입력해 주세요.' };
  if (t === null) return { error: '기준일을 올바르게 입력해 주세요.' };
  if (s > t) return { error: '사귄 날이 오늘보다 늦어요.' };
  const items = [];
  for (let n = 100; n <= 3000; n += 100) items.push({ name: `${n}일`, date: nthDayDate(startStr, n, startIsDay1) });
  for (let k = 1; k <= 10; k++) items.push({ name: `${k}주년`, date: yearDate(startStr, k) });
  items.sort((a, b) => a.date.localeCompare(b.date));
  let nextMarked = false;
  const list = items.map((it) => {
    const dLeft = toDayNum(it.date) - t;
    const past = dLeft < 0;
    const next = !past && !nextMarked;
    if (next) nextMarked = true;
    return { ...it, dLeft, past, next };
  });
  return { today: dayCount(startStr, todayStr, startIsDay1), list };
}
