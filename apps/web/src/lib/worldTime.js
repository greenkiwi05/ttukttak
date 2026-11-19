// 세계 시간·시차 계산 (순수 로직). 시차·서머타임은 브라우저/Node에 들어 있는 IANA 시간대 정보(Intl)를 쓴다.
// 도시 → 시간대 이름만 둔다 (시차 숫자를 하드코딩하지 않음).

export const CITIES = [
  { id: 'seoul', name: '서울', country: '한국', tz: 'Asia/Seoul' },
  { id: 'tokyo', name: '도쿄', country: '일본', tz: 'Asia/Tokyo' },
  { id: 'beijing', name: '베이징·상하이', country: '중국', tz: 'Asia/Shanghai' },
  { id: 'taipei', name: '타이베이', country: '대만', tz: 'Asia/Taipei' },
  { id: 'hongkong', name: '홍콩', country: '홍콩', tz: 'Asia/Hong_Kong' },
  { id: 'manila', name: '마닐라·세부', country: '필리핀', tz: 'Asia/Manila' },
  { id: 'hanoi', name: '하노이·다낭', country: '베트남', tz: 'Asia/Ho_Chi_Minh' },
  { id: 'bangkok', name: '방콕', country: '태국', tz: 'Asia/Bangkok' },
  { id: 'singapore', name: '싱가포르', country: '싱가포르', tz: 'Asia/Singapore' },
  { id: 'bali', name: '발리', country: '인도네시아', tz: 'Asia/Makassar' },
  { id: 'jakarta', name: '자카르타', country: '인도네시아', tz: 'Asia/Jakarta' },
  { id: 'delhi', name: '뉴델리·뭄바이', country: '인도', tz: 'Asia/Kolkata' },
  { id: 'dubai', name: '두바이', country: '아랍에미리트', tz: 'Asia/Dubai' },
  { id: 'istanbul', name: '이스탄불', country: '튀르키예', tz: 'Europe/Istanbul' },
  { id: 'moscow', name: '모스크바', country: '러시아', tz: 'Europe/Moscow' },
  { id: 'vladivostok', name: '블라디보스토크', country: '러시아', tz: 'Asia/Vladivostok' },
  { id: 'ulaanbaatar', name: '울란바토르', country: '몽골', tz: 'Asia/Ulaanbaatar' },
  { id: 'london', name: '런던', country: '영국', tz: 'Europe/London' },
  { id: 'paris', name: '파리', country: '프랑스', tz: 'Europe/Paris' },
  { id: 'berlin', name: '베를린', country: '독일', tz: 'Europe/Berlin' },
  { id: 'rome', name: '로마', country: '이탈리아', tz: 'Europe/Rome' },
  { id: 'madrid', name: '마드리드·바르셀로나', country: '스페인', tz: 'Europe/Madrid' },
  { id: 'prague', name: '프라하', country: '체코', tz: 'Europe/Prague' },
  { id: 'newyork', name: '뉴욕·워싱턴', country: '미국 동부', tz: 'America/New_York' },
  { id: 'chicago', name: '시카고', country: '미국 중부', tz: 'America/Chicago' },
  { id: 'denver', name: '덴버', country: '미국 산악', tz: 'America/Denver' },
  { id: 'la', name: 'LA·샌프란시스코·시애틀', country: '미국 서부', tz: 'America/Los_Angeles' },
  { id: 'honolulu', name: '하와이', country: '미국', tz: 'Pacific/Honolulu' },
  { id: 'guam', name: '괌·사이판', country: '미국령', tz: 'Pacific/Guam' },
  { id: 'toronto', name: '토론토', country: '캐나다 동부', tz: 'America/Toronto' },
  { id: 'vancouver', name: '밴쿠버', country: '캐나다 서부', tz: 'America/Vancouver' },
  { id: 'mexico', name: '멕시코시티', country: '멕시코', tz: 'America/Mexico_City' },
  { id: 'saopaulo', name: '상파울루', country: '브라질', tz: 'America/Sao_Paulo' },
  { id: 'sydney', name: '시드니·멜버른', country: '호주', tz: 'Australia/Sydney' },
  { id: 'auckland', name: '오클랜드', country: '뉴질랜드', tz: 'Pacific/Auckland' },
  { id: 'cairo', name: '카이로', country: '이집트', tz: 'Africa/Cairo' },
];
export const DEFAULT_CITIES = ['seoul', 'newyork', 'la', 'london', 'paris', 'tokyo'];
export const cityById = (id) => CITIES.find((c) => c.id === id);

