// 공휴일·영업일 로직. 공휴일 목록은 /api/holidays (한국천문연구원 특일 정보, Worker가 모아 둠)에서 받는다.
// 날짜는 모두 'YYYY-MM-DD' 문자열, 계산은 UTC 기준(시간대 영향 없음).

const DAY = 86400e3;
const ms = (d) => Date.parse(d + 'T00:00:00Z');
export const addDays = (d, n) => new Date(ms(d) + n * DAY).toISOString().slice(0, 10);
export const weekday = (d) => new Date(ms(d)).getUTCDay(); // 0=일 … 6=토
export const isWeekend = (d) => weekday(d) === 0 || weekday(d) === 6;
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export const dow = (d) => WEEK[weekday(d)];
export const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / DAY);

/**
 * /api/holidays 응답 → Map(date → 이름 목록). 이상하면 null
 * @param {any} data { years: { '2026': [{ date, name }] } }
 */
export function holidayMap(data) {
  if (!data || typeof data.years !== 'object') return null;
  const m = new Map();
  for (const list of Object.values(data.years)) {
    if (!Array.isArray(list)) continue;
    for (const h of list) {
      if (!h || !/^\d{4}-\d{2}-\d{2}$/.test(h.date)) continue;
      const names = m.get(h.date) ?? [];
      if (!names.includes(h.name)) names.push(h.name);
      m.set(h.date, names);
    }
  }
  return m.size ? m : null;
}

/** 저장된 연도 범위 { min, max } */
export function yearRange(data) {
  const ys = Object.keys(data?.years ?? {}).map(Number).filter((y) => data.years[y]?.length).sort((a, b) => a - b);
  return ys.length ? { min: ys[0], max: ys[ys.length - 1] } : null;
}

/** 쉬는 날? (주말 또는 공휴일, extra는 회사 휴무 등 추가로 쉬는 날 Set) */
export const isOff = (d, hol, extra) => isWeekend(d) || hol.has(d) || !!extra?.has(d);

/** 한 해 공휴일 목록 [{ date, names, weekend }] (주말과 겹친 공휴일 표시) */
export function yearList(year, hol) {
  return [...hol.entries()]
    .filter(([d]) => d.startsWith(year + '-'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, names]) => ({ date, names, weekend: isWeekend(date) }));
}

/**
 * 두 날짜 사이 영업일 수 (주말·공휴일 제외)
 * @param {{ from: string, to: string, hol: Map<string,string[]>, extra?: Set<string>, includeStart?: boolean, includeEnd?: boolean }} p
 * @returns {{ days: number, calendar: number, weekends: number, holidays: { date: string, names: string[] }[], extraDays: number } | { error: string }}
 */
export function businessDays({ from, to, hol, extra, includeStart = true, includeEnd = true }) {
  if (!from || !to) return { error: '날짜 두 개를 넣어 주세요.' };
  if (from > to) return { error: '끝 날짜가 시작 날짜보다 앞에 있어요.' };
  if (daysBetween(from, to) > 366 * 50) return { error: '기간이 너무 길어요.' };
  let days = 0, weekends = 0, extraDays = 0, calendar = 0;
  const holidays = [];
  for (let d = includeStart ? from : addDays(from, 1); includeEnd ? d <= to : d < to; d = addDays(d, 1)) {
    calendar++;
    if (isWeekend(d)) { weekends++; continue; }
    if (hol.has(d)) { holidays.push({ date: d, names: hol.get(d) }); continue; }
    if (extra?.has(d)) { extraDays++; continue; }
    days++;
  }
  return { days, calendar, weekends, holidays, extraDays };
}

/**
 * n영업일 뒤(음수면 앞) 날짜. 시작일 자체는 세지 않는다 (오늘 기준 3영업일 뒤 = 오늘 다음 영업일부터 3번째)
 * @returns {{ date: string, skipped: { date: string, names: string[] }[] } | { error: string }}
 */
