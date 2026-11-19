import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHolidays, yearsToFetch, refreshHolidays, FIRST_YEAR } from '../src/holidays.js';

const wrap = (item) => JSON.stringify({ response: { header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' }, body: { items: item === undefined ? '' : { item }, totalCount: 1 } } });

test('응답 정리: 배열·객체 하나·빈 값·XML 오류', () => {
  const r = parseHolidays(wrap([
    { dateKind: '01', dateName: '추석', isHoliday: 'Y', locdate: 20261005, seq: 1 },
    { dateKind: '01', dateName: '개천절', isHoliday: 'Y', locdate: 20261003, seq: 1 },
    { dateKind: '01', dateName: '추석', isHoliday: 'Y', locdate: 20261005, seq: 2 }, // 중복
    { dateKind: '01', dateName: '제헌절', isHoliday: 'N', locdate: 20260717, seq: 1 }, // 공휴일 아님
  ]));
  assert.deepEqual(r.items, [{ date: '2026-10-03', name: '개천절' }, { date: '2026-10-05', name: '추석' }]);
  assert.deepEqual(parseHolidays(wrap({ dateName: '1월1일', isHoliday: 'Y', locdate: 20270101 })).items, [{ date: '2027-01-01', name: '1월1일' }]);
  assert.deepEqual(parseHolidays(wrap(undefined)).items, []);
  const xml = '<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>';
  assert.equal(parseHolidays(xml).error, 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR');
  assert.ok(parseHolidays(JSON.stringify({ response: { header: { resultCode: '30', resultMsg: 'ERR' } } })).error.startsWith('30'));
  // 정상 XML 응답 (공식 기본 포맷)
  const okXml = '<?xml version="1.0" encoding="UTF-8"?><response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items>'
    + '<item><dateKind>01</dateKind><dateName>삼일절</dateName><isHoliday>Y</isHoliday><locdate>20260301</locdate><seq>1</seq></item>'
    + '<item><dateKind>01</dateName><dateName>대체공휴일</dateName><isHoliday>Y</isHoliday><locdate>20260302</locdate><seq>1</seq></item>'
    + '</items><numOfRows>100</numOfRows><pageNo>1</pageNo><totalCount>2</totalCount></body></response>';
  assert.deepEqual(parseHolidays(okXml).items, [{ date: '2026-03-01', name: '삼일절' }, { date: '2026-03-02', name: '대체공휴일' }]);
  assert.deepEqual(parseHolidays('<response><header><resultCode>00</resultCode></header><body><items></items></body></response>').items, []);
});

test('받을 연도: 처음엔 전부, 그 뒤엔 하루 한 번 올해·내년', () => {
  const now = Date.parse('2026-11-19T07:00:00Z');
  const all = yearsToFetch(null, 2026, now);
  assert.equal(all[0], FIRST_YEAR);
  assert.equal(all[all.length - 1], 2027);
  const years = Object.fromEntries(Array.from({ length: 2027 - FIRST_YEAR + 1 }, (_, i) => [FIRST_YEAR + i, [{}]]));
  assert.deepEqual(yearsToFetch({ years, fetchedAt: '2026-11-19T06:00:00Z' }, 2026, now), []);
  assert.deepEqual(yearsToFetch({ years, fetchedAt: '2026-11-18T06:00:00Z' }, 2026, now), [2026, 2027]);
  const { 2027: _, ...noNext } = years;
  assert.deepEqual(yearsToFetch({ years: noNext, fetchedAt: '2026-11-19T06:00:00Z' }, 2026, now), [2027]);
});

test('갱신: 내년이 아직 비어 있으면 저장 안 함, 키 오류면 멈춤', async () => {
  const store = new Map();
  const kv = { get: async (k) => (store.has(k) ? JSON.parse(store.get(k)) : null), put: async (k, v) => void store.set(k, v) };
  const calls = [];
  const fetch = async (url) => {
    const y = Number(new URL(url).searchParams.get('solYear'));
    calls.push(y);
    return { ok: true, text: async () => (y === 2027 ? wrap(undefined) : wrap({ dateName: '1월1일', isHoliday: 'Y', locdate: y * 10000 + 101 })) };
  };
  const now = Date.parse('2026-11-19T07:00:00Z');
  const r = await refreshHolidays({ kv, key: 'XXXX', fetch, now });
  assert.equal(r.updated, 2026 - FIRST_YEAR + 1);
  const saved = JSON.parse(store.get('holidays:all'));
  assert.deepEqual(saved.years['2026'], [{ date: '2026-01-01', name: '1월1일' }]);
  assert.equal(saved.years['2027'], undefined);
  // 한 시간 뒤: 2027만 다시 확인
  calls.length = 0;
  await refreshHolidays({ kv, key: 'XXXX', fetch, now: now + 3600e3 });
  assert.deepEqual(calls, [2027]);
  const bad = await refreshHolidays({ kv: { get: async () => null, put: async () => {} }, key: '', fetch, now });
  assert.ok(bad.error.includes('HOLIDAY_KEY'));
});
