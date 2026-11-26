import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, PURITY, num, pricePerGram, valueOf, weightFor, convert, priceTable, fmtWeight } from '../src/lib/gold.js';

test('단위와 순도 정의', () => {
  assert.equal(UNITS.don.grams, 3.75);
  assert.equal(UNITS.nyang.grams, 37.5);
  assert.equal(UNITS.nyang.grams / UNITS.don.grams, 10);
  assert.equal(PURITY['18k'].ratio, 0.75);
  assert.equal(PURITY['14k'].ratio, 0.585);
});

test('입력값 읽기', () => {
  assert.equal(num('750,000'), 750000);
  assert.equal(num(' 1 200 원'), 1200);
  assert.ok(Number.isNaN(num('')));
  assert.ok(Number.isNaN(num('abc')));
});

test('1돈 가격 ↔ 1g 가격', () => {
  assert.equal(pricePerGram(750000, 'don'), 200000);
  assert.equal(pricePerGram('200,000', 'g'), 200000);
  assert.equal(pricePerGram(0, 'g'), null);
  assert.equal(pricePerGram(-1, 'g'), null);
  assert.equal(pricePerGram('', 'don'), null);
});

test('무게 → 금액', () => {
  const pg = 200000; // 1g 20만 원 = 1돈 75만 원
  assert.deepEqual(valueOf(1, 'don', '24k', pg), { grams: 3.75, don: 1, won: 750000 });
  assert.equal(valueOf(1, 'don', '18k', pg).won, 562500);
  assert.equal(valueOf(1, 'don', '14k', pg).won, 438750);
  assert.equal(valueOf(1, 'nyang', '24k', pg).won, 7500000);
  assert.equal(valueOf(10, 'g', '24k', pg).won, 2000000);
  assert.equal(valueOf(1, 'oz', '24k', pg).won, 6220695);
  assert.equal(valueOf(0.5, 'don', '24k', pg).won, 375000);
  assert.equal(valueOf(0, 'don', '24k', pg), null);
  assert.equal(valueOf(1, 'don', '9k', pg), null);
  assert.equal(valueOf(1, 'don', '24k', null), null);
});

test('예산 → 무게', () => {
  const w = weightFor(1500000, '24k', 200000);
  assert.equal(w.grams, 7.5);
  assert.equal(w.don, 2);
  assert.equal(weightFor('1,500,000', '18k', 200000).grams, 10);
  assert.equal(weightFor('', '24k', 200000), null);
});

test('단위 바꾸기', () => {
  assert.equal(convert(1, 'don', 'g'), 3.75);
  assert.equal(convert(37.5, 'g', 'nyang'), 1);
  assert.equal(fmtWeight(convert(1, 'oz', 'don')), '8.29');
  assert.equal(convert(0, 'g', 'don'), 0);
  assert.equal(convert('x', 'g', 'don'), null);
});

test('한눈에 보기 표', () => {
  const t = priceTable(200000, [1, 2]);
  assert.deepEqual(t[0], { don: 1, values: { '24k': 750000, '18k': 562500, '14k': 438750 } });
  assert.equal(t[1].values['24k'], 1500000);
  assert.deepEqual(priceTable(null), []);
});

test('무게 표시', () => {
  assert.equal(fmtWeight(3.75), '3.75');
  assert.equal(fmtWeight(2), '2');
  assert.equal(fmtWeight(1234.5), '1,234.5');
  assert.equal(fmtWeight(NaN), '-');
});
