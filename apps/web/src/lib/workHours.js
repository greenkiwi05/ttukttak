// 근무시간 계산. 출근·퇴근 시각과 휴게시간(분)으로 실제 일한 시간을 구한다.
// 퇴근 시각이 출근보다 이르면 다음 날 퇴근(야간 근무)으로 본다.
// 연장·야간·휴일 가산이나 주휴수당은 법 기준이 얽혀 있어 계산하지 않는다 (AGENTS.md 원칙 2).

/** '9', '930', '0930', '9:30', '21:5', '9시 30분' → 분(0~1439). 해석 불가면 null */
export function parseTime(str) {
  const s = String(str ?? '').trim();
  if (!s) return null;
  let h, m;
  const parts = s.split(/[^\d]+/).filter(Boolean);
  if (parts.length >= 2) { h = +parts[0]; m = +parts[1]; }
  else if (parts.length === 1) {
    const t = parts[0];
    if (t.length <= 2) { h = +t; m = 0; }
    else if (t.length === 3) { h = +t.slice(0, 1); m = +t.slice(1); }
    else if (t.length === 4) { h = +t.slice(0, 2); m = +t.slice(2); }
    else return null;
  } else return null;
  if (h === 24 && m === 0) return 24 * 60;
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export const fmtTime = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** 분 → '8시간 30분' */
export function fmtDuration(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h && m ? `${h}시간 ${m}분` : h ? `${h}시간` : `${m}분`;
}

/**
 * @param {{ start:string, end:string, breakMin?:number }} row
 * @returns {{ minutes:number, span:number, overnight:boolean } | { error:string }}
 */
export function workMinutes({ start, end, breakMin = 0 }) {
  const s = parseTime(start), e = parseTime(end);
  if (s === null) return { error: '출근 시각을 확인해 주세요. 예: 09:00' };
  if (e === null) return { error: '퇴근 시각을 확인해 주세요. 예: 18:00' };
  const overnight = e <= s;
  const span = overnight ? e + 1440 - s : e - s;
  const b = Number(breakMin) || 0;
  if (b < 0) return { error: '휴게시간을 확인해 주세요.' };
  if (b >= span) return { error: '휴게시간이 근무시간보다 길어요.' };
  return { minutes: span - b, span, overnight };
}

/** 여러 날 합계와 (선택) 시급 × 시간 */
export function sumWeek(rows, hourlyWage = 0) {
  let total = 0, days = 0;
  for (const r of rows) {
    if (!r.start && !r.end) continue;
    const w = workMinutes(r);
    if ('error' in w) continue;
    total += w.minutes; days++;
  }
  return { total, days, pay: hourlyWage > 0 ? Math.round((total / 60) * hourlyWage) : 0 };
}
