import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settle, settleText } from '../src/lib/dutchPay.js';
import { parseTime, workMinutes, sumWeek, fmtDuration, fmtTime } from '../src/lib/workHours.js';
import { renderScale, pageImageName } from '../src/lib/pdfToImage.js';
import { mergeLayout } from '../src/lib/imageMerge.js';
import { convert, fmtNum } from '../src/lib/units.js';
import { makeSets, parseNums, ballBand } from '../src/lib/lotto.js';

const seeded = (seed = 1) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); };

// ── 더치페이
test('더치페이: 균등 + 100원 올림, 차액', () => {
  const r = settle({ people: ['a', 'b', 'c'], rounds: [{ name: '1차', amount: 100000, payers: [0, 1, 2] }], unit: 100, mode: 'ceil' });
  assert.deepEqual(r.perPerson.map((p) => p.pay), [33400, 33400, 33400]);
  assert.equal(r.collected, 100200);
  assert.equal(r.diff, 200);
  const f = settle({ people: ['a', 'b', 'c'], rounds: [{ name: '1차', amount: 100000, payers: [0, 1, 2] }], unit: 1000, mode: 'floor' });
  assert.equal(f.diff, -1000);
});

test('더치페이: 차수마다 참여자가 다름', () => {
  const rounds = [{ name: '1차', amount: 120000, payers: [0, 1, 2, 3] }, { name: '2차', amount: 60000, payers: [0, 1] }];
  const r = settle({ people: ['민수', '지현', '서준', '유나'], rounds, unit: 1 });
  assert.deepEqual(r.perPerson.map((p) => p.pay), [60000, 60000, 30000, 30000]);
  assert.deepEqual(r.perPerson[0].rounds, ['1차', '2차']);
  assert.equal(r.diff, 0);
  const t = settleText(r, rounds, '은행 000-00-000000');
  assert.ok(t.includes('2차 60,000원 (2명)'));
  assert.ok(t.includes('서준: 30,000원'));
  assert.ok(t.endsWith('입금: 은행 000-00-000000'));
});

test('더치페이: 잘못된 입력, 3명이 10원 단위', () => {
  assert.ok(settle({ people: [], rounds: [] }).error);
  assert.ok(settle({ people: ['a'], rounds: [{ name: '1차', amount: 0, payers: [0] }] }).error);
  assert.ok(settle({ people: ['a'], rounds: [{ name: '1차', amount: 1000, payers: [] }] }).error);
  const r = settle({ people: ['a', 'b', 'c'], rounds: [{ name: '', amount: 10000, payers: [0, 1, 2] }], unit: 10, mode: 'round' });
  assert.deepEqual(r.perPerson.map((p) => p.pay), [3330, 3330, 3330]);
});

// ── 근무시간
test('근무시간: 시각 입력 해석', () => {
  assert.equal(parseTime('9'), 540);
  assert.equal(parseTime('930'), 570);
  assert.equal(parseTime('0930'), 570);
  assert.equal(parseTime('21:05'), 1265);
  assert.equal(parseTime('9시 30분'), 570);
  assert.equal(parseTime('24:00'), 1440);
  for (const s of ['', '25:00', '12:60', '12345', 'abc']) assert.equal(parseTime(s), null, s);
  assert.equal(fmtTime(570), '09:30');
  assert.equal(fmtDuration(510), '8시간 30분');
  assert.equal(fmtDuration(480), '8시간');
  assert.equal(fmtDuration(45), '45분');
});

test('근무시간: 휴게 제외, 야간(다음 날 퇴근), 오류', () => {
  assert.deepEqual(workMinutes({ start: '09:00', end: '18:00', breakMin: 60 }), { minutes: 480, span: 540, overnight: false });
  const n = workMinutes({ start: '22:00', end: '06:00', breakMin: 60 });
  assert.equal(n.minutes, 420); assert.equal(n.overnight, true);
  assert.ok(workMinutes({ start: 'x', end: '18:00' }).error);
  assert.ok(workMinutes({ start: '09:00', end: '10:00', breakMin: 60 }).error);
  const w = sumWeek([{ start: '9', end: '18', breakMin: 60 }, { start: '', end: '' }, { start: '13', end: '1730', breakMin: 30 }], 10000);
  assert.equal(w.total, 480 + 240); assert.equal(w.days, 2); assert.equal(w.pay, 120000);
});

