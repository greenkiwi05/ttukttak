// 뚝딱 Worker: /api/* 만 여기서 처리하고, 나머지 요청은 정적 사이트(apps/web/dist)로 넘긴다.
// - 환율: 평일 정해진 시각(cron)마다 수출입은행 API를 불러 KV에 저장하고, /api/rates 는 저장된 값만 돌려준다.
// - API 키는 코드에 없다. Cloudflare 비밀 환경변수 EXIM_KEY 로 넣는다 (로컬은 .dev.vars).
import { fetchLatest, merge } from './rates.js';

const KV_KEY = 'rates:latest';

async function refresh(env) {
  const fresh = await fetchLatest({ key: env.EXIM_KEY, fetch: (u, i) => fetch(u, i) });
  if ('error' in fresh) {
    console.log('환율 갱신 실패:', fresh.error);
    return null;
  }
  const saved = await env.RATES.get(KV_KEY, 'json');
  const data = merge(saved, fresh);
  await env.RATES.put(KV_KEY, JSON.stringify(data));
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/rates') {
      if (request.method !== 'GET') return json({ error: 'GET만 돼요' }, 405);
      let data = await env.RATES.get(KV_KEY, 'json');
      if (!data) data = await refresh(env); // 처음 배포 직후, cron이 돌기 전
      if (!data) return json({ error: '환율을 아직 불러오지 못했어요' }, 503);
      return json(data, 200, 600);
    }
    if (url.pathname.startsWith('/api/')) return json({ error: '없는 주소예요' }, 404);
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(refresh(env));
  },
};