const fmtCache = new Map();
function parts(tz, ms) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
    fmtCache.set(tz, f);
  }
  const o = {};
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday) };
}

/** 그 순간 tz의 UTC 대비 시차(분) */
export function offsetMinutes(tz, ms) {
  const p = parts(tz, ms);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** tz의 현지 시각(연·월·일·시·분) → 실제 순간(ms). 서머타임 경계에서도 맞도록 두 번 보정 */
export function zonedToUtc({ y, m, d, h, mi }, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let ms = guess - offsetMinutes(tz, guess) * 60000;
  ms = guess - offsetMinutes(tz, ms) * 60000;
  return ms;
}

/** 그 순간 tz의 현지 시각 정보 */
export function localInfo(tz, ms) {
  const p = parts(tz, ms);
  return { ...p, offset: offsetMinutes(tz, ms) };
}

/** 기준 도시 대비 시차 문구: "서울보다 14시간 느려요" */
export function diffLabel(minutes, baseName = '서울') {
  if (minutes === 0) return `${baseName}과 같아요`;
  const a = Math.abs(minutes), h = Math.floor(a / 60), m = a % 60;
  const t = [h ? `${h}시간` : '', m ? `${m}분` : ''].filter(Boolean).join(' ');
  return `${baseName}보다 ${t} ${minutes > 0 ? '빨라요' : '느려요'}`;
}

/** UTC 시차 표기: UTC+9, UTC-4, UTC+5:30 */
export function utcLabel(offset) {
  const s = offset < 0 ? '-' : '+', a = Math.abs(offset);
  return `UTC${s}${Math.floor(a / 60)}${a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''}`;
}

/** 서머타임 중인지 (1월·7월 시차 중 큰 쪽이면 서머타임) */
export function isDst(tz, ms) {
  const y = parts(tz, ms).y;
  const jan = offsetMinutes(tz, Date.UTC(y, 0, 1)), jul = offsetMinutes(tz, Date.UTC(y, 6, 1));
  return jan !== jul && offsetMinutes(tz, ms) === Math.max(jan, jul);
}

const WD = ['일', '월', '화', '수', '목', '금', '토'];
/** "11월 19일(목) 오후 3:05" + 기준 날짜와 다르면 "(하루 전)" 같은 표시 */
export function fmtLocal(info, baseInfo) {
  const ap = info.h < 12 ? '오전' : '오후';
  const hh = info.h % 12 === 0 ? 12 : info.h % 12;
  let dayNote = '';
  if (baseInfo) {
    const a = Date.UTC(info.y, info.m - 1, info.d), b = Date.UTC(baseInfo.y, baseInfo.m - 1, baseInfo.d);
    const dd = Math.round((a - b) / 86400e3);
    dayNote = dd === -1 ? '전날' : dd === 1 ? '다음 날' : dd ? `${dd > 0 ? '+' : ''}${dd}일` : '';
  }
  return { date: `${info.m}월 ${info.d}일(${WD[info.wd]})`, time: `${ap} ${hh}:${String(info.mi).padStart(2, '0')}`, dayNote };
}

/** 업무 시간(9~18시)인지, 잠잘 시간(23~7시)인지 */
export function dayPart(h) {
  if (h >= 9 && h < 18) return 'work';
  if (h >= 23 || h < 7) return 'night';
  return 'free';
}
