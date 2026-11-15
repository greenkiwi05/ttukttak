// 사다리타기. rungs[r][i] = true 이면 r번째 줄에서 i번 세로줄과 i+1번 세로줄 사이에 가로줄이 있다.
// 같은 줄에서 가로줄이 이어 붙지 않게 만들어서, 결과는 항상 1:1로 대응한다.
// rand: 0 이상 1 미만 난수 함수 (화면에서는 crypto.getRandomValues 기반)

export function makeLadder(n, rows, rand = Math.random, density = 0.45) {
  const rungs = [];
  for (let r = 0; r < rows; r++) {
    const row = new Array(Math.max(0, n - 1)).fill(false);
    for (let i = 0; i < n - 1; i++) {
      if (i > 0 && row[i - 1]) continue;
      row[i] = rand() < density;
    }
    rungs.push(row);
  }
  // 모든 칸 사이에 가로줄이 최소 1개는 있게 (안 그러면 그대로 내려가는 사람이 생기기 쉬움)
  for (let i = 0; i < n - 1; i++) {
    if (rungs.some((row) => row[i])) continue;
    const candidates = rungs.map((row, r) => r).filter((r) => !rungs[r][i - 1] && !rungs[r][i + 1]);
    if (candidates.length) rungs[candidates[Math.floor(rand() * candidates.length)]][i] = true;
  }
  return { n, rows, rungs };
}

/** start번 세로줄에서 내려가 도착하는 세로줄과 지나간 점 [{col,row}] (row: 0~rows, 줄 사이 위치) */
export function trace({ n, rows, rungs }, start) {
  let c = start;
  const path = [{ col: c, row: 0 }];
  for (let r = 0; r < rows; r++) {
    const y = r + 0.5;
    if (c < n - 1 && rungs[r][c]) { path.push({ col: c, row: y }, { col: c + 1, row: y }); c++; }
    else if (c > 0 && rungs[r][c - 1]) { path.push({ col: c, row: y }, { col: c - 1, row: y }); c--; }
  }
  path.push({ col: c, row: rows });
  return { end: c, path };
}

/** 모든 출발점의 결과 [end0, end1, ...] */
export const mapping = (ladder) => Array.from({ length: ladder.n }, (_, i) => trace(ladder, i).end);

/** crypto 기반 난수 (브라우저/Node 공통) */
export function cryptoRand() {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}
