// 정해진 시각에 도는 작업들의 실제 내용. 언제 도는지는 schedule.js 한 곳에서만 정한다.
// 모든 작업은 "필요할 때만 외부 API를 부른다" — 이미 최신이면 KV·D1만 보고 끝낸다.
import { fetchLatest, merge, kstDate } from './rates.js';
import { ensureSchema, saveDay, backfillOnce } from './history.js';
import { LOTTO_SCHEMA, syncLotto } from './lotto.js';
import { refreshHolidays } from './holidays.js';

/** KV 키 모음 (작업이 쓰고, API가 읽는다) */
export const KV = {
  rates: 'rates:latest',
  ratesError: 'rates:error', // 10분 뒤 자동 삭제 → 실패가 반복돼도 방문자마다 외부 API를 부르지 않게
  lottoError: 'lotto:error',
  holidaysError: 'holidays:error',
};

// 오류 문구에 키가 섞여 나가지 않게 가린다
export const mask = (s, key) => (key ? String(s).split(key).join('***') : String(s)).replace(/(authkey|serviceKey)=[^&\s]+/g, '$1=***');
export const fetcher = (u, i) => fetch(u, i);

async function saveError(env, kvKey, reason, ttl) {
  console.log(kvKey, '실패:', reason);
  await env.RATES.put(kvKey, JSON.stringify({ reason, at: new Date().toISOString() }), { expirationTtl: ttl });
}

/** 오늘 환율을 받아 KV(오늘 값)와 D1(과거 환율)에 저장. /api/rates가 비어 있을 때도 쓴다 */
export async function refreshRates(env) {
  const fresh = await fetchLatest({ key: env.EXIM_KEY, fetch: fetcher });
  if ('error' in fresh) {
    await saveError(env, KV.ratesError, mask(fresh.error, env.EXIM_KEY), 600);
    return null;
  }
  const saved = await env.RATES.get(KV.rates, 'json');
  const data = merge(saved, fresh);
  await env.RATES.put(KV.rates, JSON.stringify(data));
  try {
    await ensureSchema(env.DB);
    await saveDay(env.DB, fresh.date, fresh.rates);
  } catch (e) {
    console.log('과거 환율 저장 실패:', String(e));
  }
  return data;
}

/** 오늘 환율: 오늘 값이 이미 있으면 아무것도 안 함 */
export async function ratesToday(env) {
  const saved = await env.RATES.get(KV.rates, 'json');
  if (saved?.date === kstDate()) return;
  await refreshRates(env);
}

/** 과거 환율 채우기: 2016-01-01까지 거꾸로 25일씩, 다 채우면 아무것도 안 함 */
export async function ratesBackfill(env) {
  await ensureSchema(env.DB);
  const r = await backfillOnce({ db: env.DB, kv: env.RATES, key: env.EXIM_KEY, fetch: fetcher, today: kstDate() });
  if (!r.done) console.log('과거 환율 채우기:', r.filled, '일 저장, 다음', r.cursor, r.error ? '오류 ' + mask(r.error, env.EXIM_KEY) : '');
}

/** 공휴일: 없는 해 + 하루 한 번 올해·내년 */
export async function holidays(env) {
  const h = await refreshHolidays({ kv: env.RATES, key: env.HOLIDAY_KEY, fetch: fetcher });
  if (h.error) await saveError(env, KV.holidaysError, mask(h.error, env.HOLIDAY_KEY), 86400);
}

/** 로또: 저장된 마지막 회차가 "지금쯤 나왔어야 할 회차"보다 작을 때만 동행복권 호출 */
export async function lotto(env) {
  await env.DB.batch(LOTTO_SCHEMA.map((s) => env.DB.prepare(s)));
  const r = await syncLotto({ db: env.DB, kv: env.RATES, fetch: fetcher });
  if (r.error) await saveError(env, KV.lottoError, r.error, 86400);
  else if (r.saved) console.log('로또', r.saved, '회차 저장, 마지막', r.max);
}
