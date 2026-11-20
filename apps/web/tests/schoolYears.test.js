import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elementaryEntry, isEarlyBorn, schoolTimeline, gradeNow } from '../src/lib/schoolYears.js';

test('초등학교 입학 연도', () => {
  assert.equal(elementaryEntry(1998), 2005);
  assert.equal(elementaryEntry(2003, 1), 2010); // 빠른년생 폐지 뒤
  assert.equal(elementaryEntry(2002, 3), 2009);
  assert.equal(elementaryEntry(2002, 2), 2008); // 마지막 빠른년생
  assert.equal(elementaryEntry(1995, 1), 2001);
  assert.equal(elementaryEntry(1995, 12), 2002);
  assert.equal(elementaryEntry(2019, 5, -1), 2025); // 조기입학
  assert.equal(elementaryEntry(2019, 5, 1), 2027); // 입학 유예
  assert.equal(elementaryEntry(1800), null);
  assert.equal(elementaryEntry(''), null);
});

test('빠른년생', () => {
  assert.equal(isEarlyBorn(2002, 1), true);
  assert.equal(isEarlyBorn(2002, 3), false);
  assert.equal(isEarlyBorn(2003, 1), false);
  assert.equal(isEarlyBorn(1990, 0), false);
});

test('학교별 입학·졸업', () => {
  const t = schoolTimeline({ birthYear: 1998 });
  assert.deepEqual(t.rows.map((r) => [r.entry, r.grad]), [[2005, 2011], [2011, 2014], [2014, 2017], [2017, 2021]]);
  assert.equal(t.hakbeon, '17');
  assert.equal(t.early, false);
  const u = schoolTimeline({ birthYear: 1998, retake: 1, leave: 2, uniYears: 4 });
  assert.deepEqual(u.rows.at(-1), { key: 'uni', name: '대학교 (4년제)', entry: 2018, grad: 2024 });
  assert.equal(u.hakbeon, '18');
  assert.equal(schoolTimeline({ birthYear: 2006, uniYears: 2 }).rows.at(-1).grad, 2027);
  assert.equal(schoolTimeline({ birthYear: 1999, birthMonth: 2 }).early, true);
  assert.equal(schoolTimeline({ birthYear: 1991, uniYears: 4 }).hakbeon, '10');
  assert.equal(schoolTimeline({ birthYear: 1993 }).hakbeon, '12');
  assert.equal(schoolTimeline({ birthYear: 1991, retake: -3 }).rows.at(-1).entry, 2010); // 음수는 0
  assert.equal(schoolTimeline({ birthYear: 'x' }), null);
});

test('오늘 기준 학년 (3월에 바뀜)', () => {
  assert.equal(gradeNow(2026, '2026-03-02').label, '초등학교 1학년');
  assert.equal(gradeNow(2026, '2026-02-28').label, '초등학교 입학 전');
  assert.equal(gradeNow(2021, '2026-11-21').label, '초등학교 6학년');
  assert.equal(gradeNow(2021, '2027-03-01').label, '중학교 1학년');
  assert.equal(gradeNow(2015, '2026-11-21').label, '고등학교 3학년');
  assert.equal(gradeNow(2014, '2026-11-21').label, '고등학교 졸업');
});
