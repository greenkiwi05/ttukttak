// PDF 페이지 범위 입력 파서. "1-3, 5, 8-" 형식 (1부터 시작, "8-"은 8쪽부터 끝까지).
// 쉼표로 나뉜 각 덩어리가 하나의 그룹(= 나누기 모드에서 파일 하나)이 된다.

/**
 * @param {string} input
 * @param {number} total 전체 페이지 수
 * @returns {{ groups:number[][], pages:number[] } | { error:string }}  pages = 그룹을 이어 붙이고 중복 제거
 */
export function parsePageRanges(input, total) {
  const s = String(input ?? '').replace(/\s+/g, '').replace(/[~–—]/g, '-');
  if (!s) return { error: '페이지 범위를 입력해 주세요. 예: 1-3, 5' };
  const groups = [];
  for (const part of s.split(',')) {
    if (!part) continue;
    const m = /^(\d+)(?:-(\d*))?$/.exec(part);
    if (!m) return { error: `"${part}"를 이해하지 못했어요. 예: 1-3, 5, 8-` };
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : m[2] === '' ? total : Number(m[2]);
    if (a < 1 || b < 1) return { error: '페이지 번호는 1부터 시작해요.' };
    if (a > total || b > total) return { error: `이 PDF는 ${total}쪽까지 있어요.` };
    if (a > b) return { error: `"${part}"의 앞 번호가 뒤 번호보다 커요.` };
    const g = [];
    for (let p = a; p <= b; p++) g.push(p);
    groups.push(g);
  }
  if (!groups.length) return { error: '페이지 범위를 입력해 주세요. 예: 1-3, 5' };
  const pages = [...new Set(groups.flat())];
  return { groups, pages };
}

/** 원본 이름과 페이지 묶음 → 저장 파일명 */
export function splitFileName(name, pages) {
  const base = name.replace(/\.pdf$/i, '');
  const label = pages.length === 1 ? `${pages[0]}` : `${pages[0]}-${pages[pages.length - 1]}`;
  return `${base}_p${label}.pdf`;
}
