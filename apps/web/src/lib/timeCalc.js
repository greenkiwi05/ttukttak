// 시간 계산기 (순수 로직). 모든 계산은 초 단위 정수.
//  - 시간(기간) 입력: '1:30'(1시간 30분), '1:30:15', '1시간 30분 15초', '90분', '45초', '1.5시간', 숫자만 쓰면 '분'
//  - 시각 입력: workHours.js의 parseTime ('0930', '9:30', '21시 5분')
import { parseTime } from './workHours.js';

/** 기간 문자열 → 초 (앞에 '-'를 붙이면 빼기). 해석 불가면 null */
export function parseDuration(str) {
  let s = String(str ?? '').trim().replace(/\s+/g, '');
  if (!s) return null;
  let sign = 1;
  if (s[0] === '-' || s[0] === '−') { sign = -1; s = s.slice(1); }
  else if (s[0] === '+') s = s.slice(1);
  let sec = null;
  let m;
  if ((m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s))) {
    if (+m[2] > 59 || (m[3] && +m[3] > 59)) return null;
    sec = +m[1] * 3600 + +m[2] * 60 + (m[3] ? +m[3] : 0);
  } else if ((m = /^(?:(\d+(?:\.\d+)?)(?:시간|h))?(?:(\d+(?:\.\d+)?)(?:분|m|min))?(?:(\d+(?:\.\d+)?)(?:초|s|sec))?$/i.exec(s)) && (m[1] || m[2] || m[3])) {
    sec = Math.round((+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)));
  } else if (/^\d+(?:\.\d+)?$/.test(s)) {
    sec = Math.round(+s * 60); // 숫자만 쓰면 분
  } else return null;
  return sign * sec;
}

/** 초 → '2시간 15분 30초' (0인 부분 생략, 음수는 앞에 '-') */
export function fmtHMS(sec) {
  const neg = sec < 0;
  let s = Math.abs(Math.round(sec));
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60), r = s % 60;
  const parts = [];
  if (h) parts.push(`${h}시간`);
  if (m) parts.push(`${m}분`);
  if (r || !parts.length) parts.push(`${r}초`);
  return (neg ? '-' : '') + parts.join(' ');
}

/** 초 → 'H:MM' 또는 'H:MM:SS' */
export function fmtColon(sec) {
  const neg = sec < 0;
  let s = Math.abs(Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (neg ? '-' : '') + `${h}:${String(m).padStart(2, '0')}` + (r ? `:${String(r).padStart(2, '0')}` : '');
}

/**
 * 기준 시각 ± 기간 → 결과 시각과 날짜 이동
 * @returns {{ time:string, dayOffset:number } | { error:string }}
 */
export function addToClock(clockStr, deltaSec) {
  const c = parseTime(clockStr);
  if (c === null) return { error: '기준 시각을 확인해 주세요. 예: 09:30' };
  if (deltaSec === null || deltaSec === undefined || Number.isNaN(deltaSec)) return { error: '더하거나 뺄 시간을 확인해 주세요. 예: 1:30, 90분' };
  const total = c * 60 + deltaSec;
  const day = 86400;
  const dayOffset = Math.floor(total / day);
  const t = ((total % day) + day) % day;
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return { time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` + (s ? `:${String(s).padStart(2, '0')}` : ''), dayOffset };
}

/** 두 시각 사이 (끝이 시작보다 이르면 다음 날로 본다) */
export function clockDiff(startStr, endStr) {
  const s = parseTime(startStr), e = parseTime(endStr);
  if (s === null) return { error: '시작 시각을 확인해 주세요. 예: 09:30' };
  if (e === null) return { error: '끝 시각을 확인해 주세요. 예: 18:00' };
  const overnight = e < s;
  return { sec: ((overnight ? e + 1440 : e) - s) * 60, overnight };
}

/** 여러 기간 합계. 줄마다 하나씩, '-'로 시작하면 뺀다 */
export function sumDurations(text) {
  const lines = String(text ?? '').split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
  let total = 0;
  const bad = [];
  for (const l of lines) {
    const v = parseDuration(l);
    if (v === null) bad.push(l); else total += v;
  }
  return { total, count: lines.length - bad.length, bad };
}
