// 로또(6/45) 번호 생성. 1~45 중 서로 다른 6개, 오름차순.
// 꼭 넣을 번호(고정수)와 빼고 싶은 번호(제외수)를 지정할 수 있다. 어떤 조합이든 당첨 확률은 같다.

export const MAX = 45;
export const PICK = 6;

/** '3, 17 22' → [3, 17, 22] (1~45, 중복 제거) */
export const parseNums = (s) => [...new Set(String(s ?? '').split(/[^\d]+/).filter(Boolean).map(Number).filter((n) => n >= 1 && n <= MAX))].sort((a, b) => a - b);

/**
 * @param {{ count?:number, fixed?:number[], exclude?:number[], rand?:() => number }} o
 * @returns {{ sets:number[][] } | { error:string }}
 */
export function makeSets({ count = 5, fixed = [], exclude = [], rand = Math.random }) {
  const fx = [...new Set(fixed)], ex = new Set(exclude);
  if (fx.length > 5) return { error: '고정수는 5개까지 넣을 수 있어요.' };
  if (fx.some((n) => ex.has(n))) return { error: '같은 번호를 고정수와 제외수에 동시에 넣었어요.' };
  const pool = [];
  for (let n = 1; n <= MAX; n++) if (!ex.has(n) && !fx.includes(n)) pool.push(n);
  if (pool.length < PICK - fx.length) return { error: '제외한 번호가 너무 많아요.' };
  if (!(count >= 1 && count <= 10)) return { error: '게임 수는 1~10 사이로 골라 주세요.' };
  const sets = [];
  for (let c = 0; c < count; c++) {
    const p = [...pool];
    for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    sets.push([...fx, ...p.slice(0, PICK - fx.length)].sort((a, b) => a - b));
  }
  return { sets };
}

/** 공 색 구간 (1~10, 11~20, 21~30, 31~40, 41~45) */
export const ballBand = (n) => (n <= 10 ? 0 : n <= 20 ? 1 : n <= 30 ? 2 : n <= 40 ? 3 : 4);
