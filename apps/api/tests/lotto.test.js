import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectedRound, parseRound, fetchRounds, syncLotto } from '../src/lotto.js';

// 실제 응답 모양 (1250회, 2026-11-14)
const item = (round, ymd, nums = [1, 5, 18, 23, 27, 28], bonus = 8) => ({
  ltEpsd: round, ltRflYmd: ymd, tm1WnNo: nums[0], tm2WnNo: nums[1], tm3WnNo: nums[2], tm4WnNo: nums[3], tm5WnNo: nums[4], tm6WnNo: nums[5], bnsWnNo: bonus,
  rnk1WnNope: 9, rnk1WnAmt: 3103164459, rnk2WnNope: 100, rnk2WnAmt: 46547467, rnk3WnNope: 3120, rnk3WnAmt: 1491906,
  rnk4WnNope: 156721, rnk4WnAmt: 50000, rnk5WnNope: 2658318, rnk5WnAmt: 5000, rlvtEpsdSumNtslAmt: 58365613551,
});

test('지금쯤 나왔어야 할 회차', () => {
  assert.equal(expectedRound(Date.parse('2002-12-07T12:00:00Z')), 1);
  assert.equal(expectedRound(Date.parse('2002-12-07T11:00:00Z')), 0); // 1회 추첨 전
  assert.equal(expectedRound(Date.parse('2026-11-14T12:30:00Z')), 1250); // 1250회: 2026-11-14 토요일 밤
  assert.equal(expectedRound(Date.parse('2026-11-19T06:00:00Z')), 1250);
  assert.equal(expectedRound(Date.parse('2026-11-21T11:59:00Z')), 1250); // 1251회 추첨 직전
  assert.equal(expectedRound(Date.parse('2026-11-21T12:00:00Z')), 1251);
});

test('회차 정리·검사', () => {
  const r = parseRound(item(1250, '20261114', [28, 1, 18, 5, 27, 23]));
  assert.equal(r.date, '2026-11-14');
  assert.deepEqual(r.nums, [1, 5, 18, 23, 27, 28]);
  assert.equal(r.bonus, 8);
  assert.deepEqual(r.prizes[0], { count: 9, amount: 3103164459 });
  assert.equal(r.sales, 58365613551);
  assert.equal(parseRound(item(1, '20021207', [1, 1, 2, 3, 4, 5])), null); // 중복
  assert.equal(parseRound(item(1, '20021207', [1, 2, 3, 4, 5, 46])), null); // 범위
  assert.equal(parseRound(item(1, '20021207', [1, 2, 3, 4, 5, 6], 6)), null); // 보너스 중복
  assert.equal(parseRound({ ltEpsd: 1 }), null);
});

test('받기: 차단 페이지(HTML)·형식 오류', async () => {
  const html = await fetchRounds({ fetch: async () => ({ ok: true, text: async () => '<html>차단</html>' }), dir: 'latest', cursor: 1 });
  assert.ok(html.error.includes('JSON'));
  const bad = await fetchRounds({ fetch: async () => ({ ok: true, text: async () => '{"data":{}}' }), dir: 'latest', cursor: 1 });
  assert.equal(bad.error, '응답 형식이 달라요');
  const ok = await fetchRounds({ fetch: async () => ({ ok: true, text: async () => JSON.stringify({ data: { list: [item(3, '20021221'), item(2, '20021214')] } }) }), dir: 'latest', cursor: 1 });
  assert.deepEqual(ok.rounds.map((r) => r.round), [2, 3]);
});

// 가짜 D1·KV
function fakes() {
  const rows = new Map();
  const kv = new Map();
  const db = {
    prepare: (sql) => ({
      bind: (...a) => ({ sql, a, first: async () => (sql.includes('WHERE round') ? null : null) }),
      first: async () => ({ m: rows.size ? Math.max(...rows.keys()) : null }),
      all: async () => ({ results: [...rows.values()].sort((x, y) => x.round - y.round).map((a) => ({ round: a[0], date: a[1], n1: a[2], n2: a[3], n3: a[4], n4: a[5], n5: a[6], n6: a[7], bonus: a[8] })) }),
    }),
    batch: async (stmts) => { for (const s of stmts) if (s.a) rows.set(s.a[0], s.a); },
  };
  return { rows, db, kv: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => void kv.set(k, v) }, kvMap: kv };
}
// 가짜 동행복권: 1~25회 존재
const ymd = (n) => new Date(Date.parse('2002-12-07') + (n - 1) * 7 * 86400e3).toISOString().slice(0, 10).replace(/-/g, '');
const fakeSite = (calls) => async (url) => {
  calls.push(url);
  const u = new URL(url);
  const dir = u.searchParams.get('srchDir'), c = Number(u.searchParams.get('srchCursorLtEpsd'));
  const ids = dir === 'older' ? Array.from({ length: 10 }, (_, i) => c - 1 - i).filter((n) => n >= 1) : Array.from({ length: 10 }, (_, i) => c + 1 + i).filter((n) => n <= 25);
  return { ok: true, text: async () => JSON.stringify({ data: { list: ids.map((n) => item(n, ymd(n))) } }) };
};

test('동기화: 1회부터 채우고, 다 채우면 더 안 부름', async () => {
  const f = fakes();
  const calls = [];
  const now = Date.parse('2003-05-24T13:00:00Z'); // 25회 추첨 뒤
  const r = await syncLotto({ db: f.db, kv: f.kv, fetch: fakeSite(calls), now });
  assert.equal(r.expected, 25);
  assert.equal(r.max, 25);
  assert.equal(r.saved, 25);
  assert.ok(calls[0].includes('srchDir=older&srchCursorLtEpsd=11'));
  const blob = JSON.parse(f.kvMap.get('lotto:all'));
  assert.equal(blob.rounds.length, 25);
  assert.deepEqual(blob.rounds[0].slice(0, 2), [1, '2002-12-07']);
  const before = calls.length;
  await syncLotto({ db: f.db, kv: f.kv, fetch: fakeSite(calls), now });
  assert.equal(calls.length, before); // 이미 최신이면 호출 0번
});

test('동기화: 한 번에 maxPages까지만, 결과가 아직 없으면 멈춤', async () => {
  const f = fakes();
  const calls = [];
  const r = await syncLotto({ db: f.db, kv: f.kv, fetch: fakeSite(calls), now: Date.parse('2003-05-24T13:00:00Z'), maxPages: 2 });
  assert.equal(r.max, 20);
  assert.equal(calls.length, 2);
  assert.equal(f.kvMap.get('lotto:all'), undefined); // 아직 다 못 받았으면 요약본을 만들지 않음
  // 사이트엔 25회까지인데 26회가 나왔어야 할 시각 → 한 번 더 확인하고 멈춤
  const r2 = await syncLotto({ db: f.db, kv: f.kv, fetch: fakeSite(calls), now: Date.parse('2003-05-31T13:00:00Z') });
  assert.equal(r2.max, 25);
  assert.equal(r2.expected, 26);
  assert.equal(JSON.parse(f.kvMap.get('lotto:all')).rounds.length, 25); // 따라잡으면 요약본 생성
});
