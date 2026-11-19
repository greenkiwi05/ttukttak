// 로또 당첨번호 조회·통계 로직. 데이터는 /api/lotto (동행복권 회차별 당첨번호를 Worker가 모아 둔 것)
// 통계는 지난 기록일 뿐이고, 다음 추첨 확률에는 영향이 없다 (모든 조합의 확률은 같다).

/** /api/lotto 응답 → [{ round, date, nums, bonus }] (날짜순). 이상하면 null */
export function parseBlob(blob) {
  if (!blob || !Array.isArray(blob.rounds) || !blob.rounds.length) return null;
  const rounds = [];
  for (const r of blob.rounds) {
    if (!Array.isArray(r) || r.length < 9) continue;
    rounds.push({ round: r[0], date: r[1], nums: r.slice(2, 8), bonus: r[8] });
  }
  rounds.sort((a, b) => a.round - b.round);
  return rounds.length ? rounds : null;
}

/** 번호별 출현 횟수 (인덱스 1~45) */
export function frequency(rounds, { bonus = false } = {}) {
  const c = new Array(46).fill(0);
  for (const r of rounds) {
    for (const n of r.nums) c[n]++;
    if (bonus) c[r.bonus]++;
  }
  return c;
}

/** 번호별로 마지막으로 나온 뒤 몇 회째 안 나왔는지 (인덱스 1~45, 0 = 최근 회차에 나옴). 한 번도 없으면 rounds.length */
export function gaps(rounds) {
  const g = new Array(46).fill(rounds.length);
  for (let i = rounds.length - 1; i >= 0; i--) {
    const ago = rounds.length - 1 - i;
    for (const n of rounds[i].nums) if (g[n] === rounds.length) g[n] = ago;
  }
  return g;
}

/** 값 큰 순(같으면 번호 작은 순) 상위 k개 번호 */
export function topBy(arr, k, dir = 'desc') {
  const nums = Array.from({ length: 45 }, (_, i) => i + 1);
  nums.sort((a, b) => (dir === 'desc' ? arr[b] - arr[a] : arr[a] - arr[b]) || a - b);
  return nums.slice(0, k);
}

/** 홀짝 비율 분포 { '3:3': 횟수, ... } (홀:짝) */
export function oddEven(rounds) {
  const out = {};
  for (const r of rounds) {
    const odd = r.nums.filter((n) => n % 2).length;
    const k = `${odd}:${6 - odd}`;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/** 번호 구간(1~10, 11~20, …, 41~45)별 출현 횟수 */
export function bands(rounds) {
  const out = [0, 0, 0, 0, 0];
  for (const r of rounds) for (const n of r.nums) out[n <= 10 ? 0 : n <= 20 ? 1 : n <= 30 ? 2 : n <= 40 ? 3 : 4]++;
  return out;
}

/**
 * 내 번호 등수 (6개 일치 1등, 5개+보너스 2등, 5개 3등, 4개 4등, 3개 5등, 그 외 null)
 * @param {{ nums: number[], bonus: number }} round
 * @param {number[]} picks
 */
export function rankOf(round, picks) {
  const set = new Set(round.nums);
  const hit = picks.filter((n) => set.has(n)).length;
  if (hit === 6) return 1;
  if (hit === 5) return picks.includes(round.bonus) ? 2 : 3;
  if (hit === 4) return 4;
  if (hit === 3) return 5;
  return null;
}

/** 모든 회차에서 내 번호 결과 { counts: [_,1등,…,5등], best: [{ round, date, rank }] } */
export function checkAll(rounds, picks) {
  const counts = [0, 0, 0, 0, 0, 0];
  const hits = [];
  for (const r of rounds) {
    const k = rankOf(r, picks);
    if (k) { counts[k]++; hits.push({ round: r.round, date: r.date, rank: k }); }
  }
  hits.sort((a, b) => a.rank - b.rank || b.round - a.round);
  return { counts, best: hits.slice(0, 10) };
}

/** "1, 5 18-23" 같은 입력 → 정렬된 번호 (1~45, 중복 제거) + 오류 */
export function parsePicks(s) {
  const raw = String(s ?? '').split(/[^\d]+/).filter(Boolean).map(Number);
  if (raw.some((n) => n < 1 || n > 45)) return { error: '1부터 45 사이 번호만 넣어 주세요.' };
  const nums = [...new Set(raw)].sort((a, b) => a - b);
  if (nums.length !== raw.length) return { error: '같은 번호가 두 번 들어갔어요.' };
  if (nums.length !== 6) return { error: `번호 6개를 넣어 주세요. (지금 ${nums.length}개)` };
  return { nums };
}

/** 금액 → "31억 316만 4,459원" 식 한국어 */
export function wonKo(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '-';
  if (n < 10000) return n.toLocaleString('ko-KR') + '원';
  const eok = Math.floor(n / 1e8), man = Math.floor((n % 1e8) / 1e4), rest = n % 1e4;
  return [eok ? `${eok.toLocaleString('ko-KR')}억` : '', man ? `${man.toLocaleString('ko-KR')}만` : '', rest ? rest.toLocaleString('ko-KR') : ''].filter(Boolean).join(' ') + '원';
}

/** 통계 기간: 최근 n회 (0 = 전체) */
export const lastN = (rounds, n) => (n ? rounds.slice(-n) : rounds);

let pending = null;
/** /api/lotto 한 번만 불러서 같이 쓴다 (실패하면 null) */
export function loadLotto(fetchFn = globalThis.fetch) {
  pending ??= fetchFn('/api/lotto')
    .then((r) => (r.ok ? r.json() : null))
    .then((b) => (b && parseBlob(b) ? { rounds: parseBlob(b), latest: b.latest ?? null } : null))
    .catch(() => null)
    .then((d) => { if (!d) pending = null; return d; });
  return pending;
}

export const loadRound = (n, fetchFn = globalThis.fetch) =>
  fetchFn(`/api/lotto/round?n=${encodeURIComponent(n)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
