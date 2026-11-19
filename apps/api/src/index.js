// 뚝딱 Worker: /api/* 만 여기서 처리하고, 나머지 요청은 정적 사이트(apps/web/dist)로 넘긴다.
// - 오늘 환율: 평일 정해진 시각(cron)마다 수출입은행 API를 불러 KV에 저장, /api/rates 는 저장된 값만 돌려준다.
// - 과거 환율: 받은 값을 D1(rates 테이블)에 쌓고, 매시간 cron이 과거 날짜를 조금씩 채운다.
//   /api/rates/day?date=YYYY-MM-DD, /api/rates/history?code=USD&from=...&to=...
// - API 키는 코드에 없다. Cloudflare 비밀 환경변수 EXIM_KEY 로 넣는다 (로컬은 .dev.vars).
import { fetchLatest, merge, kstDate } from './rates.js';
import { ensureSchema, saveDay, backfillOnce, coverage, history, day, isDate, isCode, BACKFILL_START } from './history.js';
import { LOTTO_SCHEMA, LOTTO_KV, syncLotto, roundDetail } from './lotto.js';

const LOTTO_CRON = '35 * * * *'; // wrangler.jsonc의 로또 cron과 같아야 한다
const LOTTO_ERR = 'lotto:error';

async function lottoApi(env) {
  const blob = await env.RATES.get(LOTTO_KV);
  if (blob) return new Response(blob, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=600' } });
  const e = await env.RATES.get(LOTTO_ERR, 'json');
  return json({ error: '당첨번호를 아직 불러오지 못했어요', reason: e?.reason ?? null, at: e?.at ?? null }, 503);
}

async function lottoRoundApi(url, env) {
  const n = Number(url.searchParams.get('n'));
  if (!Number.isInteger(n) || n < 1 || n > 100000) return json({ error: '회차(n)를 숫자로 보내 주세요' }, 400);
  const r = await roundDetail(env.DB, n);
  if (!r) return json({ error: '없는 회차예요' }, 404);
  return json(r, 200, 86400);
}

const KV_KEY = 'rates:latest';
const ERR_KEY = 'rates:error'; // 최근 실패 이유 (10분 뒤 자동 삭제). 실패가 반복돼도 방문자마다 외부 API를 부르지 않게.
const BACKFILL_CRON = '5 * * * *'; // wrangler.jsonc의 과거 채우기 cron과 같아야 한다

// 오류 문구에 키가 섞여 나가지 않게 가린다
const mask = (s, key) => (key ? String(s).split(key).join('***') : String(s)).replace(/authkey=[^&\s]+/g, 'authkey=***');
const fetcher = (u, i) => fetch(u, i);

async function refresh(env) {
  const fresh = await fetchLatest({ key: env.EXIM_KEY, fetch: fetcher });
  if ('error' in fresh) {
    const reason = mask(fresh.error, env.EXIM_KEY);
    console.log('환율 갱신 실패:', reason);
    await env.RATES.put(ERR_KEY, JSON.stringify({ reason, at: new Date().toISOString() }), { expirationTtl: 600 });
    return null;
  }
  const saved = await env.RATES.get(KV_KEY, 'json');
  const data = merge(saved, fresh);
  await env.RATES.put(KV_KEY, JSON.stringify(data));
  try {
    await ensureSchema(env.DB);
    await saveDay(env.DB, fresh.date, fresh.rates);
  } catch (e) {
    console.log('과거 환율 저장 실패:', String(e));
  }
  return data;
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
  let data = await env.RATES.get(KV_KEY, 'json');
  if (!data) {
    // 처음 배포 직후, cron이 돌기 전. 최근 10분 안에 실패했으면 다시 부르지 않는다.
    const last = await env.RATES.get(ERR_KEY, 'json');
    if (!last) data = await refresh(env);
    if (!data) {
      const e = last ?? (await env.RATES.get(ERR_KEY, 'json'));
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
      if (url.pathname === '/api/lotto') return await lottoApi(env);
      if (url.pathname === '/api/lotto/round') return await cached(request, ctx, () => lottoRoundApi(url, env));
    } catch (e) {
      console.log('API 오류:', String(e));
      // 과거 환율 테이블이 아직 없을 때(첫 cron 전)도 여기로 온다
      return json({ error: '잠시 후 다시 시도해 주세요' }, 503);
    }
    return json({ error: '없는 주소예요' }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      if (event.cron === LOTTO_CRON) {
        // 매시 35분: 로또 당첨번호 (처음엔 1회부터 채우고, 이후엔 토요일 추첨 뒤 새 회차만)
        await env.DB.batch(LOTTO_SCHEMA.map((s) => env.DB.prepare(s)));
        const r = await syncLotto({ db: env.DB, kv: env.RATES, fetch: fetcher });
        if (r.error) {
          console.log('로또 동기화 실패:', r.error);
          await env.RATES.put(LOTTO_ERR, JSON.stringify({ reason: r.error, at: new Date().toISOString() }), { expirationTtl: 86400 });
        } else if (r.saved) console.log('로또', r.saved, '회차 저장, 마지막', r.max);
        return;
      }
      if (event.cron === BACKFILL_CRON) {
        // 매시간: 과거 환율 채우기 (BACKFILL_START까지 끝나면 아무것도 안 함)
        await ensureSchema(env.DB);
        const r = await backfillOnce({ db: env.DB, kv: env.RATES, key: env.EXIM_KEY, fetch: fetcher, today: kstDate() });
        if (!r.done) console.log('과거 환율 채우기:', r.filled, '일 저장, 다음', r.cursor, r.error ? '오류 ' + mask(r.error, env.EXIM_KEY) : '');
        return;
      }
      // 수출입은행은 영업일 11시 전후 하루 한 번 고시한다(일환율).
      // 11:00~12:50 사이 10분마다 확인하다가, 오늘 값이 저장되면 그날은 더 부르지 않는다.
      const saved = await env.RATES.get(KV_KEY, 'json');
      if (saved?.date === kstDate()) return;
      await refresh(env);
    })());
  },
};
