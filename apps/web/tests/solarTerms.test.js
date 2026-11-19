import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TERM_INFO, allTerms, termsOfYear, years, around, bySeason, loadTerms } from '../src/lib/solarTerms.js';

// 테스트용 데이터 (날짜는 로직 검사용 예시)
const data = { years: {
  2026: [{ date: '2026-12-22', name: '동지' }, { date: '2026-01-05', name: '소한' }, { date: '2026-02-04', name: '입춘', time: '05:02', longitude: 315 }, { date: '2026-06-21', name: '하지' }],
  2027: [{ date: '2027-01-05', name: '소한' }],
} };
const terms = allTerms(data);

test('24개 절기 설명이 모두 있다', () => {
  assert.equal(Object.keys(TERM_INFO).length, 24);
  for (const [, [season, desc]] of Object.entries(TERM_INFO)) { assert.ok(['봄', '여름', '가을', '겨울'].includes(season)); assert.ok(desc.endsWith('요')); }
});

test('정리·연도', () => {
  assert.deepEqual(terms.map((t) => t.name), ['소한', '입춘', '하지', '동지', '소한']);
  assert.equal(termsOfYear(terms, 2026).length, 4);
  assert.deepEqual(years(terms), [2026, 2027]);
  assert.equal(allTerms({ years: {} }), null);
});

test('지금 절기·다음 절기', () => {
  const a = around(terms, '2026-11-19');
  assert.equal(a.cur.name, '하지');
  assert.equal(a.next.name, '동지');
  assert.equal(a.dday, 33);
  assert.equal(around(terms, '2026-12-22').cur.name, '동지'); // 당일은 그 절기
  assert.equal(around(terms, '2025-01-01').cur, null);
});

test('계절 묶기', () => {
  const s = bySeason(termsOfYear(terms, 2026));
  assert.deepEqual(s.겨울.map((t) => t.name), ['소한', '동지']);
  assert.deepEqual(s.봄.map((t) => t.name), ['입춘']);
});

test('불러오기 실패하면 null', async () => {
  assert.equal(await loadTerms(async () => ({ ok: false })), null);
});
