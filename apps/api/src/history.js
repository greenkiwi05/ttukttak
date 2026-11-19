// 과거 환율 저장·조회 (Cloudflare D1 = SQLite).
// - 매일 받은 고시 환율을 rates 테이블에 쌓는다.
// - 처음에는 비어 있으므로, 매시간 cron이 BACKFILL_START까지 과거 날짜를 조금씩 거꾸로 채운다
//   (수출입은행 하루 1000회 제한 → 한 번에 BACKFILL_PER_RUN일씩).
// SQL은 모두 바인딩(?)으로만 값을 넣는다.
import { fetchDay } from './rates.js';

export const BACKFILL_START = '2016-01-01';
export const BACKFILL_PER_RUN = 25; // 매시간 × 25 = 하루 600회 (한도 1000회 안에서 오늘 환율 갱신 몫을 남긴다)
const CURSOR_KEY = 'backfill:cursor'; // 다음에 채울 날짜 (이 날짜부터 과거로)

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS rates (
    date TEXT NOT NULL, code TEXT NOT NULL, unit INTEGER NOT NULL, name TEXT NOT NULL,
    base REAL NOT NULL, send REAL, receive REAL,
    PRIMARY KEY (date, code)
  )`,
  'CREATE INDEX IF NOT EXISTS rates_code_date ON rates (code, date)',
];

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
export const isCode = (s) => typeof s === 'string' && /^[A-Z]{3}$/.test(s);

/** 'YYYY-MM-DD'에서 n일 빼기 */
export function addDays(date, n) {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
}

/** 이번에 채울 날짜 목록 (cursor부터 과거로, start 이전은 안 함) */
export function planBackfill(cursor, start = BACKFILL_START, n = BACKFILL_PER_RUN) {
  const out = [];
  for (let d = cursor; d >= start && out.length < n; d = addDays(d, -1)) out.push(d);
  return out;
}

export async function ensureSchema(db) {
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
}

export async function saveDay(db, date, rates) {
  if (!rates.length) return;
  const stmt = db.prepare('INSERT OR REPLACE INTO rates (date, code, unit, name, base, send, receive) VALUES (?, ?, ?, ?, ?, ?, ?)');
  await db.batch(rates.map((r) => stmt.bind(date, r.code, r.unit, r.name, r.base, r.send ?? null, r.receive ?? null)));
}

/**
 * 과거 날짜 채우기 한 번. 키 오류·한도 초과 등은 멈추고 다음 실행에 다시 시도한다.
 * @returns {Promise<{ done: boolean, filled?: number, cursor?: string, error?: string }>}
 */
export async function backfillOnce({ db, kv, key, fetch, today }) {
  const cursor = (await kv.get(CURSOR_KEY)) || today;
  if (cursor < BACKFILL_START) return { done: true };
  let filled = 0;
  let next = cursor;
  for (const date of planBackfill(cursor)) {
    const r = await fetchDay({ key, fetch, date });
    if ('error' in r) {
      await kv.put(CURSOR_KEY, next);
      return { done: false, filled, cursor: next, error: r.error };
    }
    if ('rates' in r) { await saveDay(db, date, r.rates); filled++; }
    next = addDays(date, -1);
  }
  await kv.put(CURSOR_KEY, next);
  return { done: next < BACKFILL_START, filled, cursor: next };
}

/** 저장된 기간 { min, max } */
export async function coverage(db) {
  const r = await db.prepare('SELECT MIN(date) AS min, MAX(date) AS max FROM rates').first();
  return { min: r?.min ?? null, max: r?.max ?? null };
}

/** 한 통화의 기간별 매매기준율 [[date, base], ...] */
export async function history(db, code, from, to) {
  const { results } = await db
    .prepare('SELECT date, base, unit, name FROM rates WHERE code = ? AND date BETWEEN ? AND ? ORDER BY date')
    .bind(code, from, to)
    .all();
  const last = results[results.length - 1];
  return { code, unit: last?.unit ?? null, name: last?.name ?? null, from, to, points: results.map((r) => [r.date, r.base]) };
}

/** 그날(고시가 없으면 그 전 마지막 고시일)의 전체 통화 환율 */
export async function day(db, date) {
  const row = await db.prepare('SELECT MAX(date) AS d FROM rates WHERE date <= ?').bind(date).first();
  if (!row?.d) return { requested: date, date: null, rates: [] };
  const { results } = await db.prepare('SELECT code, unit, name, base, send, receive FROM rates WHERE date = ?').bind(row.d).all();
  return { requested: date, date: row.d, rates: results };
}
