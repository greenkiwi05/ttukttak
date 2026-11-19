// 한국천문연구원 특일 정보 API(공공데이터포털): 공휴일과 24절기를 연도별로 받아 KV에 모아 둔다.
// - 공휴일: 정부 기준값을 하드코딩하지 않기 위해 항상 API에서 받는다 (대체·임시공휴일 자동 반영).
// - 24절기: 천문 계산 값이라 한 번 받으면 바뀌지 않는다.
// 이용허락범위: 제한 없음 (한국천문연구원 안내). 키: Cloudflare 비밀 환경변수 HOLIDAY_KEY ("일반 인증키(Decoding)")

const BASE = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';
export const HOLIDAY_URL = `${BASE}/getRestDeInfo`;
export const TERMS_URL = `${BASE}/get24DivisionsInfo`;
export const HOLIDAY_KV = 'holidays:all';
export const TERMS_KV = 'solarterms:all';
export const FIRST_YEAR = 2016;
const DAY = 86400e3;

const ymd = (v) => { const d = String(v ?? '').trim(); return /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : null; };

/** 공휴일 항목 → { date, name } (공휴일이 아니면 null) */
export const holidayItem = (it) => {
  const date = ymd(it?.locdate);
  return it?.isHoliday === 'Y' && date ? { date, name: String(it.dateName ?? '').trim() || '공휴일' } : null;
};

/** 24절기 항목 → { date, name, time?, longitude? } (time: 절입 시각 'HH:MM', KST) */
export const termItem = (it) => {
  const date = ymd(it?.locdate);
  const name = String(it?.dateName ?? '').trim();
  if (!date || !name) return null;
  const out = { date, name };
  const k = String(it?.kst ?? '').trim();
  if (/^\d{4}$/.test(k)) out.time = `${k.slice(0, 2)}:${k.slice(2)}`;
  const lon = Number(String(it?.sunLongitude ?? '').trim());
  if (String(it?.sunLongitude ?? '').trim() !== '' && Number.isFinite(lon)) out.longitude = lon;
  return out;
};

/**
 * 특일 정보 응답 → { items } | { error }
 * - 항목이 하나면 item이 배열이 아니라 객체로 오고, 없으면 items가 빈 문자열로 온다.
 * - 공식 데이터 포맷이 XML이라, 키 오류 등은 _type=json이어도 XML로 올 수 있다 → XML도 읽는다.
 */
export function parseSpcde(text, mapItem = holidayItem) {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return parseXml(String(text), mapItem);
  }
  const header = body?.response?.header;
  if (!header) return { error: '응답 형식이 달라요' };
  if (header.resultCode !== '00') return { error: `${header.resultCode} ${header.resultMsg ?? ''}`.trim() };
  const raw = body.response.body?.items?.item;
  const list = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  const items = list.map(mapItem).filter(Boolean);
  items.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return { items: items.filter((x, i) => !i || x.date !== items[i - 1].date || x.name !== items[i - 1].name) };
}
/** 예전 이름 (공휴일) */
export const parseHolidays = (text) => parseSpcde(text, holidayItem);

function parseXml(xml, mapItem) {
  const tag = (s, t) => (s.match(new RegExp(`<${t}>([^<]*)</${t}>`)) || [])[1];
  const auth = tag(xml, 'returnAuthMsg');
  if (auth) return { error: auth };
  const code = tag(xml, 'resultCode');
  if (code === undefined) return { error: '응답 형식이 달라요' };
  if (code !== '00') return { error: `${code} ${tag(xml, 'resultMsg') ?? ''}`.trim() };
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => ({
    dateName: tag(m[1], 'dateName'), isHoliday: tag(m[1], 'isHoliday'), locdate: tag(m[1], 'locdate'),
    kst: tag(m[1], 'kst'), sunLongitude: tag(m[1], 'sunLongitude'),
  }));
  return parseSpcde(JSON.stringify({ response: { header: { resultCode: '00' }, body: { items: items.length ? { item: items } : '' } } }), mapItem);
}

/** 종류별 설정 */
export const KINDS = {
  holidays: { url: HOLIDAY_URL, kv: HOLIDAY_KV, mapItem: holidayItem, ahead: 1, recheck: true, maxYears: 13 },
  // 24절기는 바뀌지 않으므로 다시 확인하지 않고, 한 번에 몇 해씩만 채운다 (같은 cron의 호출 한도 때문)
  terms: { url: TERMS_URL, kv: TERMS_KV, mapItem: termItem, ahead: 2, recheck: false, maxYears: 6 },
};

/** 한 해 받기 */
export async function fetchYear({ key, fetch, year, kind = KINDS.holidays }) {
  if (!key) return { error: 'API 키가 없어요 (HOLIDAY_KEY)' };
  const url = `${kind.url}?serviceKey=${encodeURIComponent(key)}&solYear=${year}&numOfRows=100&_type=json`;
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return parseSpcde(await res.text(), kind.mapItem);
  } catch (e) {
    return { error: '요청 실패: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

/** 이번에 받아야 할 연도: 없는 해 전부 + (recheck면 하루 한 번) 올해·내년 */
export function yearsToFetch(saved, thisYear, now = Date.now(), kind = KINDS.holidays) {
  const years = [];
  for (let y = FIRST_YEAR; y <= thisYear + kind.ahead; y++) if (!saved?.years?.[y]) years.push(y);
  const stale = !saved?.fetchedAt || now - Date.parse(saved.fetchedAt) > DAY;
  if (kind.recheck && stale) for (const y of [thisYear, thisYear + 1]) if (!years.includes(y)) years.push(y);
  return years.slice(0, kind.maxYears);
}

/**
 * 갱신 (매시간 불러도 되도록 필요할 때만 외부 호출)
 * 아직 발표 전인 해는 빈 목록 → 저장하지 않고 다음에 다시 확인.
 */
export async function refreshYearly({ kv, key, fetch, now = Date.now(), kind = KINDS.holidays }) {
  const thisYear = new Date(now + 9 * 3600e3).getUTCFullYear();
  const saved = await kv.get(kind.kv, 'json');
  const years = yearsToFetch(saved, thisYear, now, kind);
  if (!years.length) return { updated: 0 };
  const next = { years: { ...(saved?.years ?? {}) }, fetchedAt: saved?.fetchedAt ?? null };
  let updated = 0;
  for (const y of years) {
    const r = await fetchYear({ key, fetch, year: y, kind });
    if ('error' in r) {
      if (updated) await save(kv, kind.kv, next, now);
      return { updated, error: r.error };
    }
    if (r.items.length) { next.years[y] = r.items; updated++; }
  }
  await save(kv, kind.kv, next, now);
  return { updated };
}
export const refreshHolidays = (p) => refreshYearly({ ...p, kind: KINDS.holidays });
export const refreshTerms = (p) => refreshYearly({ ...p, kind: KINDS.terms });

async function save(kv, kvKey, data, now) {
  data.fetchedAt = new Date(now).toISOString();
  await kv.put(kvKey, JSON.stringify(data));
}
