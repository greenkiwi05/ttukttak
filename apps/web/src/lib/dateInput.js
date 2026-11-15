// 날짜 입력칸 공용 로직 (키보드 입력 해석 + 달력 칸 계산). 값은 항상 'YYYY-MM-DD'.
import { parseDate, daysInMonth } from './date.js';

const pad = (n) => String(n).padStart(2, '0');
export const toIso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/**
 * 사람이 친 날짜 문자열 → 'YYYY-MM-DD' (해석 불가면 null)
 *  - 숫자만: 19980510 (8자리), 980510 (6자리, 올해 기준 미래가 아니면 20xx, 미래면 19xx)
 *  - 구분자: 1998.5.10 / 1998-05-10 / 1998/5/10 / 1998 5 10 / 1998년 5월 10일
 */
export function parseDateInput(str, now = new Date()) {
  const s = String(str ?? '').trim();
  if (!s) return null;
  let y, m, d;
  let parts = s.split(/[^\d]+/).filter(Boolean);
  // 자동 점 찍기 때문에 980510이 '9805.10'처럼 보이는 경우: 숫자만 모아 6·8자리로 다시 본다
  if (parts.length === 2 && /^[\d.]+$/.test(s)) {
    const digits = parts.join('');
    if (digits.length === 6 || digits.length === 8) parts = [digits];
  }
  if (parts.length === 1) {
    const t = parts[0];
    if (t.length === 8) { y = +t.slice(0, 4); m = +t.slice(4, 6); d = +t.slice(6, 8); }
    else if (t.length === 6) {
      const yy = +t.slice(0, 2), cur = now.getFullYear() % 100;
      y = (yy > cur ? 1900 : 2000) + yy; m = +t.slice(2, 4); d = +t.slice(4, 6);
    } else return null;
  } else if (parts.length === 3) {
    [y, m, d] = parts.map(Number);
    if (parts[0].length === 2) { const cur = now.getFullYear() % 100; y = (y > cur ? 1900 : 2000) + y; }
    else if (parts[0].length !== 4) return null;
  } else return null;
  const iso = toIso(y, m, d);
  return parseDate(iso) ? iso : null;
}

/** 숫자만 치는 중이면 보기 좋게 점을 넣는다: '199805' → '1998.05' (구분자를 직접 치면 그대로 둔다) */
export function formatTyping(str) {
  const s = String(str ?? '');
  if (!/^\d*$/.test(s)) return s;
  const t = s.slice(0, 8);
  if (t.length <= 4) return t;
  if (t.length <= 6) return `${t.slice(0, 4)}.${t.slice(4)}`;
  return `${t.slice(0, 4)}.${t.slice(4, 6)}.${t.slice(6)}`;
}

/**
 * 입력칸에 친 그대로의 값 → 화면에 보여줄 값.
 * 자동 점 찍기 모양(1998 / 1998.0 / 1998.05.1 …)이면 점을 다시 계산하고,
 * 사용자가 직접 구분자를 넣은 모양(1998.5.10, 1998-05-10)은 건드리지 않는다.
 */
export function autoFormat(raw) {
  const s = String(raw ?? '');
  return /^\d+$|^\d{4}\.\d*$|^\d{4}\.\d{2}\.\d*$/.test(s) ? formatTyping(s.replace(/\./g, '')) : s;
}

/** 'YYYY-MM-DD' → 'YYYY.MM.DD' (입력칸 표시용) */
export const displayOf = (iso) => (iso && parseDate(iso) ? iso.replaceAll('-', '.') : '');

/** 달력 6주 × 7일 칸. 일요일 시작. [{ iso, day, inMonth }] */
export function monthGrid(y, m) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(Date.UTC(y, m - 1, 1 - first + i));
    cells.push({ iso: dt.toISOString().slice(0, 10), day: dt.getUTCDate(), inMonth: dt.getUTCMonth() === m - 1 });
  }
  return cells;
}

/** 월 이동 */
export function shiftMonth(y, m, delta) {
  const t = y * 12 + (m - 1) + delta;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
}

/** min~max 안에 있는지 (빈 값은 제한 없음) */
export const inRange = (iso, min, max) => (!min || iso >= min) && (!max || iso <= max);

export { daysInMonth };