export function addBusinessDays({ from, n, hol, extra }) {
  if (!from) return { error: '기준 날짜를 넣어 주세요.' };
  if (!Number.isInteger(n) || n === 0) return { error: '영업일 수를 1 이상(또는 -1 이하)으로 넣어 주세요.' };
  if (Math.abs(n) > 3000) return { error: '3000영업일까지 계산할 수 있어요.' };
  const step = n > 0 ? 1 : -1;
  const skipped = [];
  let d = from, left = Math.abs(n);
  while (left > 0) {
    d = addDays(d, step);
    if (isOff(d, hol, extra)) { if (!isWeekend(d)) skipped.push({ date: d, names: hol.get(d) ?? ['추가 휴무'] }); continue; }
    left--;
  }
  return { date: d, skipped: step > 0 ? skipped : skipped.reverse() };
}

/** 쉬는 날(주말+공휴일)이 이어진 덩어리 중 3일 이상이고 공휴일이 하나라도 낀 연휴 */
export function longWeekends(year, hol) {
  const out = [];
  let start = null;
  const end = `${year}-12-31`;
  for (let d = `${year}-01-01`; d <= addDays(end, 1); d = addDays(d, 1)) {
    const off = d <= end && isOff(d, hol);
    if (off && !start) start = d;
    if (!off && start) {
      const last = addDays(d, -1);
      const len = daysBetween(start, last) + 1;
      const names = [];
      for (let x = start; x <= last; x = addDays(x, 1)) for (const nm of hol.get(x) ?? []) if (!names.includes(nm)) names.push(nm);
      if (len >= 3 && names.length) out.push({ start, end: last, days: len, names });
      start = null;
    }
  }
  return out;
}

/**
 * 연차 하루(또는 이틀)만 쓰면 길게 쉬는 날: 평일 1~2일이 쉬는 날 사이에 끼어 있고,
 * 그날을 쉬면 4일 이상 이어지며 공휴일이 하나라도 낀 경우
 */
export function bridgeDays(year, hol) {
  const out = [];
  const seen = new Set();
  for (let d = `${year}-01-01`; d <= `${year}-12-31`; d = addDays(d, 1)) {
    if (isOff(d, hol) || seen.has(d)) continue;
    for (const k of [1, 2]) {
      const leave = Array.from({ length: k }, (_, i) => addDays(d, i));
      if (leave.some((x) => isOff(x, hol))) break;
      const before = addDays(d, -1), after = addDays(leave[k - 1], 1);
      if (!isOff(before, hol) || !isOff(after, hol)) continue;
      let s = before; while (isOff(addDays(s, -1), hol)) s = addDays(s, -1);
      let e = after; while (isOff(addDays(e, 1), hol)) e = addDays(e, 1);
      const total = daysBetween(s, e) + 1;
      let hasHoliday = false;
      for (let x = s; x <= e; x = addDays(x, 1)) if (hol.has(x)) hasHoliday = true;
      if (total >= 4 && hasHoliday && total - k >= 2) {
        out.push({ leave, start: s, end: e, days: total });
        leave.forEach((x) => seen.add(x));
        break;
      }
    }
  }
  return out;
}

/** 달력 한 달: 주 단위 배열, 빈칸은 null */
export function monthGrid(year, month) {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array(weekday(first)).fill(null);
  for (let i = 0; i < days; i++) cells.push(addDays(first, i));
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "2026.1.2, 2026-01-03" 같은 입력 → 날짜 Set (추가 휴무일) */
export function parseExtra(s) {
  const set = new Set();
  for (const m of String(s ?? '').matchAll(/(\d{4})\D(\d{1,2})\D(\d{1,2})/g)) {
    const d = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if (!Number.isNaN(ms(d)) && new Date(ms(d)).toISOString().slice(0, 10) === d) set.add(d);
  }
  return set;
}

let pending = null;
/** /api/holidays 한 번만 불러서 같이 쓴다 (실패하면 null) */
export function loadHolidays(fetchFn = globalThis.fetch) {
  pending ??= fetchFn('/api/holidays')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d && holidayMap(d) ? { map: holidayMap(d), range: yearRange(d) } : null))
    .catch(() => null)
    .then((d) => { if (!d) pending = null; return d; });
  return pending;
}
