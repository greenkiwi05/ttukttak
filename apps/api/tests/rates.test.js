import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExim, toNum, kstDate, fetchLatest, merge } from '../src/rates.js';

const row = (cur_unit, deal_bas_r) => ({ result: 1, cur_unit, cur_nm: '이름', deal_bas_r, ttb: '1,000', tts: '1,100' });

test('숫자·한국 날짜', () => {
  assert.equal(toNum('1,385.5'), 1385.5);
  assert.ok(Number.isNaN(toNum('')));
  const t = Date.UTC(2026, 10, 18, 16); // = 2026-11-19 01:00 KST
  assert.equal(kstDate(t), '2026-11-19');
  assert.equal(kstDate(t, 1), '2026-11-18');
});

test('수출입은행 응답 정리', () => {
  const r = parseExim([row('USD', '1,385.5'), row('JPY(100)', '912.3'), row('KRW', '1'), row('IDR(100)', '8.73')]);
  assert.deepEqual(r.rates.map((x) => [x.code, x.unit, x.base]), [['USD', 1, 1385.5], ['JPY', 100, 912.3], ['IDR', 100, 8.73]]);
  assert.equal(r.rates[0].send, 1100);
  assert.equal(r.rates[0].receive, 1000);
  assert.deepEqual(parseExim([]), { empty: true });
  assert.deepEqual(parseExim(null), { empty: true }); // 11시 전·비영업일
  assert.deepEqual(parseExim([{ result: 1, cur_unit: null, deal_bas_r: null }]), { empty: true });
  assert.equal(parseExim([{ result: 3 }]).error, '인증키 오류');
  assert.equal(parseExim([{ result: 4 }]).error, '하루 호출 한도 초과');
  assert.ok(parseExim({ x: 1 }).error);
});

test('주말이면 이전 고시일로 거슬러 올라감', async () => {
  const calls = [];
  const fake = async (url) => {
    calls.push(url);
    const body = calls.length < 3 ? [] : [row('USD', '1,400')];
    return { ok: true, text: async () => JSON.stringify(body) };
  };
  const r = await fetchLatest({ key: 'XXXX', fetch: fake, now: Date.UTC(2026, 10, 15, 3) }); // 일요일 KST
  assert.equal(r.date, '2026-11-13');
  assert.equal(calls.length, 3);
  assert.ok(calls[0].includes('searchdate=20261115'));
  assert.ok((await fetchLatest({ key: '', fetch: fake })).error);
  const bad = await fetchLatest({ key: 'XXXX', fetch: async () => ({ ok: false, status: 500 }) });
  assert.equal(bad.error, 'HTTP 500');
});

test('전일 대비용 이전 값 보관', () => {
  const a = merge(null, { date: '2026-11-17', rates: [{ code: 'USD', base: 1390 }] }, 't1');
  assert.equal(a.prev, null);
  const same = merge(a, { date: '2026-11-17', rates: [{ code: 'USD', base: 1391 }] }, 't2');
  assert.equal(same.prev, null);
  const b = merge(same, { date: '2026-11-18', rates: [{ code: 'USD', base: 1400 }] }, 't3');
  assert.deepEqual(b.prev, { date: '2026-11-17', base: { USD: 1391 } });
  const c = merge(b, { date: '2026-11-18', rates: [{ code: 'USD', base: 1401 }] }, 't4');
  assert.deepEqual(c.prev, b.prev);
  assert.equal(merge(b, { date: '2026-11-10', rates: [] }), b);
});
