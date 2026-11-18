import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, convert, change, rateFor, eximCode, num, quickAmounts, loadRates } from '../src/lib/exchange.js';

const data = {
  date: '2026-11-18', source: '한국수출입은행',
  rates: [
    { code: 'SEK', unit: 1, name: '스웨덴 크로나', base: 140 },
    { code: 'JPY', unit: 100, name: '일본 옌', base: 912.3, send: 921.4, receive: 903.2 },
    { code: 'USD', unit: 1, name: '미국 달러', base: 1385.5, send: 1399.3, receive: 1371.6 },
    { code: 'BAD', unit: 1, base: 0 },
  ],
  prev: { date: '2026-11-17', base: { USD: 1380 } },
};

test('응답 검사·정렬: 인기 통화 먼저, 잘못된 항목 제외', () => {
  const d = normalize(data);
  assert.deepEqual(d.rates.map((r) => r.code), ['USD', 'JPY', 'SEK']);
  assert.equal(normalize(null), null);
  assert.equal(normalize({ date: 'x', rates: [] }), null);
  assert.equal(normalize({ rates: [{ code: 'USD', unit: 1, base: 1 }] }), null);
});

test('변환: 100엔 단위, 양방향', () => {
  assert.deepEqual(convert({ amount: 100, rate: 1385.5, unit: 1, dir: 'toKrw' }), { value: 138550 });
  assert.deepEqual(convert({ amount: 10000, rate: 912.3, unit: 100, dir: 'toKrw' }), { value: 91230 });
  assert.deepEqual(convert({ amount: 100000, rate: 912.3, unit: 100, dir: 'fromKrw' }), { value: 10961.31 });
  assert.deepEqual(convert({ amount: 1000000, rate: 1385.5, unit: 1, dir: 'fromKrw' }), { value: 721.76 });
  assert.deepEqual(convert({ amount: 0, rate: 1385.5, unit: 1, dir: 'toKrw' }), { value: 0 });
  assert.ok(convert({ amount: NaN, rate: 1, unit: 1, dir: 'toKrw' }).error);
  assert.ok(convert({ amount: 1, rate: 0, unit: 1, dir: 'toKrw' }).error);
});

test('전일 대비', () => {
  assert.deepEqual(change({ code: 'USD', base: 1385.5 }, data.prev), { diff: 5.5, pct: 0.4 });
  assert.deepEqual(change({ code: 'USD', base: 1374.5 }, data.prev), { diff: -5.5, pct: -0.4 });
  assert.equal(change({ code: 'JPY', base: 900 }, data.prev), null);
  assert.equal(change({ code: 'USD', base: 1 }, null), null);
});

test('해외 결제 계산기 연결용', () => {
  assert.equal(rateFor({ base: 912.3, unit: 100 }, 1), 9.123);
  assert.equal(rateFor({ base: 8.73, unit: 100 }, 100), 8.73);
  assert.equal(eximCode('CNY'), 'CNH');
  assert.equal(eximCode('USD'), 'USD');
  assert.equal(num('1,000.5'), 1000.5);
  assert.ok(Number.isNaN(num('abc')));
  assert.deepEqual(quickAmounts('JPY'), [1000, 5000, 10000, 50000]);
});

test('불러오기: 실패하면 null, 다음에 다시 시도', async () => {
  assert.equal(await loadRates(async () => ({ ok: false })), null);
  const d = await loadRates(async () => ({ ok: true, json: async () => data }));
  assert.equal(d.date, '2026-11-18');
});
