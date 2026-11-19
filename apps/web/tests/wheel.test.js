import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spinTo, indexAt, pickIndex, colorFor, slicePath, labelPos, parseItems, shortLabel, PRESETS, MAX_ITEMS } from '../src/lib/wheel.js';

test('바늘이 정한 칸에 멈춘다 (모든 칸·여러 시작 각도·칸 안 위치)', () => {
  for (const n of [2, 3, 5, 8, 13, 40]) {
    for (const current of [0, 123.4, 3600 + 17, -50]) {
      for (let i = 0; i < n; i++) {
        for (const jitter of [0, 0.5, 0.999]) {
          const r = spinTo({ current, index: i, n, jitter });
          assert.equal(indexAt(r, n), i, `n=${n} i=${i} current=${current} jitter=${jitter}`);
          assert.ok(r - current >= 6 * 360 && r - current < 7 * 360, '6바퀴 이상, 7바퀴 미만');
        }
      }
    }
  }
});

test('칸 경계에는 멈추지 않음', () => {
  const n = 4, s = 90;
  for (const j of [0, 1]) {
    const pos = ((-(spinTo({ current: 0, index: 1, n, jitter: j })) % 360) + 360) % 360;
    assert.ok(pos > s + s * 0.05 && pos < 2 * s - s * 0.05);
  }
});

test('뽑기 인덱스·색', () => {
  assert.equal(pickIndex(5, () => 0), 0);
  assert.equal(pickIndex(5, () => 0.9999999), 4);
  for (const n of [2, 3, 8, 9, 16, 17]) {
    for (let i = 0; i < n; i++) assert.notEqual(colorFor(i, n), colorFor((i + 1) % n, n), `n=${n} i=${i}`);
  }
});

test('그리기 좌표', () => {
  assert.ok(slicePath(0, 4).startsWith('M100,100L100.00,0.00'));
  assert.ok(slicePath(0, 1).includes('A100,100 0 1,1'));
  const l = labelPos(0, 4);
  assert.equal(Math.round(l.rotate), -45);
  assert.ok(l.x > 100 && l.y < 100); // 첫 칸은 오른쪽 위
  for (let i = 0; i < 8; i++) { const r = labelPos(i, 8).rotate; assert.ok(r >= -90 && r <= 90, `글씨가 거꾸로 (i=${i}, ${r})`); }
});

test('입력·글씨 줄이기·프리셋', () => {
  assert.deepEqual(parseItems('짜장, 짬뽕\n\n탕수육 ').items, ['짜장', '짬뽕', '탕수육']);
  const many = parseItems(Array.from({ length: 45 }, (_, i) => i).join(','));
  assert.equal(many.items.length, MAX_ITEMS);
  assert.equal(many.cut, 5);
  assert.equal(shortLabel('아주아주아주긴메뉴이름', 4), '아주아주아주긴메뉴…');
  assert.equal(shortLabel('가나다라마바사', 20), '가나다라…');
  for (const p of PRESETS) assert.ok(p.items.length >= 2);
});
