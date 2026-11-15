import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDateInput, formatTyping, autoFormat, displayOf, monthGrid, shiftMonth, inRange } from '../src/lib/dateInput.js';

const NOW = new Date('2026-11-15T00:00:00Z');

test('날짜 입력 해석: 숫자 8자리·6자리', () => {
  assert.equal(parseDateInput('19980510', NOW), '1998-05-10');
  assert.equal(parseDateInput('980510', NOW), '1998-05-10');
  assert.equal(parseDateInput('050301', NOW), '2005-03-01');
  assert.equal(parseDateInput('261115', NOW), '2026-11-15');
  assert.equal(parseDateInput('271115', NOW), '1927-11-15');
  assert.equal(parseDateInput('9805.10', NOW), '1998-05-10'); // 6자리를 치는 중 자동 점이 찍힌 모양
  assert.equal(parseDateInput('1998.5', NOW), null);
});

test('날짜 입력 해석: 여러 구분자와 한글', () => {
  for (const s of ['1998.5.10', '1998-05-10', '1998/5/10', '1998 5 10', '1998년 5월 10일', '1998. 05. 10.', '98.5.10'])
    assert.equal(parseDateInput(s, NOW), '1998-05-10', s);
});

test('날짜 입력 해석: 없는 날짜·잘못된 형식은 null', () => {
  for (const s of ['', '1998', '199805', '19980230', '2026.13.1', '1998.5', '12345', '1.2.3.4', 'abc']) assert.equal(parseDateInput(s, NOW), null, s);
  assert.equal(parseDateInput('20240229', NOW), '2024-02-29');
  assert.equal(parseDateInput('20250229', NOW), null);
});

test('입력 중 자동 점 찍기', () => {
  assert.equal(formatTyping('1998'), '1998');
  assert.equal(formatTyping('19980'), '1998.0');
  assert.equal(formatTyping('199805'), '1998.05');
  assert.equal(formatTyping('1998051'), '1998.05.1');
  assert.equal(formatTyping('199805101'), '1998.05.10');
  assert.equal(formatTyping('1998.5'), '1998.5'); // 구분자를 직접 치면 그대로
  assert.equal(displayOf('1998-05-10'), '1998.05.10');
  assert.equal(displayOf(''), '');
});

test('달력 칸: 42칸, 1일 위치, 이전·다음 달 채움', () => {
  const g = monthGrid(2026, 11); // 2026-11-01은 일요일
  assert.equal(g.length, 42);
  assert.deepEqual(g[0], { iso: '2026-11-01', day: 1, inMonth: true });
  assert.equal(g.filter((c) => c.inMonth).length, 30);
  const f = monthGrid(2026, 2); // 2026-02-01은 일요일, 28일
  assert.equal(f.filter((c) => c.inMonth).length, 28);
  const j = monthGrid(2026, 1); // 2026-01-01은 목요일
  assert.equal(j[4].iso, '2026-01-01');
  assert.equal(j[0].iso, '2025-12-28');
  assert.deepEqual(shiftMonth(2026, 1, -1), { y: 2025, m: 12 });
  assert.deepEqual(shiftMonth(2026, 12, 1), { y: 2027, m: 1 });
  assert.ok(inRange('2026-01-01', '', '2026-12-31'));
  assert.ok(!inRange('2027-01-01', '1900-01-01', '2026-12-31'));
});

test('한 글자씩 칠 때 자동 점 찍기 (실제 입력 순서 그대로)', () => {
  let v = '';
  const seen = [];
  for (const ch of '19980510') { v = autoFormat(v + ch); seen.push(v); }
  assert.deepEqual(seen, ['1', '19', '199', '1998', '1998.0', '1998.05', '1998.05.1', '1998.05.10']);
  assert.equal(autoFormat('1998.05.101'), '1998.05.10'); // 8자리 넘으면 자름
  assert.equal(autoFormat('1998.'), '1998'); // 지우는 중
  // 직접 구분자를 치면 그대로
  let w = '';
  for (const ch of '1998.5.10') w = autoFormat(w + ch);
  assert.equal(w, '1998.5.10');
  assert.equal(autoFormat('1998-05-10'), '1998-05-10');
  assert.equal(autoFormat('1998년 5월'), '1998년 5월');
});
