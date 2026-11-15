import { test } from 'node:test';
import assert from 'node:assert/strict';
import { travelPay, toKrw, num, CURRENCIES } from '../src/lib/travelPay.js';

test('해외 결제: 루피아 100단위 환율, 세금·수수료 반영', () => {
  // 150,000 루피아 + 세금·봉사료 21%, 환율 8.7원/100루피아, 브랜드 1.1%, 해외이용 0.2%
  const r = travelPay({ amount: 150000, rate: 8.7, unit: 100, taxPct: 21, brandPct: 1.1, issuerPct: 0.2 });
  assert.equal(r.local, 181500);
  assert.equal(r.base, 15791); // 181500 / 100 × 8.7 = 15790.5
  assert.equal(r.brandFee, 174);
  assert.equal(r.issuerFee, 32);
  assert.equal(r.card, 15791 + 174 + 32);
  assert.ok(Math.abs(r.feeRate - 0.013) < 0.001);
});

test('해외 결제: 달러, 수수료 0%, 원화결제(DCC) 비교', () => {
  const r = travelPay({ amount: 100, rate: 1400, unit: 1, dccPct: 5 });
  assert.equal(r.card, 140000);
  assert.equal(r.dcc, 147000);
  assert.equal(r.dccDiff, 7000);
});

test('해외 결제: 잘못된 입력', () => {
  assert.ok(travelPay({ amount: 0, rate: 1, unit: 1 }).error);
  assert.ok(travelPay({ amount: 1, rate: 0, unit: 1 }).error);
  assert.ok(travelPay({ amount: 1, rate: 1, unit: 1, brandPct: -1 }).error);
});

test('암산표와 입력 파싱', () => {
  assert.equal(toKrw(100000, 8.7, 100), 8700);
  assert.equal(toKrw(10, 1400, 1, 1.3), 14182);
  assert.equal(num('1,500,000'), 1500000);
  assert.ok(Number.isNaN(num('')));
  assert.ok(Number.isNaN(num('abc')));
  for (const c of Object.values(CURRENCIES)) assert.ok(c.unit === 1 || c.unit === 100);
});
