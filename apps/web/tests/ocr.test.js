import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, statusKo, charCount, LANGS } from '../src/lib/ocr.js';

test('인식 결과 다듬기', () => {
  assert.equal(cleanText('  안녕하세요   \n반가워요\t\n\n\n\n다음 문단\n'), '안녕하세요\n반가워요\n\n다음 문단');
  assert.equal(cleanText('첫 줄\n둘째 줄\n\n새 문단\n이어짐', { joinLines: true }), '첫 줄 둘째 줄\n\n새 문단 이어짐');
  assert.equal(cleanText(''), '');
  assert.equal(cleanText(null), '');
});

test('상태 문구·글자 수', () => {
  assert.ok(statusKo('loading language traineddata').includes('준비'));
  assert.equal(statusKo('recognizing text'), '글자를 읽는 중…');
  assert.equal(charCount('가 나\n다'), 3);
  assert.equal(LANGS[0].id, 'kor+eng');
});
