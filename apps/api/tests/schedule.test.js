import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCHEDULE, CRONS, jobsFor } from '../src/schedule.js';

// wrangler.jsonc (주석 포함 JSON) 읽기
const raw = readFileSync(new URL('../../../wrangler.jsonc', import.meta.url), 'utf8');
const wrangler = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''));

test('일정표와 wrangler.jsonc의 cron이 같다', () => {
  assert.deepEqual([...wrangler.triggers.crons].sort(), [...CRONS].sort());
});

test('일정표 형식', () => {
  const ids = SCHEDULE.map((j) => j.id);
  assert.equal(new Set(ids).size, ids.length, '작업 id 중복');
  for (const j of SCHEDULE) {
    assert.equal(typeof j.run, 'function', j.id);
    for (const c of j.crons) {
      assert.equal(c.split(' ').length, 5, `${j.id}: cron은 5칸 (${c})`);
      assert.ok(!/\s[0-7](-[0-7])?$/.test(c), `${j.id}: 요일은 숫자 대신 MON-FRI처럼 이름으로 (Cloudflare는 1=일요일)`);
    }
  }
});

test('한 cron의 외부 호출 합이 무료 플랜 한도(50) 안', () => {
  for (const c of CRONS) {
    const sum = jobsFor(c).reduce((a, j) => a + j.maxCalls, 0);
    assert.ok(sum <= 50, `${c}: ${sum}회`);
  }
});
