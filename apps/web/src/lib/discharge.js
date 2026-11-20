// 전역일 계산기 로직. 복무 기간(개월)은 병역 제도에 따라 바뀌므로 하드코딩하지 않고 사용자가 입력한다.
// 전역일 = 입대일부터 N개월 뒤 같은 날의 전날 (입대일을 1일째로 셈).
// 그 같은 날이 없는 달이면(8/31 입대 → 2월) 그 달 말일로 끝난다 (민법 제160조 기간 계산 방식).
import { parseDate, toDayNum, fromDayNum, addDays, daysInMonth } from './date.js';

/** 전역(소집해제) 예정일. 형식이 틀리거나 개월 수가 이상하면 null */
export function dischargeDate(start, months) {
  const p = parseDate(start);
  const n = Number(months);
  if (!p || !Number.isInteger(n) || n < 1 || n > 120) return null;
  const total = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(total / 12), m = (total % 12) + 1;
  const last = daysInMonth(y, m);
  const ymd = (d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return p.d > last ? ymd(last) : addDays(ymd(p.d), -1);
}

/**
 * 복무 현황
 * @returns {null | { end: string, total: number, served: number, left: number, percent: number, state: 'before'|'serving'|'done' }}
 * - total: 입대일~전역일 전체 일수 (양 끝 포함)
 * - served: 오늘까지 복무한 일수 (입대일 = 1일째)
 * - left: 전역일까지 남은 일수 (전역일 당일 = 0)
 */
export function serviceStatus(start, months, today) {
  const end = dischargeDate(start, months);
  const s = toDayNum(start), t = toDayNum(today);
  if (!end || t === null) return null;
  const e = toDayNum(end);
  const total = e - s + 1;
  const served = Math.min(Math.max(t - s + 1, 0), total);
  const state = t < s ? 'before' : t > e ? 'done' : 'serving';
  return { end, total, served, left: Math.max(e - t, 0), percent: (served / total) * 100, state };
}

/** 복무 중 기념일: 100일 단위, 절반(반환점), 전역 100일 전, 전역일 */
export function milestones(start, months) {
  const end = dischargeDate(start, months);
  if (!end) return [];
  const s = toDayNum(start), e = toDayNum(end);
  const list = [];
  for (let n = 100; s + n - 1 < e; n += 100) list.push({ label: `복무 ${n}일`, date: fromDayNum(s + n - 1) });
  list.push({ label: '반환점 (복무 절반)', date: fromDayNum(s + Math.floor((e - s) / 2)) });
  if (e - 100 > s) list.push({ label: '전역 D-100', date: fromDayNum(e - 100) });
  list.push({ label: '전역일', date: end });
  return list.sort((a, b) => a.date.localeCompare(b.date));
}
