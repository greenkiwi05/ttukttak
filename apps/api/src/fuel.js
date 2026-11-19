// 유가: 오피넷(한국석유공사) 무료 API에서 전국·시도별 평균 판매가를 받아 KV에 둔다.
// 키: Cloudflare 비밀 환경변수 OPINET_KEY. 이용 조건은 오피넷 약관을 따른다 (출처: 오피넷 표시).
// 응답 형식은 { RESULT: { OIL: [...] } } (숫자는 문자열일 수 있음) — 바뀌면 이 파일만 고친다.

export const OPINET = 'https://www.opinet.co.kr/api';
export const FUEL_KV = 'fuel:latest';
/** 화면에 쓰는 제품 (오피넷 제품 코드) */
export const PRODUCTS = { B027: '휘발유', D047: '경유', K015: 'LPG(부탄)', B034: '고급휘발유' };
const SIDO_PRODUCTS = ['B027', 'D047']; // 시도별은 휘발유·경유만
const REFRESH_MS = 3 * 3600e3; // 3시간마다

const num = (v) => { const n = Number(String(v ?? '').replace(/,/g, '').trim()); return Number.isFinite(n) ? n : null; };
const list = (body) => { const o = body?.RESULT?.OIL; return Array.isArray(o) ? o : o ? [o] : null; };

/** 전국 평균 → { date, items: [{ code, name, price, diff }] } | { error } */
export function parseAll(body) {
  const oil = list(body);
  if (!oil) return { error: '응답 형식이 달라요' };
  const items = [];
  let date = null;
  for (const o of oil) {
    const code = String(o?.PRODCD ?? '').trim();
    const price = num(o?.PRICE);
    if (!PRODUCTS[code] || !(price > 0)) continue;
    items.push({ code, name: PRODUCTS[code], price, diff: num(o?.DIFF) });
    const d = String(o?.TRADE_DT ?? '').trim();
    if (/^\d{8}$/.test(d)) date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
  }
  return items.length ? { date, items } : { error: '유가 항목이 없어요' };
}

/** 시도별 → [{ code, name, price, diff }] | { error } (전국 '00'은 뺀다) */
export function parseSido(body) {
  const oil = list(body);
  if (!oil) return { error: '응답 형식이 달라요' };
  const items = [];
  for (const o of oil) {
    const code = String(o?.SIDOCD ?? '').trim();
    const name = String(o?.SIDONM ?? '').trim();
    const price = num(o?.PRICE);
    if (!code || code === '00' || !name || !(price > 0)) continue;
    items.push({ code, name, price, diff: num(o?.DIFF) });
  }
  return items.length ? items : { error: '시도별 유가가 없어요' };
}

async function getJson(fetch, url) {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const text = await res.text();
    try { return { body: JSON.parse(text) }; } catch { return { error: '응답이 JSON이 아니에요 (키 오류 가능성)' }; }
  } catch (e) {
    return { error: '요청 실패: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

/** 3시간이 지났으면 새로 받는다 (전국 1회 + 시도별 2회) */
export async function refreshFuel({ kv, key, fetch, now = Date.now() }) {
  const saved = await kv.get(FUEL_KV, 'json');
  if (saved?.fetchedAt && now - Date.parse(saved.fetchedAt) < REFRESH_MS) return { skipped: true };
  if (!key) return { error: 'API 키가 없어요 (OPINET_KEY)' };
  const q = `out=json&code=${encodeURIComponent(key)}`;
  const a = await getJson(fetch, `${OPINET}/avgAllPrice.do?${q}`);
  if ('error' in a) return a;
  const all = parseAll(a.body);
  if ('error' in all) return all;
  const sido = {};
  for (const p of SIDO_PRODUCTS) {
    const s = await getJson(fetch, `${OPINET}/avgSidoPrice.do?${q}&prodcd=${p}`);
    if ('body' in s) { const r = parseSido(s.body); if (Array.isArray(r)) sido[p] = r; }
  }
  const data = { source: '오피넷', date: all.date, fetchedAt: new Date(now).toISOString(), national: all.items, sido };
  await kv.put(FUEL_KV, JSON.stringify(data));
  return { updated: true };
}
