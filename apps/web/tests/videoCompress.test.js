import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleDims, bitrateForTarget, retryBitrate, estimateBytes, fmtDuration, videoOutName } from '../src/lib/videoCompress.js';

test('해상도: 짧은 변 기준, 가로·세로 영상, 짝수, 원본이 작으면 그대로', () => {
  assert.deepEqual(scaleDims(3840, 2160, 1080), { w: 1920, h: 1080, scaled: true });
  assert.deepEqual(scaleDims(1080, 1920, 720), { w: 720, h: 1280, scaled: true }); // 세로 영상
  assert.deepEqual(scaleDims(1280, 720, 1080), { w: 1280, h: 720, scaled: false });
  assert.deepEqual(scaleDims(1001, 563, 0), { w: 1002, h: 564, scaled: false });
  const r = scaleDims(1918, 1078, 480);
  assert.equal(r.w % 2, 0); assert.equal(r.h % 2, 0);
});

test('목표 용량 → 비트레이트, 예상 용량이 목표 이하', () => {
  const r = bitrateForTarget(25 * 1024 * 1024, 60);
  assert.equal(r.audioBps, 128_000);
  assert.ok(r.videoBps > 3_000_000 && r.videoBps < 3_400_000, String(r.videoBps));
  assert.ok(estimateBytes(r.videoBps, r.audioBps, 60) <= 25 * 1024 * 1024);
  const mute = bitrateForTarget(25 * 1024 * 1024, 60, { keepAudio: false });
  assert.equal(mute.audioBps, 0);
  assert.ok(mute.videoBps > r.videoBps);
});

test('목표 용량: 빠듯하면 소리를 낮추고, 불가능하면 최소 용량 안내', () => {
  const tight = bitrateForTarget(3 * 1024 * 1024, 90);
  assert.equal(tight.audioBps, 64_000);
  const bad = bitrateForTarget(1 * 1024 * 1024, 600);
  assert.ok(bad.error && /MB 이상/.test(bad.error), bad.error);
  assert.ok(bitrateForTarget(1000, 0).error);
});

test('표시용 함수', () => {
  assert.equal(fmtDuration(83), '1:23');
  assert.equal(fmtDuration(3723), '1:02:03');
  assert.equal(videoOutName('IMG_1234.MOV'), 'IMG_1234_small.mp4');
});

test('목표 초과 시 다시 시도할 비트레이트', () => {
  assert.equal(retryBitrate(1_000_000, 900, 1000), null); // 이미 목표 이하
  const n = retryBitrate(1_000_000, 1_260_000, 1_000_000);
  assert.ok(n < 1_000_000 * (1 / 1.26) && n > 700_000, String(n));
  assert.equal(retryBitrate(120_000, 3000, 1000), null); // 최소 비트레이트 아래로는 안 내림
});
