import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTime, fmtTime, trimRange, estimateBytes, audioOutName, FORMATS } from '../src/lib/audioExtract.js';

test('시간 입력', () => {
  assert.equal(parseTime('83'), 83);
  assert.equal(parseTime('1:23'), 83);
  assert.equal(parseTime('1:02:03'), 3723);
  assert.equal(parseTime('0:05.5'), 5.5);
  assert.equal(parseTime(''), null);
  assert.ok(Number.isNaN(parseTime('1:75')));
  assert.ok(Number.isNaN(parseTime('abc')));
  assert.equal(fmtTime(83), '1:23');
  assert.equal(fmtTime(3723), '1:02:03');
  assert.equal(fmtTime(5.5), '0:05.5');
  assert.equal(fmtTime(59.96), '1:00');
});

test('자르기 구간', () => {
  assert.deepEqual(trimRange('', '', 200), { start: 0, end: 200, length: 200, whole: true });
  const r = trimRange('0:30', '1:00', 200);
  assert.equal(r.length, 30);
  assert.equal(r.whole, false);
  assert.ok(trimRange('1:00', '0:30', 200).error);
  assert.ok(trimRange('4:00', '', 200).error.includes('3:20'));
  assert.ok(trimRange('', '5:00', 200).error);
  assert.ok(trimRange('x', '', 200).error);
  assert.equal(trimRange('', '3:20.04', 200).end, 200); // 끝을 살짝 넘긴 건 허용
});

test('예상 용량·파일 이름', () => {
  assert.equal(estimateBytes({ format: 'mp3', kbps: 192, seconds: 60 }), 1_440_000);
  assert.equal(estimateBytes({ format: 'wav', seconds: 1, sampleRate: 44100, channels: 2 }), 176_444);
  assert.equal(audioOutName('여행.영상.mov', 'mp3'), '여행.영상.mp3');
  assert.deepEqual(FORMATS.map((f) => f.id), ['mp3', 'm4a', 'wav']);
});
