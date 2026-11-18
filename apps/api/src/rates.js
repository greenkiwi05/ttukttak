// 환율 데이터: 한국수출입은행 현재환율 API(AP01)를 받아 사이트에서 쓰는 모양으로 정리한다.
// 순수 함수만 둔다 (fetch는 인자로 받아 테스트에서 바꿔 끼운다).

export const EXIM_URL = 'https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON';

/** "1,385.5" → 1385.5 (빈 값·이상한 값은 NaN) */
export const toNum = (s) => {
  const t = String(s ?? '').replace(/,/g, '').trim();
  return t === '' ? NaN : Number(t);
};

/** 한국 시각 기준 날짜 'YYYY-MM-DD' (offsetDays일 전) */
export function kstDate(now = Date.now(), offsetDays = 0) {
  return new Date(now + 9 * 3600e3 - offsetDays * 86400e3).toISOString().slice(0, 10);
}

const EXIM_ERRORS = { 2: '데이터 코드 오류', 3: '인증키 오류', 4: '하루 호출 한도 초과' };

/**
 * 수출입은행 응답 배열 → { rates } | { empty } | { error }
 * 항목: cur_unit("USD", "JPY(100)"), cur_nm, deal_bas_r(매매기준율), tts(송금 보낼 때), ttb(송금 받을 때), result(1=성공)
 * 주말·공휴일·고시 전(보통 오전 11시 전)에는 빈 배열이 온다.
 */
export function parseExim(json) {
  if (!Array.isArray(json)) return { error: '응답 형식이 달라요' };
  if (json.length === 0) return { empty: true };
  const code = Number(json[0]?.result);
  if (code !== 1) return { error: EXIM_ERRORS[code] || `오류 코드 ${code}` };
  const rates = [];
  for (const r of json) {
    const m = String(r.cur_unit ?? '').match(/^([A-Z]{3})(?:\((\d+)\))?$/);
    if (!m || m[1] === 'KRW') continue;
    const base = toNum(r.deal_bas_r);
    if (!(base > 0)) continue;
    rates.push({
      code: m[1],
      unit: m[2] ? Number(m[2]) : 1,
      name: String(r.cur_nm ?? '').trim(),
      base,
      send: toNum(r.tts) || null,
      receive: toNum(r.ttb) || null,
    });
  }
  return rates.length ? { rates } : { error: '환율 항목이 없어요' };
}

/**
 * 가장 최근 고시일의 환율을 찾는다 (오늘부터 최대 10일 전까지 거슬러 올라감).
 * @param {{ key: string, fetch: (url: string, init?: any) => Promise<any>, now?: number }} p
 */
export async function fetchLatest({ key, fetch, now = Date.now() }) {
  if (!key) return { error: 'API 키가 없어요 (EXIM_KEY)' };
  for (let d = 0; d <= 10; d++) {
    const date = kstDate(now, d);
    const url = `${EXIM_URL}?authkey=${encodeURIComponent(key)}&searchdate=${date.replace(/-/g, '')}&data=AP01`;
    let body;
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      body = await res.json();
    } catch (e) {
      return { error: '요청 실패: ' + (e instanceof Error ? e.message : String(e)) };
    }
    const r = parseExim(body);
    if ('error' in r) return r;
    if ('rates' in r) return { date, rates: r.rates };
  }
  return { error: '최근 10일 동안 고시된 환율이 없어요' };
}

/**
 * 저장된 값과 새 값을 합친다. 고시일이 바뀌면 이전 값을 prev(전일 대비용)로 남긴다.
 * @param {any} saved  KV에 있던 값 (없으면 null)
 * @param {{ date: string, rates: any[] }} fresh
 */
export function merge(saved, fresh, fetchedAt = new Date().toISOString()) {
  if (saved?.date && saved.date > fresh.date) return saved; // 더 오래된 값으로 덮어쓰지 않음
  const toMap = (rates) => Object.fromEntries(rates.map((r) => [r.code, r.base]));
  const prev = saved?.date && saved.date < fresh.date ? { date: saved.date, base: toMap(saved.rates) } : (saved?.prev ?? null);
  return { source: '한국수출입은행', date: fresh.date, fetchedAt, rates: fresh.rates, prev };
}
