// 환율 계산기 로직. 환율 값은 하드코딩하지 않고 /api/rates(한국수출입은행 고시, apps/api)에서 받는다.
// 받지 못하면 사용자가 직접 입력한 환율로 계산한다.

/** 화면에 먼저 보일 통화 순서 (나머지는 뒤에 그대로) */
export const POPULAR = ['USD', 'JPY', 'EUR', 'CNH', 'GBP', 'AUD', 'CAD', 'HKD', 'SGD', 'THB', 'IDR', 'CHF', 'NZD', 'MYR'];

export const FLAGS = {
  USD: '🇺🇸', JPY: '🇯🇵', EUR: '🇪🇺', CNH: '🇨🇳', GBP: '🇬🇧', AUD: '🇦🇺', CAD: '🇨🇦', HKD: '🇭🇰', SGD: '🇸🇬', THB: '🇹🇭',
  IDR: '🇮🇩', CHF: '🇨🇭', NZD: '🇳🇿', MYR: '🇲🇾', AED: '🇦🇪', SAR: '🇸🇦', KWD: '🇰🇼', BHD: '🇧🇭', BND: '🇧🇳', DKK: '🇩🇰', NOK: '🇳🇴', SEK: '🇸🇪',
};

/** 통화별로 자주 계산하는 금액 (없으면 기본값) */
const QUICK = { JPY: [1000, 5000, 10000, 50000], IDR: [10000, 50000, 100000, 1000000], THB: [100, 500, 1000, 5000] };
export const quickAmounts = (code) => QUICK[code] || [1, 10, 100, 1000];

/**
 * /api/rates 응답 검사 + 정렬. 이상하면 null.
 * @param {any} data
 * @returns {null | { date: string, source: string, rates: { code: string, unit: number, name: string, base: number, send: number|null, receive: number|null }[], prev: null | { date: string, base: Record<string, number> } }}
 */
export function normalize(data) {
  if (!data || typeof data.date !== 'string' || !Array.isArray(data.rates)) return null;
  const rates = data.rates.filter((r) => r && typeof r.code === 'string' && r.base > 0 && r.unit > 0);
  if (!rates.length) return null;
  const rank = (c) => { const i = POPULAR.indexOf(c); return i < 0 ? 99 : i; };
  rates.sort((a, b) => rank(a.code) - rank(b.code) || a.code.localeCompare(b.code));
  return { date: data.date, source: data.source || '한국수출입은행', rates, prev: data.prev ?? null };
}

/**
 * 금액 변환. rate는 unit(1 또는 100) 외화당 원화.
 * @param {{ amount: number, rate: number, unit: number, dir: 'toKrw' | 'fromKrw' }} p
 */
export function convert({ amount, rate, unit, dir }) {
  if (!(amount >= 0) || !Number.isFinite(amount)) return { error: '금액을 숫자로 입력해 주세요.' };
  if (!(rate > 0)) return { error: '환율을 입력해 주세요.' };
  if (dir === 'toKrw') return { value: Math.round((amount * rate) / unit) };
  return { value: Math.round(((amount * unit) / rate) * 100) / 100 };
}

/** 전일 대비 { diff, pct } (이전 값이 없으면 null) */
export function change(rate, prev) {
  const before = prev?.base?.[rate.code];
  if (!(before > 0)) return null;
  const diff = Math.round((rate.base - before) * 100) / 100;
  return { diff, pct: Math.round((diff / before) * 10000) / 100 };
}

/** 해외 결제 계산기 통화 → 수출입은행 통화 (위안화는 CNH로 고시) */
export const eximCode = (code) => (code === 'CNY' ? 'CNH' : code);

/**
 * 다른 단위로 환산한 환율 (예: 수출입은행 100엔 기준 → 1엔 기준)
 * @param {{ base: number, unit: number }} r
 */
export const rateFor = (r, unit) => Math.round(((r.base / r.unit) * unit) * 10000) / 10000;

/** "1,234.5" → 1234.5, 비었거나 숫자가 아니면 NaN */
export function num(s) {
  const t = String(s ?? '').replace(/,/g, '').trim();
  return t === '' || !/^\d*\.?\d+$/.test(t) ? NaN : Number(t);
}

let pending = null;
/** /api/rates 한 번만 불러서 같이 쓴다 (실패하면 null) */
export function loadRates(fetchFn = globalThis.fetch) {
  pending ??= fetchFn('/api/rates')
    .then((r) => (r.ok ? r.json() : null))
    .then(normalize)
    .catch(() => null)
    .then((d) => { if (!d) pending = null; return d; });
  return pending;
}
