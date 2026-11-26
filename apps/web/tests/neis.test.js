import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neisBytes, cutToBytes, bytesForHangul, hangulForBytes, unusualChars, tidy, enterCount } from '../src/lib/neis.js';
import { countText } from '../src/lib/charCount.js';

test('나이스 기준: 한글 3, 영문·숫자·공백 1, 엔터 1', () => {
  assert.equal(neisBytes('가'), 3);
  assert.equal(neisBytes('a1 '), 3);
  assert.equal(neisBytes('\n'), 1);
  assert.equal(neisBytes('\r\n'), 1); // 윈도우 줄바꿈도 1
  assert.equal(neisBytes('수학 탐구 활동에서 A+'), 3 * 8 + 5); // 한글 8자, 띄어쓰기 3, A+ 2
  assert.equal(neisBytes(''), 0);
  assert.equal(neisBytes(null), 0);
  assert.equal(neisBytes('가\r\n나'), countText('가\r\n나').bytesUtf8); // 글자수 세기의 한글 3바이트 값과 같다
});

test('한글 글자 수 ↔ 바이트', () => {
  assert.equal(bytesForHangul(500), 1500);
  assert.equal(bytesForHangul('300'), 900);
  assert.equal(hangulForBytes(1500), 500);
  assert.equal(hangulForBytes(1501), 500);
  assert.equal(hangulForBytes(-3), 0);
});

test('바이트 제한으로 자르기는 글자를 쪼개지 않는다', () => {
  assert.equal(cutToBytes('가나다', 7), '가나'); // 3+3=6, 다음 글자는 넘침
  assert.equal(cutToBytes('가나다', 9), '가나다');
  assert.equal(cutToBytes('ab가', 4), 'ab');
  assert.equal(cutToBytes('👍👍', 5), '👍');
  assert.equal(neisBytes(cutToBytes('가a\r\n나'.repeat(50), 100)) <= 100, true);
  assert.equal(cutToBytes('가', 0), '');
});

test('한글·영문과 바이트가 다른 글자 찾기', () => {
  const u = unusualChars('성실함·책임감👍 ㄱ ① 가나 abc ·');
  assert.deepEqual(u.map((x) => [x.ch, x.bytes, x.count]), [['·', 2, 2], ['👍', 4, 1], ['①', 3, 1]]);
  assert.deepEqual(unusualChars('한글과 영어 English 123.'), []);
});

test('붙여 넣은 글 정리', () => {
  assert.equal(tidy('  첫 줄   입니다.  \r\n\r\n\r\n\r\n둘째 줄\t\t끝  '), '첫 줄 입니다.\n\n둘째 줄 끝');
  assert.equal(enterCount('a\r\nb\nc'), 2);
});
