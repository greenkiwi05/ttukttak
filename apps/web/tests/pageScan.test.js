import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRuns, findEdges, sameColor } from '../src/lib/pageScan.js';

const col = (spec) => spec.flatMap(([bg, n]) => new Array(n).fill(bg));

test('쪽 경계: 배경 틈으로 나뉜 쪽들', () => {
  const isBg = col([[true, 20], [false, 300], [true, 15], [false, 300], [true, 20]]);
  assert.deepEqual(findRuns(isBg), [{ top: 20, bottom: 319 }, { top: 335, bottom: 634 }]);
});

test('쪽 경계: 본문 속 짧은 회색 줄은 쪽을 나누지 않음', () => {
  const isBg = col([[true, 10], [false, 150], [true, 3], [false, 150], [true, 10]]);
  assert.deepEqual(findRuns(isBg), [{ top: 10, bottom: 312 }]);
});

test('쪽 경계: 너무 짧은 조각은 버리고, 끝까지 이어진 쪽도 잡음', () => {
  assert.deepEqual(findRuns(col([[false, 40], [true, 20], [false, 200]])), [{ top: 60, bottom: 259 }]);
  assert.deepEqual(findRuns(col([[true, 50]])), []);
});

test('가로 끝과 색 비교', () => {
  assert.deepEqual(findEdges(col([[true, 39], [false, 794], [true, 39]])), { left: 39, right: 832 });
  assert.equal(findEdges(col([[true, 10]])), null);
  assert.ok(sameColor(233, 236, 242, [232, 237, 242]));
  assert.ok(!sameColor(255, 255, 255, [232, 237, 242]));
});
