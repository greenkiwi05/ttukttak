import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAll, parseSido, refreshFuel } from '../src/fuel.js';

const ALL = { RESULT: { OIL: [
  { TRADE_DT: '20261119', PRODCD: 'B034', PRODNM: '고급휘발유', PRICE: '1950.31', DIFF: '+0.12' },
  { TRADE_DT: '20261119', PRODCD: 'B027', PRODNM: '휘발유', PRICE: '1,650.12', DIFF: '-1.05' },
  { TRADE_DT: '20261119', PRODCD: 'D047', PRODNM: '자동차용경유', PRICE: '1520.4', DIFF: '0' },
  { TRADE_DT: '20261119', PRODCD: 'C004', PRODNM: '실내등유', PRICE: '1300', DIFF: '0' }, // 화면에 안 씀
] } };
const SIDO = { RESULT: { OIL: [{ SIDOCD: '00', SIDONM: '전국', PRICE: '1650' }, { SIDOCD: '01', SIDONM: '서울', PRICE: '1720.5', DIFF: '-0.8' }] } };

test('전국 평균 정리', () => {
  const r = parseAll(ALL);
  assert.equal(r.date, '2026-11-19');
  assert.deepEqual(r.items.find((x) => x.code === 'B027'), { code: 'B027', name: '휘발유', price: 1650.12, diff: -1.05 });
  assert.equal(r.items.length, 3);
  assert.ok(parseAll({}).error);
  assert.ok(parseAll({ RESULT: { OIL: [] } }).error);
});

test('시도별 정리 (전국 제외)', () => {
  assert.deepEqual(parseSido(SIDO), [{ code: '01', name: '서울', price: 1720.5, diff: -0.8 }]);
  assert.ok(parseSido({ RESULT: {} }).error);
});

test('갱신: 3시간 안에는 다시 안 부름, 키 없으면 오류', async () => {
  const store = new Map();
  const kv = { get: async (k) => (store.has(k) ? JSON.parse(store.get(k)) : null), put: async (k, v) => void store.set(k, v) };
  const calls = [];
  const fetch = async (url) => { calls.push(url); return { ok: true, text: async () => JSON.stringify(url.includes('avgAll') ? ALL : SIDO) }; };
  const now = Date.parse('2026-11-19T07:00:00Z');
  assert.ok((await refreshFuel({ kv, key: '', fetch, now })).error.includes('OPINET_KEY'));
  assert.deepEqual(await refreshFuel({ kv, key: 'XXXX', fetch, now }), { updated: true });
  assert.equal(calls.length, 3);
  const saved = JSON.parse(store.get('fuel:latest'));
  assert.equal(saved.sido.B027[0].name, '서울');
  assert.deepEqual(await refreshFuel({ kv, key: 'XXXX', fetch, now: now + 3600e3 }), { skipped: true });
  assert.equal(calls.length, 3);
  const html = await refreshFuel({ kv: { get: async () => null, put: async () => {} }, key: 'XXXX', fetch: async () => ({ ok: true, text: async () => '<html>' }), now });
  assert.ok(html.error.includes('JSON'));
});
