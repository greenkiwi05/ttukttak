import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuelCost, byAmount, normalizeFuel, num, loadFuel } from '../src/lib/fuel.js';

test('주유비: 편도·왕복·나눠 내기', () => {
  const r = fuelCost({ distance: 400, efficiency: 12.5, price: 1650 });
  assert.equal(r.liters, 32);
  assert.equal(r.cost, 52800);
  assert.equal(r.perKm, 132);
  const rt = fuelCost({ distance: 400, efficiency: 12.5, price: 1650, roundTrip: true, people: 3 });
  assert.equal(rt.km, 800);
  assert.equal(rt.cost, 105600);
  assert.equal(rt.perPerson, 35200);
  assert.equal(fuelCost({ distance: 100, efficiency: 15, price: 1650, people: 3 }).perPerson, 3670); // 11000 ÷ 3 = 3666.7 → 10원 단위 올림
  assert.ok(fuelCost({ distance: 0, efficiency: 10, price: 1 }).error);
  assert.ok(fuelCost({ distance: 1, efficiency: 10, price: 1, people: 0 }).error);
});

test('주유 금액으로 몇 L·몇 km', () => {
  assert.deepEqual(byAmount({ amount: 50000, price: 1650, efficiency: 12 }), { liters: 30.3, km: 363.6 });
  assert.equal(byAmount({ amount: 50000, price: 1650 }).km, null);
  assert.ok(byAmount({ amount: 0, price: 1650 }).error);
});

test('유가 응답 정리', () => {
  const d = normalizeFuel({ date: '2026-11-19', national: [{ code: 'B027', price: 1650.12, diff: -1 }, { code: 'D047', price: 0 }], sido: { B027: [{ code: '01', name: '서울', price: 1720 }] } });
  assert.equal(d.national.get('B027').price, 1650.12);
  assert.equal(d.national.has('D047'), false);
  assert.equal(d.sido.B027[0].name, '서울');
  assert.equal(normalizeFuel({ national: [] }), null);
  assert.equal(num('1,650.5'), 1650.5);
  assert.ok(Number.isNaN(num('x')));
});

test('불러오기 실패하면 null', async () => {
  assert.equal(await loadFuel(async () => ({ ok: false })), null);
});
