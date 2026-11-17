// 도장 글자 배치 계산 (순수 로직). 좌표는 0~1 상자 기준, 그리기는 canvas가 한다.
// 전통 도장처럼 세로쓰기는 오른쪽 줄부터 읽는다 (오른쪽 위 → 오른쪽 아래 → 왼쪽 위 …).
// 3글자 2단 배치는 오른쪽 줄에 첫 글자(성)를 크게, 왼쪽 줄에 나머지 두 글자를 둔다.

export const LAYOUTS = { auto: '자동', row: '가로 한 줄', col: '세로 한 줄', grid: '두 줄' };

/** 실제로 쓸 배치 */
export function resolveLayout(n, layout = 'auto') {
  if (layout !== 'auto') return n === 1 ? 'col' : layout;
  if (n <= 2) return 'col';
  return 'grid';
}

/**
 * @param {string[]} chars 글자 (1~4)
 * @param {'auto'|'row'|'col'|'grid'} layout
 * @param {number} pad 상자 안쪽 여백(0~0.5)
 * @returns {{ ch:string, cx:number, cy:number, w:number, h:number }[]} 글자 칸의 가운데와 크기
 */
export function layoutChars(chars, layout = 'auto', pad = 0.18) {
  const n = chars.length;
  if (!n) return [];
  const L = resolveLayout(n, layout);
  const inner = 1 - pad * 2;
  const cell = (c, r, cols, rows, span = 1) => ({
    cx: pad + (inner / cols) * (c + 0.5),
    cy: pad + (inner / rows) * (r + span / 2),
    w: inner / cols,
    h: (inner / rows) * span,
  });
  if (L === 'row') return chars.map((ch, i) => ({ ch, ...cell(i, 0, n, 1) }));
  if (L === 'col') return chars.map((ch, i) => ({ ch, ...cell(0, i, 1, n) }));
  // grid: 2열, 오른쪽 열(c=1)부터
  if (n === 2) return [{ ch: chars[0], ...cell(1, 0, 2, 1) }, { ch: chars[1], ...cell(0, 0, 2, 1) }];
  if (n === 3) return [{ ch: chars[0], ...cell(1, 0, 2, 2, 2) }, { ch: chars[1], ...cell(0, 0, 2, 2) }, { ch: chars[2], ...cell(0, 1, 2, 2) }];
  const rows = Math.ceil(n / 2);
  return chars.map((ch, i) => ({ ch, ...cell(i < rows ? 1 : 0, i % rows, 2, rows) }));
}

/** 이름(+선택 '인') → 글자 배열. 한글·한자 1~4자만 */
export function stampChars(name, addIn = false) {
  const chars = [...String(name ?? '').replace(/\s+/g, '')];
  const all = addIn && chars.length < 4 ? [...chars, '인'] : chars;
  if (!chars.length) return { error: '이름을 입력해 주세요.' };
  if (all.length > 4) return { error: '도장에는 4글자까지 넣을 수 있어요.' };
  return { chars: all };
}
