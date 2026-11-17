import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, toChosung, searchTools } from '../src/lib/search.js';
import { TOOLS } from '../src/data/tools.js';

const live = TOOLS.filter((t) => t.status === 'live');
const slugs = (q) => searchTools(live, q).map((t) => t.slug);

test('정규화와 초성', () => {
  assert.equal(normalize(' PDF  합치기·나누기 '), 'pdf합치기나누기');
  assert.equal(toChosung('만 나이'), 'ㅁ ㄴㅇ');
  assert.equal(toChosung('PDF변환'), 'PDFㅂㅎ');
});

test('제목·별칭으로 찾기', () => {
  assert.equal(slugs('만나이')[0], 'korean-age');
  assert.equal(slugs('pdf 합치기')[0], 'pdf-merge-split');
  assert.ok(slugs('디데이').includes('d-day'));
  assert.ok(slugs('n빵').includes('dutch-pay'));
  assert.ok(slugs('여권').includes('id-photo'));
  assert.ok(slugs('동영상 압축').includes('video-compress'));
  assert.ok(slugs('한글').includes('hwp-to-pdf'));
});

test('초성 검색', () => {
  assert.equal(slugs('ㅁㄴㅇ')[0], 'korean-age');
  assert.ok(slugs('ㄷㅊㅍㅇ').includes('dutch-pay'));
});

test('여러 단어는 모두 맞아야 하고, 없으면 빈 결과', () => {
  assert.ok(slugs('pdf jpg').every((s) => ['pdf-to-jpg', 'jpg-to-pdf'].includes(s)));
  assert.deepEqual(slugs('없는기능xyz'), []);
  assert.deepEqual(slugs('   '), []);
});

test('모든 공개 도구에 검색용 별칭이 있음', () => {
  for (const t of live) assert.ok(t.keywords && t.keywords.length >= 4, t.slug);
});
