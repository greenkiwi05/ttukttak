import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, monthsAndDays, formatKo } from '../src/lib/date.js';
import { calcDday } from '../src/lib/dday.js';
import { anniversaries, nthDayDate, yearDate, dayCount } from '../src/lib/anniversary.js';
import { daysBetween, countWeekdays } from '../src/lib/daysBetween.js';

test('date: 말일 보정, 개월+일, 요일 표기', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2026-11-15', 2), '2027-01-15');
  assert.deepEqual(monthsAndDays('2026-01-15', '2026-03-14'), { months: 1, days: 27 });
  assert.deepEqual(monthsAndDays('2026-01-15', '2026-03-15'), { months: 2, days: 0 });
  assert.equal(formatKo('2026-11-15'), '2026. 11. 15. (일)');
});

test('d-day: 같은 날, 하루 전/후', () => {
  assert.equal(calcDday('2026-11-15', '2026-11-15').label, 'D-Day');
  assert.equal(calcDday('2026-11-16', '2026-11-15').label, 'D-1');
  assert.equal(calcDday('2026-11-14', '2026-11-15').label, 'D+1');
});

test('d-day: 오늘 포함 옵션은 1일 추가 (당일은 D-Day 그대로)', () => {
  assert.equal(calcDday('2026-11-16', '2026-11-15', true).label, 'D-2');
  assert.equal(calcDday('2026-11-14', '2026-11-15', true).label, 'D+2');
  assert.equal(calcDday('2026-11-15', '2026-11-15', true).label, 'D-Day');
});

test('d-day: 윤년 2월, 연말 연초, 주·개월 환산', () => {
  assert.equal(calcDday('2028-03-01', '2028-02-28').days, 2);
  assert.equal(calcDday('2027-03-01', '2027-02-28').days, 1);
  assert.equal(calcDday('2027-01-01', '2026-12-31').label, 'D-1');
  const r = calcDday('2027-01-15', '2026-11-15');
  assert.equal(r.days, 61);
  assert.equal(r.weeks, 8); assert.equal(r.restDays, 5);
  assert.equal(r.months, 2); assert.equal(r.monthRestDays, 0);
  assert.ok(calcDday('', '2026-11-15').error);
});

test('기념일: 시작일 포함 여부에 따라 100일 날짜가 하루 차이', () => {
  assert.equal(nthDayDate('2026-01-01', 100, true), '2026-04-10');
  assert.equal(nthDayDate('2026-01-01', 100, false), '2026-04-11');
  assert.equal(dayCount('2026-01-01', '2026-01-01', true), 1);
  assert.equal(dayCount('2026-01-01', '2026-01-01', false), 0);
});

test('기념일: 주년, 2/29 시작, 정렬과 다음 기념일', () => {
  assert.equal(yearDate('2024-02-29', 1), '2025-03-01');
  assert.equal(yearDate('2024-02-29', 4), '2028-02-29');
  const r = anniversaries('2026-01-01', '2026-04-10');
  assert.equal(r.today, 100);
  const next = r.list.find((x) => x.next);
  assert.equal(next.name, '100일'); assert.equal(next.dLeft, 0);
  assert.equal(r.list.filter((x) => x.next).length, 1);
  assert.equal(r.list.length, 40);
  for (let i = 1; i < r.list.length; i++) assert.ok(r.list[i - 1].date <= r.list[i].date);
  assert.ok(anniversaries('2027-01-01', '2026-01-01').error);
});

test('날짜 사이: 일수·포함·뒤바뀐 입력', () => {
  assert.equal(daysBetween('2026-01-01', '2026-12-31').days, 364);
  assert.equal(daysBetween('2026-01-01', '2026-12-31', true).days, 365);
  const r = daysBetween('2026-12-31', '2026-01-01');
  assert.equal(r.swapped, true); assert.equal(r.days, 364);
  assert.equal(daysBetween('2026-11-15', '2026-11-15').days, 0);
});

test('날짜 사이: 평일 수 (주말 제외)', () => {
  // 2026-11-16(월) ~ 2026-11-22(일)
  assert.equal(daysBetween('2026-11-16', '2026-11-22', true).weekdays, 5);
  assert.equal(daysBetween('2026-11-16', '2026-11-22', false).weekdays, 4); // 시작일(월) 제외
  const a = 20000, b = 20400;
  let brute = 0;
  for (let d = a; d <= b; d++) { const w = new Date(d * 864e5).getUTCDay(); if (w && w !== 6) brute++; }
  assert.equal(countWeekdays(a, b), brute);
});
