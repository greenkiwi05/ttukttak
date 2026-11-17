import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration, fmtHMS, fmtColon, addToClock, clockDiff, sumDurations } from '../src/lib/timeCalc.js';
import { evaluate, tokenize, fmtResult } from '../src/lib/calcExpr.js';

const v = (expr, opt) => { const r = evaluate(expr, opt); return 'error' in r ? r.error : r.value; };

// ── 시간 계산기
test('기간 입력 해석', () => {
  assert.equal(parseDuration('1:30'), 5400);
  assert.equal(parseDuration('1:30:15'), 5415);
  assert.equal(parseDuration('1시간 30분'), 5400);
  assert.equal(parseDuration('2시간'), 7200);
  assert.equal(parseDuration('90분'), 5400);
  assert.equal(parseDuration('45초'), 45);
  assert.equal(parseDuration('1.5시간'), 5400);
  assert.equal(parseDuration('90'), 5400); // 숫자만 = 분
  assert.equal(parseDuration('-30분'), -1800);
  assert.equal(parseDuration('1h20m'), 4800);
  for (const s of ['', 'abc', '1:75', '시간']) assert.equal(parseDuration(s), null, s);
});

test('표시 형식', () => {
  assert.equal(fmtHMS(8130), '2시간 15분 30초');
  assert.equal(fmtHMS(7200), '2시간');
  assert.equal(fmtHMS(0), '0초');
  assert.equal(fmtHMS(-90), '-1분 30초');
  assert.equal(fmtColon(5400), '1:30');
  assert.equal(fmtColon(5415), '1:30:15');
});

test('시각 더하기·빼기, 날짜 넘김', () => {
  assert.deepEqual(addToClock('09:30', 5400), { time: '11:00', dayOffset: 0 });
  assert.deepEqual(addToClock('22:00', 3 * 3600), { time: '01:00', dayOffset: 1 });
  assert.deepEqual(addToClock('01:00', -3 * 3600), { time: '22:00', dayOffset: -1 });
  assert.deepEqual(addToClock('9', 100 * 3600), { time: '13:00', dayOffset: 4 });
  assert.ok(addToClock('25:00', 60).error);
});

test('두 시각 사이, 합계', () => {
  assert.deepEqual(clockDiff('09:00', '17:30'), { sec: 30600, overnight: false });
  assert.deepEqual(clockDiff('23:00', '01:30'), { sec: 9000, overnight: true });
  const s = sumDurations('1:30\n45분\n2시간\n-20분\n엉터리');
  assert.equal(s.total, 5400 + 2700 + 7200 - 1200);
  assert.equal(s.count, 4);
  assert.deepEqual(s.bad, ['엉터리']);
});

// ── 공학용 계산기
test('사칙연산·우선순위·괄호·곱셈 생략', () => {
  assert.equal(v('1+2×3'), 7);
  assert.equal(v('(1+2)×3'), 9);
  assert.equal(v('10÷4'), 2.5);
  assert.equal(v('0.1+0.2'), 0.3);
  assert.equal(v('2^3^2'), 512); // 오른쪽부터
  assert.equal(v('-2^2'), -4);
  assert.equal(v('2(3+4)'), 14);
  assert.equal(v('3−−2'), 5);
  assert.equal(v('50%×200'), 100);
  assert.equal(v('5!'), 120);
  assert.equal(v('1.5e3+1'), 1501);
});

test('함수·상수·각도', () => {
  assert.equal(v('sin(30)'), 0.5);
  assert.equal(v('sin(180)'), 0);
  assert.equal(v('cos(60)'), 0.5);
  assert.equal(v('tan(45)'), 1);
  assert.equal(v('sin(π/2)', { deg: false }), 1);
  assert.equal(v('√(16)+sqrt(9)'), 7);
  assert.equal(v('log(1000)'), 3);
  assert.equal(v('ln(e)'), 1);
  assert.equal(v('2π'), 6.28318530718);
  assert.equal(v('asin(1)'), 90);
  assert.equal(v('abs(-3)'), 3);
});

test('오류 처리', () => {
  assert.equal(v('1/0'), '0으로 나눌 수 없어요.');
  assert.equal(v('sqrt(-1)'), '계산할 수 없는 값이에요.');
  assert.equal(v('tan(90)'), '계산할 수 없는 값이에요.');
  assert.equal(v('(1+2'), '괄호 짝이 맞지 않아요.');
  assert.equal(v('1+'), '식이 올바르지 않아요.');
  assert.equal(v(''), '식을 입력해 주세요.');
  assert.ok(String(v('2$3')).includes('알 수 없는 문자'));
  assert.equal(v('171!'), '값이 너무 커요.');
  assert.equal(tokenize('2π').length, 3);
  assert.equal(fmtResult(1234567.5), '1,234,567.5');
  assert.equal(fmtResult(1e20), '1e+20');
});
