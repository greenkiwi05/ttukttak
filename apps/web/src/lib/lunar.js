// 음력 ↔ 양력. 변환표는 korean-lunar-calendar(한국천문연구원 기준 데이터 내장, 오프라인)를 쓴다.
// 지원 범위: 양력 1000-02-13 ~ 2050-12-31, 음력 1000-01-01 ~ 2050-11-18.
import KoreanLunarCalendar from 'korean-lunar-calendar';

const pad = (n) => String(n).padStart(2, '0');
const fmt = (o) => `${o.year}-${pad(o.month)}-${pad(o.day)}`;

/** @returns {{ lunar:{year:number,month:number,day:number,leap:boolean}, gapja:string } | { error:string }} */
export function solarToLunar(y, m, d) {
  const c = new KoreanLunarCalendar();
  if (!c.setSolarDate(y, m, d)) return { error: '양력 1000년 2월 13일 ~ 2050년 12월 31일 사이 날짜를 넣어 주세요.' };
  const l = c.getLunarCalendar();
  return { lunar: { year: l.year, month: l.month, day: l.day, leap: !!l.intercalation }, gapja: gapjaYear(c) };
}

/** @returns {{ solar:string, gapja:string } | { error:string }} */
export function lunarToSolar(y, m, d, leap = false) {
  const c = new KoreanLunarCalendar();
  if (!c.setLunarDate(y, m, d, leap)) {
    if (leap) return { error: `${y}년에는 음력 윤${m}월이 없어요.` };
    if (d === 30) return { error: `${y}년 음력 ${m}월은 29일까지 있어요.` };
    return { error: '음력 1000년 1월 1일 ~ 2050년 11월 18일 사이 날짜를 넣어 주세요.' };
  }
  return { solar: fmt(c.getSolarCalendar()), gapja: gapjaYear(c) };
}

function gapjaYear(c) {
  const g = c.getKoreanGapja?.();
  return g && g.year ? g.year : '';
}

/**
 * 음력 생일(월·일) → 해마다의 양력 날짜.
 * 윤달 생일은 평달로, 그해 그 달에 30일이 없으면 29일로 계산한다 (흔히 쓰는 방식).
 * @returns {{ year:number, solar:string, note:string }[]}
 */
export function lunarBirthdays(month, day, leap, fromYear, count = 10) {
  const out = [];
  for (let y = fromYear; y < fromYear + count; y++) {
    let r = lunarToSolar(y, month, day, leap), note = '';
    if ('error' in r && leap) { r = lunarToSolar(y, month, day, false); note = '윤달 없음 → 평달'; }
    if ('error' in r && day === 30) { r = lunarToSolar(y, month, 29, false); note = (note ? note + ', ' : '') + '30일 없음 → 29일'; }
    if ('solar' in r) out.push({ year: y, solar: r.solar, note });
  }
  return out;
}
