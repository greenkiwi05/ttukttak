// 과거 환율 조회 로직. 데이터는 /api/rates/day, /api/rates/history (apps/api, D1에 쌓인 수출입은행 고시 환율)

export const PERIODS = [
  ['1m', '1개월', 30], ['3m', '3개월', 91], ['6m', '6개월', 182], ['1y', '1년', 365], ['3y', '3년', 1095], ['all', '전체', 0],
];

/** 'YYYY-MM-DD' ± n일 */
export const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400e3).toISOString().slice(0, 10);

/** 기간 시작일 (days=0이면 전체 → null) */
export const fromDate = (today, days) => (days ? addDays(today, -days) : null);

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export const dateKo = (d) => {
  const [y, m, dd] = d.split('-').map(Number);
  return `${y}년 ${m}월 ${dd}일(${WEEK[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]})`;
};

/**
 * 기간 통계
 * @param {[string, number][]} points  [[date, base], ...] 날짜순
 */
export function stats(points) {
  if (!points.length) return null;
  let min = points[0], max = points[0], sum = 0;
  for (const p of points) {
    if (p[1] < min[1]) min = p;
    if (p[1] > max[1]) max = p;
    sum += p[1];
  }
  const first = points[0], last = points[points.length - 1];
  const r2 = (n) => Math.round(n * 100) / 100;
  return {
    min: { date: min[0], v: min[1] }, max: { date: max[0], v: max[1] },
    avg: r2(sum / points.length), first: { date: first[0], v: first[1] }, last: { date: last[0], v: last[1] },
    diff: r2(last[1] - first[1]), pct: r2(((last[1] - first[1]) / first[1]) * 100), n: points.length,
  };
}

/** 월별 평균 (최근 달 먼저) */
export function monthly(points) {
  const m = new Map();
  for (const [d, v] of points) {
    const k = d.slice(0, 7);
    const e = m.get(k) ?? { month: k, sum: 0, n: 0, min: Infinity, max: -Infinity };
    e.sum += v; e.n++; e.min = Math.min(e.min, v); e.max = Math.max(e.max, v);
    m.set(k, e);
  }
  return [...m.values()].reverse().map((e) => ({ month: e.month, avg: Math.round((e.sum / e.n) * 100) / 100, min: e.min, max: e.max, n: e.n }));
}

/** 보기 좋은 눈금 (1·2·5 × 10^k 간격) */
export function niceTicks(lo, hi, count = 4) {
  if (!(hi > lo)) { const pad = Math.abs(lo) * 0.01 || 1; lo -= pad; hi += pad; }
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(lo / step) * step, end = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { ticks, lo: start, hi: end, step };
}

/**
 * 선 그래프 좌표. 날짜는 실제 날짜 간격 그대로(주말 빈칸 포함) 놓는다.
 * @param {[string, number][]} points
 * @param {{ w: number, h: number, left: number, right: number, top: number, bottom: number }} box
 */
export function geometry(points, box) {
  const t = points.map((p) => Date.parse(p[0] + 'T00:00:00Z'));
  const t0 = t[0], t1 = t[t.length - 1] || t0 + 1;
  const vals = points.map((p) => p[1]);
  const y = niceTicks(Math.min(...vals), Math.max(...vals));
  const W = box.w - box.left - box.right, H = box.h - box.top - box.bottom;
  const sx = (ti) => box.left + (t1 === t0 ? W / 2 : ((ti - t0) / (t1 - t0)) * W);
  const sy = (v) => box.top + H - ((v - y.lo) / (y.hi - y.lo)) * H;
  const xs = t.map(sx), ys = vals.map(sy);
  const path = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join('');
  return { xs, ys, path, yTicks: y.ticks.map((v) => ({ v, y: sy(v) })), xTicks: xTicks(points[0][0], points[points.length - 1][0]).map((d) => ({ d, x: sx(Date.parse(d + 'T00:00:00Z')) })) };
}

/** 가로축 눈금: 기간에 맞춰 월초(또는 연초) 날짜 4~6개 */
export function xTicks(from, to) {
  const days = (Date.parse(to) - Date.parse(from)) / 86400e3;
  const stepMonths = days > 1500 ? 12 : days > 700 ? 6 : days > 300 ? 3 : days > 120 ? 1 : 0;
  const out = [];
  if (stepMonths === 0) {
    const step = Math.max(1, Math.round(days / 4));
    for (let d = addDays(from, Math.round(step / 2)); d < to; d = addDays(d, step)) out.push(d);
    return out;
  }
  let [y, m] = from.split('-').map(Number);
  m += 1; // 다음 달 1일부터
  for (;;) {
    if (m > 12) { y++; m -= 12; }
    const d = `${y}-${String(m).padStart(2, '0')}-01`;
    if (d > to) break;
    // 긴 기간은 연도 눈금도 2년·5년 간격으로 (글씨가 겹치지 않게)
    const yearStep = days > 7000 ? 5 : days > 3500 ? 2 : 1;
    if (stepMonths < 12 || (m === 1 && y % yearStep === 0)) out.push(d);
    m += stepMonths === 12 ? 1 : stepMonths;
  }
  return out;
}

/** 가장 가까운 점 (xs는 오름차순) */
export function nearest(xs, x) {
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] < x) lo = mid; else hi = mid; }
  return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
}

const getJson = (fetchFn, url) => fetchFn(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
export const loadDay = (date, fetchFn = globalThis.fetch) => getJson(fetchFn, `/api/rates/day?date=${encodeURIComponent(date)}`);
export function loadHistory(code, from, fetchFn = globalThis.fetch) {
  const q = new URLSearchParams({ code });
  if (from) q.set('from', from);
  return getJson(fetchFn, `/api/rates/history?${q}`);
}
