import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dischargeDate, serviceStatus, milestones } from '../src/lib/discharge.js';

test('전역일: N개월 뒤 같은 날의 전날', () => {
  assert.equal(dischargeDate('2025-01-06', 18), '2026-07-05');
  assert.equal(dischargeDate('2025-03-01', 18), '2026-08-31'); // 9/1의 전날
  assert.equal(dischargeDate('2025-12-15', 20), '2027-08-14');
  assert.equal(dischargeDate('2025-01-01', 12), '2025-12-31');
});

test('전역일: 같은 날이 없는 달이면 그 달 말일', () => {
  assert.equal(dischargeDate('2024-08-31', 18), '2026-02-28');
  assert.equal(dischargeDate('2024-08-30', 18), '2026-02-28');
  assert.equal(dischargeDate('2024-08-29', 18), '2026-02-28'); // 2/29 없음
  assert.equal(dischargeDate('2026-08-29', 18), '2028-02-28'); // 2028년은 2/29 있음 → 그 전날
  assert.equal(dischargeDate('2026-08-31', 18), '2028-02-29');
});

test('전역일: 잘못된 값', () => {
  assert.equal(dischargeDate('2025-02-30', 18), null);
  assert.equal(dischargeDate('', 18), null);
  assert.equal(dischargeDate('2025-01-06', 0), null);
  assert.equal(dischargeDate('2025-01-06', 18.5), null);
  assert.equal(dischargeDate('2025-01-06', ''), null);
});

test('복무 현황', () => {
  const a = serviceStatus('2025-01-06', 18, '2025-01-06');
  assert.equal(a.end, '2026-07-05');
  assert.equal(a.total, 546);
  assert.equal(a.served, 1);
  assert.equal(a.left, 545);
  assert.equal(a.state, 'serving');
  const b = serviceStatus('2025-01-06', 18, '2026-07-05');
  assert.equal(b.served, 546);
  assert.equal(b.left, 0);
  assert.equal(b.percent, 100);
  assert.equal(serviceStatus('2025-01-06', 18, '2025-01-01').state, 'before');
  assert.equal(serviceStatus('2025-01-06', 18, '2025-01-01').served, 0);
  assert.equal(serviceStatus('2025-01-06', 18, '2026-07-06').state, 'done');
});

test('기념일', () => {
  const m = milestones('2025-01-06', 18);
  assert.deepEqual(m[0], { label: '복무 100일', date: '2025-04-15' });
  assert.equal(m.at(-1).date, '2026-07-05');
  assert.ok(m.some((x) => x.label === '전역 D-100' && x.date === '2026-03-27'));
  assert.ok(m.some((x) => x.label.startsWith('반환점')));
  assert.equal(m.filter((x) => x.label.startsWith('복무 ')).length, 5); // 100~500일
  for (let i = 1; i < m.length; i++) assert.ok(m[i - 1].date <= m[i].date);
});
