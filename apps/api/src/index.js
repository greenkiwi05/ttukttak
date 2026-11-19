// 뚝딱 Worker: /api/* 만 여기서 처리하고, 나머지 요청은 정적 사이트(apps/web/dist)로 넘긴다.
// - API는 KV·D1에 저장된 값만 돌려준다. 외부 API를 부르는 정기 작업은 schedule.js(일정표) + jobs.js(내용).
// - API 키는 코드에 없다. Cloudflare 비밀 환경변수(EXIM_KEY, HOLIDAY_KEY)로 넣는다 (로컬은 .dev.vars).
import { kstDate } from './rates.js';
import { coverage, history, day, isDate, isCode, BACKFILL_START } from './history.js';
import { LOTTO_KV, roundDetail } from './lotto.js';
import { HOLIDAY_KV, TERMS_KV } from './holidays.js';
import { FUEL_KV } from './fuel.js';
import { KV, refreshRates, lottoFromVisit } from './jobs.js';
import { jobsFor } from './schedule.js';

// 저장된 값(문자열 JSON)이 있으면 그대로, 없으면 마지막 실패 이유와 함께 503
async function stored(env, kvKey, errKey, emptyMsg, maxAge) {
  const data = await env.RATES.get(kvKey);
  if (data) return new Response(data, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}` } });
  const e = await env.RATES.get(errKey, 'json');
  return json({ error: emptyMsg, reason: e?.reason ?? null, at: e?.at ?? null }, 503);
}

async function lottoRoundApi(url, env) {
  const n = Number(url.searchParams.get('n'));
  if (!Number.isInteger(n) || n < 1 || n > 100000) return json({ error: '회차(n)를 숫자로 보내 주세요' }, 400);
  const r = await roundDetail(env.DB, n);
  if (!r) return json({ error: '없는 회차예요' }, 404);
  return json(r, 200, 86400);
}

const json = (body, status = 200, maxAge = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
    },
  });

async function latest(env) {
  let data = await env.RATES.get(KV.rates, 'json');
  if (!data) {
    // 처음 배포 직후, cron이 돌기 전. 최근 10분 안에 실패했으면 다시 부르지 않는다.
    const last = await env.RATES.get(KV.ratesError, 'json');
    if (!last) data = await refreshRates(env);
    if (!data) {
      const e = last ?? (await env.RATES.get(KV.ratesError, 'json'));
      return json({ error: '환율을 아직 불러오지 못했어요', reason: e?.reason ?? null, at: e?.at ?? null }, 503);
    }
  }
  return json(data, 200, 600);
}

// D1 조회는 Cloudflare 캐시에 잠깐 담아서 같은 요청이 DB를 반복해서 읽지 않게 한다.
async function cached(request, ctx, make) {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await make();
  if (res.status === 200) ctx.waitUntil(cache.put(request, res.clone()));
  return res;
}

async function dayApi(url, env) {
  const date = url.searchParams.get('date') ?? '';
  if (!isDate(date)) return json({ error: '날짜는 YYYY-MM-DD 형식으로 보내 주세요' }, 400);
  const [d, cov] = await Promise.all([day(env.DB, date), coverage(env.DB)]);
  const past = d.date && d.date < kstDate();
  return json({ ...d, coverage: cov }, 200, past ? 86400 : 600);
}

async function historyApi(url, env) {
  const code = url.searchParams.get('code') ?? '';
  const to = url.searchParams.get('to') || kstDate();
  const from = url.searchParams.get('from') || BACKFILL_START;
  if (!isCode(code)) return json({ error: '통화 코드(예: USD)를 보내 주세요' }, 400);
  if (!isDate(from) || !isDate(to) || from > to) return json({ error: '기간을 YYYY-MM-DD 형식으로 보내 주세요' }, 400);
  const [h, cov] = await Promise.all([history(env.DB, code, from, to), coverage(env.DB)]);
  return json({ ...h, coverage: cov }, 200, 3600);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method !== 'GET') return json({ error: 'GET만 돼요' }, 405);
    try {
      if (url.pathname === '/api/rates') return await latest(env);
      if (url.pathname === '/api/rates/day') return await cached(request, ctx, () => dayApi(url, env));
      if (url.pathname === '/api/rates/history') return await cached(request, ctx, () => historyApi(url, env));
      if (url.pathname === '/api/lotto') {
        ctx.waitUntil(lottoFromVisit(env, request.cf?.colo).catch((e) => console.log('로또 방문 갱신 오류:', String(e))));
        return await stored(env, LOTTO_KV, KV.lottoError, '당첨번호를 아직 불러오지 못했어요', 600);
      }
      if (url.pathname === '/api/holidays') return await stored(env, HOLIDAY_KV, KV.holidaysError, '공휴일을 아직 불러오지 못했어요', 3600);
      if (url.pathname === '/api/solar-terms') return await stored(env, TERMS_KV, KV.termsError, '24절기를 아직 불러오지 못했어요', 86400);
      if (url.pathname === '/api/fuel') return await stored(env, FUEL_KV, KV.fuelError, '유가를 아직 불러오지 못했어요', 1800);
      if (url.pathname === '/api/lotto/round') return await cached(request, ctx, () => lottoRoundApi(url, env));
    } catch (e) {
      console.log('API 오류:', String(e));
      // 과거 환율 테이블이 아직 없을 때(첫 cron 전)도 여기로 온다
      return json({ error: '잠시 후 다시 시도해 주세요' }, 503);
    }
    return json({ error: '없는 주소예요' }, 404);
  },

  // 정기 작업: 이 cron에 등록된 작업을 schedule.js 순서대로 실행. 하나가 실패해도 다음 작업은 돈다.
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      for (const job of jobsFor(event.cron)) {
        try {
          await job.run(env);
        } catch (e) {
          console.log(`작업 ${job.id} 오류:`, String(e));
        }
      }
    })());
  },
};
