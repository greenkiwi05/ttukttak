import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gifDims, frameTimes, estimateGifBytes, gifOutName, MAX_SECONDS } from '../src/lib/gif.js';

test('크기: 비율 유지, 원본보다 안 키움, 짝수', () => {
  assert.deepEqual(gifDims(1920, 1080, 480), { w: 480, h: 270 });
  assert.deepEqual(gifDims(1080, 1920, 320), { w: 320, h: 568 });
  assert.deepEqual(gifDims(300, 200, 640), { w: 300, h: 200 });
  assert.deepEqual(gifDims(333, 251, 640), { w: 334, h: 252 });
});

test('프레임 시각', () => {
  const r = frameTimes({ start: 1, end: 3, fps: 10 });
  assert.equal(r.times.length, 20);
  assert.equal(r.times[0], 1);
  assert.equal(r.times[19], 2.9);
  assert.equal(r.delay, 100);
  assert.ok(frameTimes({ start: 0, end: MAX_SECONDS + 1, fps: 10 }).error);
  assert.ok(frameTimes({ start: 2, end: 2, fps: 10 }).error);
  assert.equal(frameTimes({ start: 0, end: 20, fps: 15 }).times.length, 300);
  assert.equal(frameTimes({ start: 0, end: 0.05, fps: 10 }).times.length, 1);
});

test('용량·이름', () => {
  assert.equal(estimateGifBytes(480, 270, 50), 2_268_000);
  assert.equal(gifOutName('강아지 영상.mp4'), '강아지 영상.gif');
});
