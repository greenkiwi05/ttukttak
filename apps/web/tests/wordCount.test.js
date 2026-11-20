import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordList, wordStats, cutWords, countText } from '../src/lib/charCount.js';

test('단어 세기: 기호만 있는 토막은 빼고, 하이픈·아포스트로피는 1단어', () => {
  assert.deepEqual(wordList('Hello, world! - well-known "don\'t" … 2026'), ['Hello', 'world', 'well-known', "don't", '2026']);
  assert.equal(wordList('').length, 0);
  assert.equal(wordList('   \n\t ').length, 0);
  assert.equal(wordList('나는 학교에 간다.').length, 3);
  assert.equal(countText('Hello - world').words, 2);
});

test('단어 통계', () => {
  const s = wordStats('The cat sat. The cat ran!\nA dog barked? Yes');
  assert.equal(s.words, 10);
  assert.equal(s.sentences, 4);
  assert.equal(s.unique, 8); // the·cat 중복
  assert.deepEqual(s.top, [['cat', 2]]); // the는 기능어라 뺌, 1번 나온 단어도 뺌
  assert.equal(wordStats('').sentences, 0);
  assert.equal(wordStats('3.5 is a number.').sentences, 1); // 소수점에서 문장을 나누지 않음
});

test('n단어까지 자르기', () => {
  assert.equal(cutWords('one two  three\nfour', 3), 'one two  three');
  assert.equal(cutWords('one - two three', 2), 'one - two');
  assert.equal(cutWords('one two', 5), 'one two');
  assert.equal(cutWords('one two', 0), '');
});
