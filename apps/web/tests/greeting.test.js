import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGreetings, SITUATIONS, RELATIONS, TONES, ENVELOPE, vocative, hasBatchim } from '../src/lib/greeting.js';

test('모든 상황×관계×말투 조합에 문구가 1개 이상', () => {
  for (const situation of Object.keys(SITUATIONS))
    for (const relation of Object.keys(RELATIONS))
      for (const tone of Object.keys(TONES)) {
        const r = makeGreetings({ situation, relation, tone });
        assert.ok(r.length >= 1, `${situation}/${relation}/${tone}`);
      }
});

test('이름 미입력 시 자리표시자·부르는 말이 남지 않음', () => {
  for (const situation of Object.keys(SITUATIONS))
    for (const tone of Object.keys(TONES))
      for (const t of makeGreetings({ situation, relation: 'friend', tone, name: '  ' })) {
        assert.ok(!/[{}]|undefined|null|님, |^, /.test(t), t);
      }
});

test('부르는 말: 받침에 따라 아/야, 격식은 님', () => {
  assert.equal(hasBatchim('지현'), true);
  assert.equal(hasBatchim('민수'), false);
  assert.equal(vocative('지현', 'casual'), '지현아, ');
  assert.equal(vocative('민수', 'casual'), '민수야, ');
  assert.equal(vocative('Tom', 'casual'), 'Tom, ');
  assert.equal(vocative('김부장', 'formal'), '김부장님, ');
  assert.ok(makeGreetings({ situation: 'wedding', relation: 'friend', tone: 'casual', name: '민수' })[0].startsWith('민수야, '));
});

test('관계 맞춤 문구가 먼저, 다른 관계 전용 문구는 제외', () => {
  const client = makeGreetings({ situation: 'opening', relation: 'client', tone: 'formal' });
  assert.ok(client[0].includes('파트너'));
  const friend = makeGreetings({ situation: 'opening', relation: 'friend', tone: 'formal' });
  assert.ok(!friend.some((t) => t.includes('파트너')));
});

test('봉투 문구는 모든 상황에 정의', () => {
  for (const s of Object.keys(SITUATIONS)) assert.ok(Array.isArray(ENVELOPE[s]), s);
});
