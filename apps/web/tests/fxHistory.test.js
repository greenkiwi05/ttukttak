import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stats, monthly, niceTicks, geometry, xTicks, nearest, fromDate, dateKo, loadHistory } from '../src/lib/fxHistory.js';

const pts = [['2026-10-30', 1300], ['2026-11-02', 1310], ['2026-11-03', 1290], ['2026-11-04', 1320]];

test('기간 통계', () => {
  const s = stats(pts);
  assert.deepEqual(s.min, { date: '2026-11-03', v: 1290 });
  assert.deepEqual(s.max, { date: '2026-11-04', v: 1320 });
  assert.equal(s.avg, 1305);
  assert.equal(s.diff, 20);
  assert.equal(s.pct, 1.54);
  assert.equal(stats([]), null);
});

test('월별 평균: 최근 달 먼저', () => {
  assert.deepEqual(monthly(pts), [
    { month: '2026-11', avg: 1306.67, min: 1290, max: 1320, n: 3 },
    { month: '2026-10', avg: 1300, min: 1300, max: 1300, n: 1 },
  ]);
});

test('눈금: 깔끔한 간격, 범위 포함', () => {
  const t = niceTicks(1287, 1323);
  assert.ok(t.lo <= 1287 && t.hi >= 1323);
  assert.ok([5, 10, 20, 25].includes(t.step));
  const flat = niceTicks(1300, 1300);
  assert.ok(flat.lo < 1300 && flat.hi > 1300);
  assert.ok(niceTicks(8.6, 8.9).step < 1); // 루피아처럼 작은 값
});

test('그래프 좌표: 날짜 간격대로, 상자 안', () => {
  const g = geometry(pts, { w: 600, h: 200, left: 50, right: 10, top: 10, bottom: 30 });
  assert.equal(g.xs[0], 50);
  assert.equal(g.xs[3], 590);
  assert.ok(g.xs[1] - g.xs[0] > g.xs[2] - g.xs[1]); // 주말 사이 간격이 더 넓다
  for (const y of g.ys) assert.ok(y >= 10 && y <= 170);
  assert.ok(g.path.startsWith('M50.0,'));
  const one = geometry([['2026-11-04', 1320]], { w: 600, h: 200, left: 50, right: 10, top: 10, bottom: 30 });
  assert.equal(one.xs[0], 320);
});

test('가로 눈금·가까운 점', () => {
  assert.deepEqual(xTicks('2025-11-19', '2026-11-19'), ['2025-12-01', '2026-03-01', '2026-06-01', '2026-09-01']);
  assert.deepEqual(xTicks('2016-01-01', '2026-11-19').slice(0, 2), ['2017-01-01', '2018-01-01']);
  assert.ok(xTicks('2026-10-20', '2026-11-19').length >= 3);
  assert.equal(nearest([0, 10, 20, 30], 14), 1);
  assert.equal(nearest([0, 10, 20, 30], 16), 2);
  assert.equal(nearest([0, 10, 20, 30], 99), 3);
});

test('날짜 도우미·불러오기 주소', async () => {
  assert.equal(fromDate('2026-11-19', 30), '2026-10-20');
  assert.equal(fromDate('2026-11-19', 0), null);
  assert.equal(dateKo('2026-11-15'), '2026년 11월 15일(일)');
  let url = '';
  await loadHistory('USD', '2026-10-20', async (u) => ((url = u), { ok: true, json: async () => ({}) }));
  assert.equal(url, '/api/rates/history?code=USD&from=2026-10-20');
});
