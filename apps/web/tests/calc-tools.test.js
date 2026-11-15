import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pyeongToM2, m2ToPyeong, parseArea } from '../src/lib/pyeong.js';
import { percentOf, ratio, changeRate, discountPrice, discountRate, num } from '../src/lib/percent.js';
import { searchTarget, formatBytes, toJpgName, MAX_Q } from '../src/lib/compress.js';

test('평수: 기본 환산과 왕복', () => {
  assert.equal(pyeongToM2(1, 6), 3.305785);
  assert.equal(m2ToPyeong(84), 25.41);
  assert.equal(m2ToPyeong(59), 17.85);
  assert.equal(pyeongToM2(m2ToPyeong(84, 10)), 84);
  assert.equal(parseArea('1,234.5'), 1234.5);
  assert.equal(parseArea(''), null);
  assert.equal(parseArea('abc'), null);
});

test('퍼센트: 4가지 계산', () => {
  assert.equal(percentOf(200, 15), 30);
  assert.equal(ratio(30, 200), 15);
  assert.equal(changeRate(100, 120), 20);
  assert.equal(changeRate(100, 80), -20);
  assert.equal(changeRate(-50, -25), 50);
  assert.deepEqual(discountPrice(39000, 30), { sale: 27300, off: 11700 });
  assert.equal(discountRate(39000, 27300), 30);
  assert.equal(ratio(1, 3), 33.33);
  assert.equal(percentOf(1.005, 100), 1.01);
});

test('퍼센트: 0으로 나누기와 입력 파싱', () => {
  assert.equal(ratio(5, 0), null);
  assert.equal(changeRate(0, 5), null);
  assert.equal(discountRate(0, 0), null);
  assert.equal(num('-1,000.5'), -1000.5);
  assert.equal(num(''), null);
  assert.equal(num('-'), null);
});

// 가짜 인코더: 용량 = 기준 × scale² × quality
const fakeEncoder = (base) => async (scale, q) => ({ size: Math.round(base * scale * scale * q) });

test('압축: 이미 작으면 최고 품질 그대로', async () => {
  const r = await searchTarget(fakeEncoder(100_000), 200_000);
  assert.equal(r.scale, 1); assert.equal(r.quality, MAX_Q); assert.ok(r.fits);
});

test('압축: 품질만 낮춰 목표 이하로 (목표에 가깝게)', async () => {
  const r = await searchTarget(fakeEncoder(1_000_000), 600_000);
  assert.equal(r.scale, 1); assert.ok(r.fits);
  assert.ok(r.size <= 600_000 && r.size > 550_000, `size=${r.size}`);
});

test('압축: 품질로 부족하면 해상도 축소', async () => {
  const r = await searchTarget(fakeEncoder(10_000_000), 500_000);
  assert.ok(r.scale < 1); assert.ok(r.fits); assert.ok(r.size <= 500_000);
});

test('압축: 끝까지 못 맞추면 fits=false', async () => {
  const r = await searchTarget(async () => ({ size: 999_999 }), 10);
  assert.equal(r.fits, false);
});

test('압축: 표시용 함수', () => {
  assert.equal(formatBytes(2 * 1024 * 1024), '2MB');
  assert.equal(formatBytes(1.5 * 1024 * 1024), '1.5MB');
  assert.equal(formatBytes(300 * 1024), '300KB');
  assert.equal(toJpgName('IMG_0001.HEIC'), 'IMG_0001.jpg');
  assert.equal(toJpgName('a.b.png', '_small'), 'a.b_small.jpg');
});
