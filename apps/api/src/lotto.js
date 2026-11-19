// 로또 6/45 당첨번호 수집·저장 (D1 lotto 테이블 + KV 요약본).
// 출처: 동행복권 홈페이지의 지난 회차 조회 주소(공식 공개 API 아님 → 바뀌면 여기만 고치면 된다).
//  - srchDir=latest&srchCursorLtEpsd=N : N회 다음 회차들(최대 10개)
//  - srchDir=older&srchCursorLtEpsd=N  : N회 이전 회차들(최대 10개)
// 추첨은 매주 토요일 저녁. 저장된 마지막 회차가 "지금쯤 나왔어야 할 회차"보다 작을 때만 부른다.

export const LOTTO_URL = 'https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do';
export const LOTTO_KV = 'lotto:all';
const FIRST_DRAW = Date.parse('2002-12-07T12:00:00Z'); // 1회 추첨일 21:00 KST (결과가 올라오는 시각 여유)
const WEEK = 7 * 86400e3;

export const LOTTO_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS lotto (
    round INTEGER PRIMARY KEY, date TEXT NOT NULL,
    n1 INTEGER NOT NULL, n2 INTEGER NOT NULL, n3 INTEGER NOT NULL, n4 INTEGER NOT NULL, n5 INTEGER NOT NULL, n6 INTEGER NOT NULL, bonus INTEGER NOT NULL,
    w1_count INTEGER, w1_amount INTEGER, w2_count INTEGER, w2_amount INTEGER, w3_count INTEGER, w3_amount INTEGER,
    w4_count INTEGER, w4_amount INTEGER, w5_count INTEGER, w5_amount INTEGER, sales INTEGER
  )`,
];

/** 지금(ms)까지 결과가 나왔어야 할 마지막 회차 */
export const expectedRound = (now = Date.now()) => Math.max(0, Math.floor((now - FIRST_DRAW) / WEEK) + 1);

const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null);

/** 동행복권 항목 → 저장용 (이상하면 null) */
export function parseRound(x) {
  const round = int(x?.ltEpsd);
  const ymd = String(x?.ltRflYmd ?? '');
  const nums = [x?.tm1WnNo, x?.tm2WnNo, x?.tm3WnNo, x?.tm4WnNo, x?.tm5WnNo, x?.tm6WnNo].map(int);
  const bonus = int(x?.bnsWnNo);
  const okNum = (n) => n !== null && n >= 1 && n <= 45;
  if (!(round > 0) || !/^\d{8}$/.test(ymd) || !nums.every(okNum) || !okNum(bonus)) return null;
  if (new Set([...nums, bonus]).size !== 7) return null;
  return {
    round, date: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6)}`,
    nums: [...nums].sort((a, b) => a - b), bonus,
    prizes: [1, 2, 3, 4, 5].map((k) => ({ count: int(x[`rnk${k}WnNope`]), amount: int(x[`rnk${k}WnAmt`]) })),
    sales: int(x?.rlvtEpsdSumNtslAmt),
  };
}

/** 회차 목록 받기 → { rounds } | { error } */
export async function fetchRounds({ fetch, dir, cursor }) {
  const url = `${LOTTO_URL}?srchDir=${dir}&srchCursorLtEpsd=${cursor}`;
  try {
    const res = await fetch(url, { headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' } });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { return { error: '응답이 JSON이 아니에요 (접속 차단이나 주소 변경 가능성)' }; }
    const list = body?.data?.list;
    if (!Array.isArray(list)) return { error: '응답 형식이 달라요' };
    const rounds = list.map(parseRound).filter(Boolean).sort((a, b) => a.round - b.round);
    return { rounds };
  } catch (e) {
    return { error: '요청 실패: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

export async function saveRounds(db, rounds) {
  if (!rounds.length) return;
  const stmt = db.prepare(`INSERT OR REPLACE INTO lotto (round, date, n1, n2, n3, n4, n5, n6, bonus,
    w1_count, w1_amount, w2_count, w2_amount, w3_count, w3_amount, w4_count, w4_amount, w5_count, w5_amount, sales)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  await db.batch(rounds.map((r) => stmt.bind(r.round, r.date, ...r.nums, r.bonus, ...r.prizes.flatMap((p) => [p.count, p.amount]), r.sales)));
}

/**
 * 비어 있는 회차를 채운다 (처음엔 1회부터, 이후엔 매주 새 회차만).
 * @param {{ db: any, kv: any, fetch: any, now?: number, maxPages?: number }} p
 */
// 처음 채울 때(1~최신 회차)는 여러 번에 나눠 받는다. 다 따라잡기 전에는 요약본을 만들지 않는다
// (중간에 만들면 "300회"가 최신 회차처럼 보이므로).
export async function syncLotto({ db, kv, fetch, now = Date.now(), maxPages = 40 }) {
  const expected = expectedRound(now);
  const row = await db.prepare('SELECT MAX(round) AS m FROM lotto').first();
  let max = row?.m ?? 0;
  if (max >= expected) return { saved: 0, max, expected };
  let saved = 0;
  let caughtUp = false;
  for (let page = 0; page < maxPages && max < expected; page++) {
    // 1회는 "다음 회차" 조회로 안 나와서, 처음에만 "11회 이전"으로 1~10회를 받는다
    const r = max === 0 ? await fetchRounds({ fetch, dir: 'older', cursor: 11 }) : await fetchRounds({ fetch, dir: 'latest', cursor: max });
    if ('error' in r) return { saved, max, expected, error: r.error };
    const fresh = r.rounds.filter((x) => x.round > max);
    if (!fresh.length) { caughtUp = true; break; } // 더 받을 회차 없음 (최신 결과가 아직 안 올라옴)
    await saveRounds(db, fresh);
    saved += fresh.length;
    max = fresh[fresh.length - 1].round;
  }
  if (max >= expected) caughtUp = true;
  // 다 따라잡았으면 요약본 갱신 (이전 실행에서 저장만 하고 못 만든 경우도 포함)
  if (caughtUp && (saved || !(await kv.get(LOTTO_KV)))) await rebuildBlob(db, kv);
  return { saved, max, expected, caughtUp };
}

/** 화면용 요약본: 전체 회차 번호 + 최신 회차 상세. KV에 넣어 두고 /api/lotto 가 그대로 돌려준다 */
export async function rebuildBlob(db, kv) {
  const { results } = await db.prepare('SELECT round, date, n1, n2, n3, n4, n5, n6, bonus FROM lotto ORDER BY round').all();
  const latest = await roundDetail(db, results.length ? results[results.length - 1].round : 0);
  const blob = {
    updatedAt: new Date().toISOString(),
    latest,
    rounds: results.map((r) => [r.round, r.date, r.n1, r.n2, r.n3, r.n4, r.n5, r.n6, r.bonus]),
  };
  await kv.put(LOTTO_KV, JSON.stringify(blob));
  return blob;
}

/** 한 회차 상세 (당첨금 포함) */
export async function roundDetail(db, round) {
  const r = await db.prepare('SELECT * FROM lotto WHERE round = ?').bind(round).first();
  if (!r) return null;
  return {
    round: r.round, date: r.date, nums: [r.n1, r.n2, r.n3, r.n4, r.n5, r.n6], bonus: r.bonus, sales: r.sales,
    prizes: [1, 2, 3, 4, 5].map((k) => ({ rank: k, count: r[`w${k}_count`], amount: r[`w${k}_amount`] })),
  };
}