// ── PDF → 이미지
test('PDF → 이미지: 배율, canvas 한계, 파일명', () => {
  const a4 = renderScale(595.28, 841.89, 150);
  assert.ok(Math.abs(a4.scale - 150 / 72) < 1e-9);
  assert.equal(a4.w, 1240); assert.equal(a4.reduced, false);
  const big = renderScale(5000, 5000, 300);
  assert.ok(big.reduced); assert.ok(big.w <= 8192 && big.w * big.h <= 32_000_000);
  assert.equal(pageImageName('계약서.PDF', 3, 12), '계약서_03.jpg');
  assert.equal(pageImageName('a.pdf', 1, 5, 'png'), 'a_1.png');
});

// ── 사진 합치기
test('사진 합치기: 세로는 너비 맞춤, 가로는 높이 맞춤, 간격', () => {
  const v = mergeLayout([{ w: 1000, h: 500 }, { w: 500, h: 500 }], { dir: 'vertical', gap: 10 });
  assert.equal(v.W, 500);
  assert.deepEqual(v.rects, [{ x: 0, y: 0, w: 500, h: 250 }, { x: 0, y: 260, w: 500, h: 500 }]);
  assert.equal(v.H, 760);
  const h = mergeLayout([{ w: 400, h: 300 }, { w: 300, h: 600 }], { dir: 'horizontal' });
  assert.equal(h.H, 300);
  assert.deepEqual(h.rects[1], { x: 400, y: 0, w: 150, h: 300 });
  const o = mergeLayout([{ w: 100, h: 100 }, { w: 300, h: 100 }], { dir: 'vertical', fit: 'original' });
  assert.equal(o.W, 300); assert.equal(o.rects[0].x, 100); // 가운데 정렬
  const big = mergeLayout(Array.from({ length: 20 }, () => ({ w: 2000, h: 2000 })), { dir: 'vertical' });
  assert.ok(big.scaled && big.H <= 16000);
  assert.deepEqual(mergeLayout([], { dir: 'vertical' }).rects, []);
});

// ── 단위 변환
test('단위 변환: 정의값', () => {
  assert.equal(convert(1, 'in', 'cm', 'length'), 2.54);
  assert.ok(Math.abs(convert(1, 'lb', 'kg', 'weight') - 0.45359237) < 1e-12);
  assert.ok(Math.abs(convert(84, 'm2', 'pyeong', 'area') - 25.41) < 0.01);
  assert.equal(convert(100, 'C', 'F', 'temp'), 212);
  assert.ok(Math.abs(convert(98.6, 'F', 'C', 'temp') - 37) < 1e-9);
  assert.ok(Math.abs(convert(0, 'C', 'K', 'temp') - 273.15) < 1e-9);
  assert.ok(Math.abs(convert(100, 'kmh', 'ms', 'speed') - 27.7777777778) < 1e-6);
  assert.equal(convert(1, 'GB', 'MB', 'data'), 1024);
  assert.ok(Math.abs(convert(1, 'geun', 'g', 'weight') - 600) < 1e-9);
  assert.equal(convert(1, 'x', 'cm', 'length'), null);
  assert.equal(fmtNum(2.54), '2.54');
  assert.equal(fmtNum(1609.344), '1,609.344');
  assert.equal(fmtNum(0.1 + 0.2), '0.3');
});

// ── 로또
test('로또: 6개·중복 없음·정렬·고정수·제외수', () => {
  const r = makeSets({ count: 10, fixed: [7], exclude: [1, 2, 3], rand: seeded(9) });
  assert.equal(r.sets.length, 10);
  for (const s of r.sets) {
    assert.equal(s.length, 6); assert.equal(new Set(s).size, 6);
    assert.deepEqual(s, [...s].sort((a, b) => a - b));
    assert.ok(s.includes(7)); assert.ok(!s.some((n) => n <= 3)); assert.ok(s.every((n) => n >= 1 && n <= 45));
  }
  assert.ok(makeSets({ fixed: [1, 2, 3, 4, 5, 6] }).error);
  assert.ok(makeSets({ fixed: [5], exclude: [5] }).error);
  assert.ok(makeSets({ exclude: Array.from({ length: 41 }, (_, i) => i + 1) }).error);
  assert.deepEqual(parseNums('3, 17 22, 3, 46, 0'), [3, 17, 22]);
  assert.deepEqual([1, 10, 11, 20, 21, 31, 41, 45].map(ballBand), [0, 0, 1, 1, 2, 3, 4, 4]);
});
