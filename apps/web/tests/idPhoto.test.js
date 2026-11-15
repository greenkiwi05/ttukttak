import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cmToPx, PRESETS, baseCrop, cropRect, panCenter, isUpscaled } from '../src/lib/idPhoto.js';

test('cm → 300dpi 픽셀', () => {
  assert.equal(cmToPx(3), 354);
  assert.equal(cmToPx(4), 472);
  assert.equal(cmToPx(3.5), 413);
  assert.equal(cmToPx(4.5), 531);
  assert.deepEqual(PRESETS.find((p) => p.id === 'half'), { id: 'half', label: '반명함 · 이력서', wCm: 3, hCm: 4, w: 354, h: 472 });
});

test('기본 크롭: 가로 사진은 높이를, 세로 사진은 너비를 꽉 채움', () => {
  assert.deepEqual(baseCrop(4000, 3000, 3 / 4), { w: 2250, h: 3000 });
  assert.deepEqual(baseCrop(3000, 6000, 3 / 4), { w: 3000, h: 4000 });
});

test('크롭 영역은 항상 이미지 안', () => {
  const r = cropRect({ imgW: 4000, imgH: 3000, aspect: 3 / 4, zoom: 2, cx: 0, cy: 99999 });
  assert.equal(r.w, 1125); assert.equal(r.h, 1500);
  assert.equal(r.x, 0); assert.equal(r.y, 1500);
  const c = cropRect({ imgW: 4000, imgH: 3000, aspect: 3 / 4, zoom: 0.5, cx: 2000, cy: 1500 });
  assert.equal(c.h, 3000); // 배율 1 미만은 1로
  assert.equal(c.y, 0);
});

test('드래그: 사진을 오른쪽으로 끌면 크롭 중심은 왼쪽으로', () => {
  const r = cropRect({ imgW: 4000, imgH: 3000, aspect: 3 / 4, zoom: 2, cx: 2000, cy: 1500 });
  const p = panCenter(r, 225, 10, 0); // 화면 225px = 이미지 1125px → 1px = 5px
  assert.equal(p.cx, 1950); assert.equal(p.cy, 1500);
});

test('업스케일 감지', () => {
  assert.equal(isUpscaled({ w: 300 }, 354), true);
  assert.equal(isUpscaled({ w: 1000 }, 354), false);
});
