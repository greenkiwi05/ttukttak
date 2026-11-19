// 24절기 로직. 날짜·절입 시각은 /api/solar-terms (한국천문연구원 특일 정보)에서 받는다.
// 절기 이름의 뜻과 계절 구분은 전통적인 설명이라 여기 둔다 (날짜는 해마다 달라서 하드코딩하지 않음).

/** 절기 이름 → 계절·뜻 */
export const TERM_INFO = {
  입춘: ['봄', '봄이 시작돼요'], 우수: ['봄', '눈이 녹아 비가 돼요'], 경칩: ['봄', '개구리가 겨울잠에서 깨어나요'],
  춘분: ['봄', '낮과 밤의 길이가 같아져요'], 청명: ['봄', '하늘이 맑고 날이 풀려요'], 곡우: ['봄', '곡식을 깨우는 봄비가 내려요'],
  입하: ['여름', '여름이 시작돼요'], 소만: ['여름', '햇볕이 풍부해 만물이 자라요'], 망종: ['여름', '씨를 뿌리기 좋은 때예요'],
  하지: ['여름', '낮이 1년 중 가장 길어요'], 소서: ['여름', '작은 더위가 와요'], 대서: ['여름', '1년 중 가장 덥다는 때예요'],
  입추: ['가을', '가을이 시작돼요'], 처서: ['가을', '더위가 한풀 꺾여요'], 백로: ['가을', '풀잎에 흰 이슬이 맺혀요'],
  추분: ['가을', '밤과 낮의 길이가 같아져요'], 한로: ['가을', '찬 이슬이 맺혀요'], 상강: ['가을', '서리가 내리기 시작해요'],
  입동: ['겨울', '겨울이 시작돼요'], 소설: ['겨울', '첫눈이 내린다는 때예요'], 대설: ['겨울', '눈이 많이 내린다는 때예요'],
  동지: ['겨울', '밤이 1년 중 가장 길어요'], 소한: ['겨울', '작은 추위가 와요'], 대한: ['겨울', '큰 추위가 와요'],
};
export const SEASONS = ['봄', '여름', '가을', '겨울'];

const ms = (d) => Date.parse(d + 'T00:00:00Z');
export const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / 86400e3);

/**
 * /api/solar-terms 응답 → [{ date, name, time?, longitude? }] (날짜순). 이상하면 null
 * @param {any} data { years: { '2026': [...] } }
 */
export function allTerms(data) {
  if (!data || typeof data.years !== 'object') return null;
  const out = [];
  for (const list of Object.values(data.years)) {
    if (!Array.isArray(list)) continue;
    for (const t of list) if (t && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && t.name) out.push(t);
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out.length ? out : null;
}

export const termsOfYear = (terms, year) => terms.filter((t) => t.date.startsWith(year + '-'));
export const years = (terms) => [...new Set(terms.map((t) => Number(t.date.slice(0, 4))))].sort((a, b) => a - b);

/** 오늘 기준 지금 절기(가장 최근에 지난 것)와 다음 절기 */
export function around(terms, today) {
  let cur = null, next = null;
  for (const t of terms) {
    if (t.date <= today) cur = t;
    else { next = t; break; }
  }
  return { cur, next, dday: next ? daysBetween(today, next.date) : null };
}

/** 계절별로 묶기 (그해 1월의 소한·대한은 겨울) */
export function bySeason(list) {
  const out = Object.fromEntries(SEASONS.map((s) => [s, []]));
  for (const t of list) out[TERM_INFO[t.name]?.[0] ?? '겨울'].push(t);
  return out;
}

let pending = null;
export function loadTerms(fetchFn = globalThis.fetch) {
  pending ??= fetchFn('/api/solar-terms')
    .then((r) => (r.ok ? r.json() : null))
    .then(allTerms)
    .catch(() => null)
    .then((d) => { if (!d) pending = null; return d; });
  return pending;
}
