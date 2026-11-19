import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBlob, frequency, gaps, topBy, oddEven, bands, rankOf, checkAll, parsePicks, wonKo, lastN, loadLotto } from '../src/lib/lottoStats.js';

const blob = {
  rounds: [
    [2, '2002-12-14', 9, 13, 21, 25, 32, 42, 2],
    [1, '2002-12-07', 10, 23, 29, 33, 37, 40, 16],
    [3, '2002-12-21', 11, 16, 19, 21, 27, 31, 30],
  ],
};
const rounds = parseBlob(blob);

test('응답 정리: 회차순', () => {
  assert.deepEqual(rounds.map((r) => r.round), [1, 2, 3]);
  assert.deepEqual(rounds[0].nums, [10, 23, 29, 33, 37, 40]);
  assert.equal(rounds[0].bonus, 16);
  assert.equal(parseBlob({ rounds: [] }), null);
  assert.equal(parseBlob(null), null);
});

test('출현 횟수·보너스 포함', () => {
  const f = frequency(rounds);
  assert.equal(f[21], 2);
  assert.equal(f[16], 1);
  assert.equal(f.reduce((a, b) => a + b), 18);
  assert.equal(frequency(rounds, { bonus: true })[16], 2);
});

test('안 나온 기간', () => {
  const g = gaps(rounds);
  assert.equal(g[21], 0); // 3회(마지막)에 나옴
  assert.equal(g[42], 1); // 2회에 나옴
  assert.equal(g[10], 2); // 1회에 나옴
  assert.equal(g[1], 3); // 한 번도 안 나옴
});

test('상위 번호·홀짝·구간', () => {
  const f = frequency(rounds);
  assert.equal(topBy(f, 1)[0], 21);
  assert.deepEqual(topBy(f, 3, 'asc'), [1, 2, 3]);
  assert.deepEqual(oddEven(rounds), { '4:2': 2, '5:1': 1 }); // 1·2회 홀4 짝2, 3회 홀5 짝1
  assert.equal(bands(rounds).reduce((a, b) => a + b), 18);
});

test('등수: 1~5등 기준', () => {
  const r = { nums: [1, 5, 18, 23, 27, 28], bonus: 8 };
  assert.equal(rankOf(r, [1, 5, 18, 23, 27, 28]), 1);
  assert.equal(rankOf(r, [1, 5, 18, 23, 27, 8]), 2);
  assert.equal(rankOf(r, [1, 5, 18, 23, 27, 9]), 3);
  assert.equal(rankOf(r, [1, 5, 18, 23, 8, 9]), 4); // 보너스는 2등에만
  assert.equal(rankOf(r, [1, 5, 18, 40, 41, 42]), 5);
  assert.equal(rankOf(r, [1, 5, 40, 41, 42, 43]), null);
  const all = checkAll(rounds, [10, 23, 29, 33, 37, 41]);
  assert.equal(all.counts[3], 1);
  assert.deepEqual(all.best[0], { round: 1, date: '2002-12-07', rank: 3 });
});

test('내 번호 입력', () => {
  assert.deepEqual(parsePicks('1, 5 18-23 27/28'), { nums: [1, 5, 18, 23, 27, 28] });
  assert.ok(parsePicks('1 2 3').error.includes('3개'));
  assert.ok(parsePicks('1 2 3 4 5 46').error.includes('45'));
  assert.ok(parsePicks('1 1 2 3 4 5').error.includes('두 번'));
});

test('금액 표기·기간', () => {
  assert.equal(wonKo(3103164459), '31억 316만 4,459원');
  assert.equal(wonKo(50000), '5만원');
  assert.equal(wonKo(5000), '5,000원');
  assert.equal(wonKo(null), '-');
  assert.deepEqual(lastN(rounds, 2).map((r) => r.round), [2, 3]);
  assert.equal(lastN(rounds, 0).length, 3);
});

test('불러오기: 실패하면 null', async () => {
  assert.equal(await loadLotto(async () => ({ ok: false })), null);
  const d = await loadLotto(async () => ({ ok: true, json: async () => ({ ...blob, latest: { round: 3 } }) }));
  assert.equal(d.rounds.length, 3);
  assert.equal(d.latest.round, 3);
});
