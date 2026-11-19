// 정해진 시각에 도는 작업들의 실제 내용. 언제 도는지는 schedule.js 한 곳에서만 정한다.
// 모든 작업은 "필요할 때만 외부 API를 부른다" — 이미 최신이면 KV·D1만 보고 끝낸다.
import { fetchLatest, merge, kstDate } from './rates.js';
import { ensureSchema, saveDay, backfillOnce } from './history.js';
import { LOTTO_SCHEMA, LOTTO_KV, syncLotto, expectedRound } from './lotto.js';
import { refreshHolidays, refreshTerms } from './holidays.js';
import { refreshFuel } from './fuel.js';

/** KV 키 모음 (작업이 쓰고, API가 읽는다) */
export const KV = {
  rates: 'rates:latest',
  ratesError: 'rates:error', // 10분 뒤 자동 삭제 → 실패가 반복돼도 방문자마다 외부 API를 부르지 않게
  lottoError: 'lotto:error',
  lottoLock: 'lotto:lock',
  holidaysError: 'holidays:error',
  termsError: 'solarterms:error',
  fuelError: 'fuel:error',
};

// 오류 문구에 키가 섞여 나가지 않게 가린다
export const mask = (s, key) => (key ? String(s).split(key).join('***') : String(s)).replace(/(authkey|serviceKey|code)=[^&\s]+/g, '$1=***');
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
  else if (h.updated) await env.RATES.delete(KV.holidaysError);
}

/** 로또: 저장된 마지막 회차가 "지금쯤 나왔어야 할 회차"보다 작을 때만 동행복권 호출 */
export async function lotto(env, where = 'cron') {
  await env.DB.batch(LOTTO_SCHEMA.map((s) => env.DB.prepare(s)));
  const r = await syncLotto({ db: env.DB, kv: env.RATES, fetch: fetcher });
  if (r.error) await saveError(env, KV.lottoError, `${r.error} (${where})`, 86400);
  else if (r.saved) { console.log('로또', r.saved, '회차 저장, 마지막', r.max, where); await env.RATES.delete(KV.lottoError); }
  return r;
}

/**
 * 방문으로 로또 갱신 시도. 동행복권은 해외 접속을 막는 것으로 보여(cron은 해외 데이터센터에서 돌면 522),
 * 한국 방문자 요청이 처리되는 국내 데이터센터에서 한 번 더 시도한다. 5분에 한 번만.
 */
export async function lottoFromVisit(env, colo) {
  if (await env.RATES.get(KV.lottoLock)) return;
  await env.RATES.put(KV.lottoLock, '1', { expirationTtl: 300 });
  const blob = await env.RATES.get(LOTTO_KV, 'json');
  if (blob?.latest?.round >= expectedRound()) return; // 이미 최신
  await lotto(env, `방문 ${colo ?? '?'}`);
}

/** 24절기: 없는 해만 (바뀌지 않는 값이라 다 받으면 호출 0) */
export async function solarTerms(env) {
  const r = await refreshTerms({ kv: env.RATES, key: env.HOLIDAY_KEY, fetch: fetcher });
  if (r.error) await saveError(env, KV.termsError, mask(r.error, env.HOLIDAY_KEY), 86400);
  else if (r.updated) await env.RATES.delete(KV.termsError);
}

/** 유가: 3시간마다 전국·시도별 평균 */
export async function fuel(env) {
  const r = await refreshFuel({ kv: env.RATES, key: env.OPINET_KEY, fetch: fetcher });
  if (r.error) await saveError(env, KV.fuelError, mask(r.error, env.OPINET_KEY), 86400);
  else if (r.updated) await env.RATES.delete(KV.fuelError); // 성공하면 지난 오류 기록은 지운다
}
