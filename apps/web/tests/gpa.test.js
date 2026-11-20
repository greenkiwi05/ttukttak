import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcGpa, combine, convertScale, neededGpa, fmt, gradesOf } from '../src/lib/gpa.js';

test('4.5 만점 평점평균', () => {
  const r = calcGpa([
    { credit: 3, grade: 'A+' },
    { credit: 3, grade: 'B+', major: true },
    { credit: 2, grade: 'A0', major: true },
    { credit: 1, grade: 'P' },
  ], '4.5');
  // (13.5 + 10.5 + 8) / 8 = 4.0
  assert.equal(r.gpa, 4);
  assert.equal(r.gpaCredits, 8);
  assert.equal(r.earned, 9);
  assert.equal(fmt(r.major.gpa), '3.70'); // (10.5 + 8) / 5
  assert.equal(r.major.credits, 5);
});

test('F는 평점에 넣고 이수학점에서 빼고, NP는 둘 다 빼요', () => {
  const r = calcGpa([{ credit: 3, grade: 'A+' }, { credit: 3, grade: 'F' }, { credit: 2, grade: 'NP' }], '4.5');
  assert.equal(r.gpa, 2.25);
  assert.equal(r.gpaCredits, 6);
  assert.equal(r.earned, 3);
});

test('4.3 만점 (마이너스 등급)', () => {
  const r = calcGpa([{ credit: 3, grade: 'A-' }, { credit: 3, grade: 'B-' }], '4.3');
  assert.equal(fmt(r.gpa), '3.20');
  assert.equal(calcGpa([{ credit: 3, grade: 'A-' }], '4.5').gpa, null); // 4.5 만점엔 A-가 없음
});

test('소수 오차 없음', () => {
  const r = calcGpa([{ credit: 3, grade: 'C+' }, { credit: 3, grade: 'B-' }, { credit: 1, grade: 'D-' }], '4.3');
  assert.equal(fmt(r.gpa), '2.24'); // (6.9 + 8.1 + 0.7) / 7 = 2.2428…
  assert.equal(calcGpa([{ credit: 3, grade: 'A-' }, { credit: 3, grade: 'B+' }], '4.3').gpa, 3.5); // 정확히 3.5
});

test('빈 값·이상한 값은 건너뜀', () => {
  const r = calcGpa([{ credit: '', grade: 'A+' }, { credit: 3, grade: '' }, { credit: -1, grade: 'A+' }, { credit: 'abc', grade: 'B0' }], '4.5');
  assert.equal(r.gpa, null);
  assert.equal(r.counted, 0);
  assert.equal(calcGpa(null).gpa, null);
});

test('누적 합치기', () => {
  assert.deepEqual(combine(3.5, 30, 4.0, 15), { gpa: 3.6666666666666665, credits: 45 });
  assert.deepEqual(combine('', '', 4.0, 15), { gpa: 4, credits: 15 });
  assert.deepEqual(combine(3.5, 30, null, 0), { gpa: 3.5, credits: 30 });
  assert.equal(combine('', '', null, 0), null);
});

test('만점 환산', () => {
  assert.equal(fmt(convertScale(4.0, 4.5, 4.3)), '3.82');
  assert.equal(fmt(convertScale(3.8, 4.3, 4.5)), '3.98');
  assert.equal(fmt(convertScale(4.5, 4.5, 100)), '100.00');
  assert.equal(convertScale(4.6, 4.5, 4.3), null);
  assert.equal(convertScale('', 4.5, 4.3), null);
});

test('목표 평점까지 필요한 평균', () => {
  const a = neededGpa(3.5, 60, 3.8, 60, 4.5);
  assert.equal(fmt(a.need), '4.10');
  assert.equal(a.possible, true);
  const b = neededGpa(3.0, 100, 4.0, 20, 4.5);
  assert.equal(b.possible, false); // 9.0 필요
  const c = neededGpa(4.4, 90, 3.0, 10, 4.5);
  assert.equal(c.done, true);
  assert.equal(c.need, 0);
  assert.equal(neededGpa(3.5, 60, 3.8, 0, 4.5), null);
  assert.equal(neededGpa(3.5, 60, 4.8, 10, 4.5), null);
  assert.equal(neededGpa('', '', 3.8, 10, 4.5), null);
});

test('성적 목록', () => {
  assert.deepEqual(gradesOf('4.5').slice(-3), ['F', 'P', 'NP']);
  assert.equal(gradesOf('4.3').length, 15);
});
