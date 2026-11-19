import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, offsetMinutes, zonedToUtc, localInfo, diffLabel, utcLabel, isDst, fmtLocal, dayPart } from '../src/lib/worldTime.js';

const JAN = Date.UTC(2026, 0, 15, 3), JUL = Date.UTC(2026, 6, 15, 3);

test('시차: 서머타임 반영', () => {
  assert.equal(offsetMinutes('Asia/Seoul', JAN), 540);
  assert.equal(offsetMinutes('America/New_York', JAN), -300);
  assert.equal(offsetMinutes('America/New_York', JUL), -240);
  assert.equal(offsetMinutes('Europe/London', JUL), 60);
  assert.equal(offsetMinutes('Asia/Kolkata', JAN), 330);
  assert.equal(offsetMinutes('Australia/Sydney', JAN), 660); // 남반구 1월은 서머타임
  assert.ok(isDst('America/New_York', JUL));
  assert.ok(!isDst('America/New_York', JAN));
  assert.ok(!isDst('Asia/Seoul', JUL));
  assert.ok(isDst('Australia/Sydney', JAN));
});

test('현지 시각 → 순간 → 다른 도시', () => {
  // 서울 2026-07-15 09:00 = 뉴욕 7월 14일 20:00 (서머타임, 13시간 차)
  const ms = zonedToUtc({ y: 2026, m: 7, d: 15, h: 9, mi: 0 }, 'Asia/Seoul');
  const ny = localInfo('America/New_York', ms);
  assert.deepEqual([ny.m, ny.d, ny.h, ny.mi], [7, 14, 20, 0]);
  // 서머타임 시작일 근처: 뉴욕 2026-03-08 03:30 (02:00→03:00 건너뜀 직후)
  const t = zonedToUtc({ y: 2026, m: 3, d: 8, h: 3, mi: 30 }, 'America/New_York');
  const back = localInfo('America/New_York', t);
  assert.deepEqual([back.d, back.h, back.mi], [8, 3, 30]);
});

test('문구', () => {
  assert.equal(diffLabel(-840), '서울보다 14시간 느려요');
  assert.equal(diffLabel(-210), '서울보다 3시간 30분 느려요');
  assert.equal(diffLabel(0), '서울과 같아요');
  assert.equal(diffLabel(120, '도쿄'), '도쿄보다 2시간 빨라요');
  assert.equal(utcLabel(540), 'UTC+9');
  assert.equal(utcLabel(-240), 'UTC-4');
  assert.equal(utcLabel(330), 'UTC+5:30');
  const f = fmtLocal({ y: 2026, m: 7, d: 14, h: 20, mi: 5, wd: 2 }, { y: 2026, m: 7, d: 15 });
  assert.deepEqual(f, { date: '7월 14일(화)', time: '오후 8:05', dayNote: '전날' });
  assert.equal(fmtLocal({ y: 2026, m: 7, d: 15, h: 0, mi: 0, wd: 3 }).time, '오전 12:00');
  assert.equal(dayPart(10), 'work');
  assert.equal(dayPart(2), 'night');
  assert.equal(dayPart(20), 'free');
});

test('도시 목록: 시간대 이름이 모두 유효', () => {
  for (const c of CITIES) assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: c.tz }), c.tz);
  assert.equal(new Set(CITIES.map((c) => c.id)).size, CITIES.length);
});
