// 공휴일: 한국천문연구원 특일 정보 API(공공데이터포털)의 공휴일 목록을 연도별로 받아 KV 한 곳에 모아 둔다.
// 정부 기준값을 하드코딩하지 않기 위해 공휴일은 직접 쓰지 않고 항상 API에서 받는다 (대체·임시공휴일 자동 반영).
// 키: Cloudflare 비밀 환경변수 HOLIDAY_KEY (공공데이터포털 "일반 인증키(Decoding)")

export const HOLIDAY_URL = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
export const HOLIDAY_KV = 'holidays:all';
export const FIRST_YEAR = 2016;
const DAY = 86400e3;

/**
 * 특일 정보 응답 → { items: [{ date, name }] } | { error }
 * - 항목이 하나면 item이 배열이 아니라 객체로 오고, 없으면 items가 빈 문자열로 온다.
 * - 키 오류 등은 _type=json이어도 XML로 올 수 있다.
 */
export function parseHolidays(text) {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return parseXml(String(text));
  }
  const header = body?.response?.header;
  if (!header) return { error: '응답 형식이 달라요' };
  if (header.resultCode !== '00') return { error: `${header.resultCode} ${header.resultMsg ?? ''}`.trim() };
  const raw = body.response.body?.items?.item;
  const list = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  const items = [];
  for (const it of list) {
    if (it?.isHoliday !== 'Y') continue;
    const d = String(it.locdate ?? '');
    if (!/^\d{8}$/.test(d)) continue;
    items.push({ date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`, name: String(it.dateName ?? '').trim() || '공휴일' });
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return { items: items.filter((x, i) => !i || x.date !== items[i - 1].date || x.name !== items[i - 1].name) };
}

// 공식 데이터 포맷이 XML이라 _type=json이 무시될 때를 대비해 XML도 읽는다
function parseXml(xml) {
  const tag = (s, t) => (s.match(new RegExp(`<${t}>([^<]*)</${t}>`)) || [])[1];
  const auth = tag(xml, 'returnAuthMsg');
  if (auth) return { error: auth };
  const code = tag(xml, 'resultCode');
  if (code === undefined) return { error: '응답 형식이 달라요' };
  if (code !== '00') return { error: `${code} ${tag(xml, 'resultMsg') ?? ''}`.trim() };
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => ({
    dateName: tag(m[1], 'dateName'), isHoliday: tag(m[1], 'isHoliday'), locdate: tag(m[1], 'locdate'),
  }));
  return parseHolidays(JSON.stringify({ response: { header: { resultCode: '00' }, body: { items: items.length ? { item: items } : '' } } }));
}

/** 한 해 공휴일 받기 */
export async function fetchYear({ key, fetch, year }) {
  if (!key) return { error: 'API 키가 없어요 (HOLIDAY_KEY)' };
  const url = `${HOLIDAY_URL}?serviceKey=${encodeURIComponent(key)}&solYear=${year}&numOfRows=100&_type=json`;
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return parseHolidays(await res.text());
  } catch (e) {
    return { error: '요청 실패: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

/** 이번에 받아야 할 연도: 없는 해 전부 + (하루 지났으면) 올해·내년 */
export function yearsToFetch(saved, thisYear, now = Date.now()) {
  const years = [];
  for (let y = FIRST_YEAR; y <= thisYear + 1; y++) if (!saved?.years?.[y]) years.push(y);
  const stale = !saved?.fetchedAt || now - Date.parse(saved.fetchedAt) > DAY;
  if (stale) for (const y of [thisYear, thisYear + 1]) if (!years.includes(y)) years.push(y);
  return years;
}

/**
 * 공휴일 갱신 (매시간 불러도 되도록 필요할 때만 외부 호출)
 * 내년 공휴일은 보통 그해 중반 이후에 올라온다 → 빈 목록이면 저장하지 않고 다음에 다시 확인.
 */
export async function refreshHolidays({ kv, key, fetch, now = Date.now() }) {
  const thisYear = new Date(now + 9 * 3600e3).getUTCFullYear();
  const saved = await kv.get(HOLIDAY_KV, 'json');
  const years = yearsToFetch(saved, thisYear, now);
  if (!years.length) return { updated: 0 };
  const next = { years: { ...(saved?.years ?? {}) }, fetchedAt: saved?.fetchedAt ?? null };
  let updated = 0;
  for (const y of years) {
    const r = await fetchYear({ key, fetch, year: y });
    if ('error' in r) return { updated, error: r.error, saved: updated ? await save(kv, next, now) : false };
    if (r.items.length) { next.years[y] = r.items; updated++; }
  }
  await save(kv, next, now);
  return { updated };
}

async function save(kv, data, now) {
  data.fetchedAt = new Date(now).toISOString();
  await kv.put(HOLIDAY_KV, JSON.stringify(data));
  return true;
}
