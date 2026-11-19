import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, planBackfill, isDate, isCode, backfillOnce, BACKFILL_FLOOR, BACKFILL_PER_RUN, EMPTY_STOP } from '../src/history.js';

test('날짜·코드 검사', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.ok(isDate('2026-11-19'));
  assert.ok(!isDate('2026-13-01'));
  assert.ok(!isDate("2026-11-19' OR 1=1"));
  assert.ok(isCode('USD'));
  assert.ok(!isCode('usd'));
  assert.ok(!isCode('USD;'));
});

test('과거 채우기 계획: 거꾸로, 시작일에서 멈춤', () => {
  assert.deepEqual(planBackfill('2026-11-19', '2016-01-01', 3), ['2026-11-19', '2026-11-18', '2026-11-17']);
  assert.deepEqual(planBackfill('2016-01-02', '2016-01-01', 5), ['2016-01-02', '2016-01-01']); // start 인자
  assert.deepEqual(planBackfill('2015-12-31', '2016-01-01', 5), []);
});

// 가짜 D1·KV
function fakes() {
  const rows = new Map();
  const kv = new Map();
  const db = {
    prepare: () => ({ bind: (...a) => a }),
    batch: async (stmts) => { for (const a of stmts) if (Array.isArray(a)) rows.set(a[0] + a[1], a); },
  };
  return { rows, db, kv: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => void kv.set(k, v) }, kvMap: kv };
}
const okDay = { ok: true, text: async () => JSON.stringify([{ result: 1, cur_unit: 'USD', cur_nm: '미국 달러', deal_bas_r: '1,300', ttb: '1', tts: '2' }]) };
const emptyDay = { ok: true, text: async () => 'null' };

test('과거 채우기: 주말은 건너뛰고 커서 이어가기', async () => {
  const f = fakes();
  const fetch = async (url) => (/searchdate=2026111[56]/.test(url) ? emptyDay : okDay); // 15·16일 주말
  const r = await backfillOnce({ db: f.db, kv: f.kv, key: 'XXXX', fetch, today: '2026-11-19' });
  assert.equal(r.done, false);
  assert.equal(r.filled, BACKFILL_PER_RUN - 2);
  assert.equal(r.cursor, addDays('2026-11-19', -BACKFILL_PER_RUN));
  assert.ok(f.rows.has('2026-11-19USD'));
  assert.ok(!f.rows.has('2026-11-15USD'));
  // 다음 실행은 저장된 커서부터
  const calls = [];
  await backfillOnce({ db: f.db, kv: f.kv, key: 'XXXX', fetch: async (u) => (calls.push(u), okDay), today: '2026-11-19' });
  assert.ok(calls[0].includes('searchdate=' + r.cursor.replace(/-/g, '')));
});

test('과거 채우기: 한도 초과면 멈추고 그 날짜부터 다시', async () => {
  const f = fakes();
  let n = 0;
  const fetch = async () => (++n <= 2 ? okDay : { ok: true, text: async () => JSON.stringify([{ result: 4 }]) });
  const r = await backfillOnce({ db: f.db, kv: f.kv, key: 'XXXX', fetch, today: '2026-11-19' });
  assert.equal(r.error, '하루 호출 한도 초과');
  assert.equal(r.cursor, '2026-11-17');
  assert.equal(f.kvMap.get('backfill:cursor'), '2026-11-17');
});

test('과거 채우기: 자료가 90일 연속 없으면 시작점으로 보고 멈춤, 이후 호출 0', async () => {
  const f = fakes();
  // 2000-01-01 이전에는 자료 없음
  const fetch = async (url) => (Number(new URL(url).searchParams.get('searchdate')) < 20000101 ? emptyDay : okDay);
  f.kvMap.set('backfill:cursor', '2000-01-10');
  let r, runs = 0;
  do { r = await backfillOnce({ db: f.db, kv: f.kv, key: 'XXXX', fetch, today: '2026-11-19' }); runs++; } while (!r.done && runs < 20);
  assert.equal(r.done, true);
  assert.ok(f.rows.has('2000-01-01USD'));
  assert.ok(!f.rows.has('1999-12-31USD'));
  assert.equal(f.kvMap.get('backfill:done'), '1');
  let called = false;
  const again = await backfillOnce({ db: f.db, kv: f.kv, key: 'XXXX', fetch: async () => ((called = true), okDay), today: '2026-11-19' });
  assert.deepEqual(again, { done: true });
  assert.equal(called, false);
  assert.ok(EMPTY_STOP >= 30);
});

test('과거 채우기: 바닥 날짜 이전으로는 안 감', () => {
  assert.deepEqual(planBackfill(addDays(BACKFILL_FLOOR, 1), BACKFILL_FLOOR, 5), [addDays(BACKFILL_FLOOR, 1), BACKFILL_FLOOR]);
});
