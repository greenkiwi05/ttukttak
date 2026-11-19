import { test } from 'node:test';
import assert from 'node:assert/strict';
import { holidayMap, yearRange, businessDays, addBusinessDays, longWeekends, bridgeDays, monthGrid, parseExtra, yearList, dow, loadHolidays } from '../src/lib/holidays.js';

// 테스트용 가상 공휴일 (실제 목록이 아님 — 로직 검사용)
const data = {
  years: {
    2030: [
      { date: '2030-01-01', name: '새해' },
      { date: '2030-03-01', name: '기념일A' }, // 금
      { date: '2030-05-07', name: '기념일B' }, // 화 → 월요일(6일) 하루 쉬면 4연휴
      { date: '2030-10-03', name: '기념일C' }, // 목
      { date: '2030-10-03', name: '기념일D' }, // 같은 날 두 이름
      { date: '2030-12-25', name: '성탄' },
    ],
    2031: [],
  },
};
const hol = holidayMap(data);

test('공휴일 정리', () => {
  assert.deepEqual(hol.get('2030-10-03'), ['기념일C', '기념일D']);
  assert.deepEqual(yearRange(data), { min: 2030, max: 2030 });
  assert.equal(holidayMap({ years: {} }), null);
  assert.equal(dow('2030-03-01'), '금');
  assert.equal(yearList(2030, hol).length, 5);
});

test('영업일 수: 주말·공휴일 제외, 시작·끝 포함 선택', () => {
  // 2030-02-25(월) ~ 2030-03-08(금): 평일 10일 중 3/1(금) 공휴일 → 9
  const r = businessDays({ from: '2030-02-25', to: '2030-03-08', hol });
  assert.equal(r.days, 9);
  assert.equal(r.calendar, 12);
  assert.equal(r.weekends, 2);
  assert.deepEqual(r.holidays.map((h) => h.date), ['2030-03-01']);
  assert.equal(businessDays({ from: '2030-02-25', to: '2030-03-08', hol, includeStart: false }).days, 8);
  assert.equal(businessDays({ from: '2030-02-25', to: '2030-03-08', hol, extra: new Set(['2030-03-04']) }).days, 8);
  assert.ok(businessDays({ from: '2030-03-08', to: '2030-03-01', hol }).error);
});

test('n영업일 뒤·앞', () => {
  // 2030-02-27(수) + 3영업일: 28(목) 1, 3/1(금) 공휴일, 3/4(월) 2, 3/5(화) 3
  const r = addBusinessDays({ from: '2030-02-27', n: 3, hol });
  assert.equal(r.date, '2030-03-05');
  assert.deepEqual(r.skipped.map((s) => s.date), ['2030-03-01']);
  assert.equal(addBusinessDays({ from: '2030-03-05', n: -3, hol }).date, '2030-02-27');
  assert.ok(addBusinessDays({ from: '2030-03-05', n: 0, hol }).error);
});

test('연휴·연차 추천', () => {
  const lw = longWeekends(2030, hol);
  assert.deepEqual(lw.find((x) => x.names.includes('기념일A')), { start: '2030-03-01', end: '2030-03-03', days: 3, names: ['기념일A'] });
  const br = bridgeDays(2030, hol);
  const may = br.find((x) => x.leave.includes('2030-05-06'));
  assert.deepEqual(may, { leave: ['2030-05-06'], start: '2030-05-04', end: '2030-05-07', days: 4 });
  const oct = br.find((x) => x.leave.includes('2030-10-04')); // 목 공휴일 + 금 연차 = 4연휴
  assert.equal(oct.days, 4);
});

test('달력·추가 휴무 입력', () => {
  const g = monthGrid(2030, 3); // 2030-03-01 금요일
  assert.equal(g[0].indexOf('2030-03-01'), 5);
  assert.ok(g.every((w) => w.length === 7));
  assert.deepEqual([...parseExtra('2030.5.1, 2030-12-31 / 2030.2.30')], ['2030-05-01', '2030-12-31']);
});

test('불러오기: 실패하면 null', async () => {
  assert.equal(await loadHolidays(async () => ({ ok: false })), null);
  const d = await loadHolidays(async () => ({ ok: true, json: async () => data }));
  assert.equal(d.range.max, 2030);
});
