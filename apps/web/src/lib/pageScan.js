// 뷰어 화면(캔버스)에서 쪽 경계를 찾는다. 쪽 사이·바깥은 뷰어 배경색, 쪽은 그 밖의 색이다.
// 배경색이 minGap 이상 이어지면 쪽 사이 틈으로 본다 (본문 속 우연한 회색 한두 줄은 무시).

/** 같은 색인지 (RGB 각 채널 허용 오차) */
export const sameColor = (r, g, b, bg, tol = 3) => Math.abs(r - bg[0]) <= tol && Math.abs(g - bg[1]) <= tol && Math.abs(b - bg[2]) <= tol;

/**
 * @param {boolean[]} isBg 세로줄 픽셀마다 배경색인지
 * @returns {{ top:number, bottom:number }[]} 쪽 영역 (bottom 포함)
 */
export function findRuns(isBg, { minGap = 6, minPage = 100 } = {}) {
  const runs = [];
  let start = -1, gap = 0;
  for (let y = 0; y <= isBg.length; y++) {
    const bg = y === isBg.length || isBg[y];
    if (!bg) {
      if (start < 0) start = y;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap >= minGap || y === isBg.length) {
        const bottom = y - gap;
        if (bottom - start + 1 >= minPage) runs.push({ top: start, bottom });
        start = -1; gap = 0;
      }
    }
  }
  return runs;
}

/** 가로줄에서 쪽의 왼쪽·오른쪽 끝 (배경이 아닌 첫·마지막 픽셀) */
export function findEdges(isBg) {
  const left = isBg.indexOf(false);
  if (left < 0) return null;
  return { left, right: isBg.lastIndexOf(false) };
}
