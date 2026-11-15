// 만 나이 계산 로직. DOM과 분리해서 tests/에서 node --test로 검증한다.
// 규칙: 생일이 지났으면 (기준연도 - 출생연도), 아직이면 1을 뺀다.
// 2월 29일생은 평년에 3월 1일이 되어야 한 살을 더 먹는 것으로 본다(민법상 기간 계산 관행).

/** 'YYYY-MM-DD' → {y, m, d}. 형식이 틀리면 null */
export function parseDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str ?? '');
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** 기준일에 생일이 지났는지(당일 포함) */
function birthdayPassed(birth, ref) {
  let bm = birth.m, bd = birth.d;
  if (bm === 2 && bd === 29 && !isLeap(ref.y)) { bm = 3; bd = 1; }
  return ref.m > bm || (ref.m === bm && ref.d >= bd);
}

/**
 * @returns {{ manAge:number, yearAge:number, nextBirthday:string, daysToNext:number, daysLived:number } | { error:string }}
 */
export function calcAge(birthStr, refStr) {
  const b = parseDate(birthStr);
  const r = parseDate(refStr);
  if (!b) return { error: '생년월일을 올바르게 입력해 주세요.' };
  if (!r) return { error: '기준일을 올바르게 입력해 주세요.' };
  const bt = Date.UTC(b.y, b.m - 1, b.d);
  const rt = Date.UTC(r.y, r.m - 1, r.d);
  if (bt > rt) return { error: '생년월일이 기준일보다 늦어요.' };

  const manAge = r.y - b.y - (birthdayPassed(b, r) ? 0 : 1);
  const yearAge = r.y - b.y; // 연 나이: 병역법·청소년보호법 등에서 사용

  // 다음 생일
  let ny = birthdayPassed(b, r) ? r.y + 1 : r.y;
  let nm = b.m, nd = b.d;
  if (nm === 2 && nd === 29 && !isLeap(ny)) { nm = 3; nd = 1; }
  // 오늘이 생일이면 다음 생일은 내년
  if (r.m === nm && r.d === nd && ny === r.y) ny += 1;
  const nt = Date.UTC(ny, nm - 1, nd);
  const DAY = 86400000;

  return {
    manAge,
    yearAge,
    nextBirthday: `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`,
    daysToNext: Math.round((nt - rt) / DAY),
    daysLived: Math.round((rt - bt) / DAY),
  };
}

/** 오늘 날짜를 한국 시간 기준 'YYYY-MM-DD'로 */
export function todayKST(now = new Date()) {
  const k = new Date(now.getTime() + 9 * 3600000);
  return k.toISOString().slice(0, 10);
}
