// 주유비 계산 로직. 유가·연비는 사용자 입력이 기본이고, /api/fuel(오피넷 평균 판매가)이 있으면 유가를 채워 준다.

// eff: 처음 보여 줄 예시 연비(km/L) — 흔한 승용차 기준의 대략적인 값. 사용자가 고치면 그 값을 쓴다
export const FUELS = [
  { code: 'B027', label: '휘발유', eff: 12 },
  { code: 'D047', label: '경유', eff: 14 },
  { code: 'K015', label: 'LPG', eff: 9 },
];
export const defaultEfficiency = (code) => FUELS.find((f) => f.code === code)?.eff ?? 12;

/**
 * @param {{ distance: number, efficiency: number, price: number, roundTrip?: boolean, people?: number }} p
 *   distance km, efficiency km/L, price 원/L
 */
export function fuelCost({ distance, efficiency, price, roundTrip = false, people = 1 }) {
  if (!(distance > 0)) return { error: '거리를 입력해 주세요.' };
  if (!(efficiency > 0)) return { error: '연비를 입력해 주세요.' };
  if (!(price > 0)) return { error: '기름값(1L 가격)을 입력해 주세요.' };
  if (!Number.isInteger(people) || people < 1 || people > 100) return { error: '인원은 1~100명으로 넣어 주세요.' };
  const km = distance * (roundTrip ? 2 : 1);
  const liters = km / efficiency;
  const cost = Math.round(liters * price);
  return { km, liters: Math.round(liters * 100) / 100, cost, perPerson: Math.ceil(cost / people / 10) * 10, perKm: Math.round((price / efficiency) * 10) / 10 };
}

/** 주유 금액으로 몇 L, 몇 km 갈 수 있는지 */
export function byAmount({ amount, price, efficiency }) {
  if (!(amount > 0)) return { error: '주유 금액을 입력해 주세요.' };
  if (!(price > 0)) return { error: '기름값(1L 가격)을 입력해 주세요.' };
  const liters = amount / price;
  return { liters: Math.round(liters * 100) / 100, km: efficiency > 0 ? Math.round(liters * efficiency * 10) / 10 : null };
}

/** /api/fuel 응답 검사 → { date, national: Map(code → { price, diff }), sido: { code: [...] } } | null */
export function normalizeFuel(d) {
  if (!d || !Array.isArray(d.national) || !d.national.length) return null;
  const national = new Map(d.national.filter((x) => x?.price > 0).map((x) => [x.code, { price: x.price, diff: x.diff ?? null }]));
  if (!national.size) return null;
  return { date: d.date ?? null, national, sido: d.sido && typeof d.sido === 'object' ? d.sido : {} };
}

/** "1,650.5" → 1650.5 */
export function num(s) {
  const t = String(s ?? '').replace(/,/g, '').trim();
  return t === '' || !/^\d*\.?\d+$/.test(t) ? NaN : Number(t);
}

let pending = null;
export function loadFuel(fetchFn = globalThis.fetch) {
  pending ??= fetchFn('/api/fuel')
    .then((r) => (r.ok ? r.json() : null))
    .then(normalizeFuel)
    .catch(() => null)
    .then((d) => { if (!d) pending = null; return d; });
  return pending;
}
