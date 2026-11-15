import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcAge, parseDate } from '../src/lib/age.js';

test('생일 전/후', () => {
  assert.equal(calcAge('1998-05-10', '2026-05-09').manAge, 27);
  assert.equal(calcAge('1998-05-10', '2026-05-10').manAge, 28);
  assert.equal(calcAge('1998-05-10', '2026-11-13').yearAge, 28);
});

test('2월 29일생은 평년엔 3월 1일에 나이를 먹음', () => {
  assert.equal(calcAge('2000-02-29', '2025-02-28').manAge, 24);
  assert.equal(calcAge('2000-02-29', '2025-03-01').manAge, 25);
  assert.equal(calcAge('2000-02-29', '2028-02-29').manAge, 28);
});

test('다음 생일과 남은 날', () => {
  const r = calcAge('1998-11-14', '2026-11-13');
  assert.equal(r.nextBirthday, '2026-11-14');
  assert.equal(r.daysToNext, 1);
  const today = calcAge('1998-11-13', '2026-11-13');
  assert.equal(today.nextBirthday, '2027-11-13');
});

test('잘못된 입력', () => {
  assert.equal(parseDate('2026-02-30'), null);
  assert.ok(calcAge('2030-01-01', '2026-01-01').error);
  assert.ok(calcAge('', '2026-01-01').error);
});
