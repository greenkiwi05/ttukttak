// 이미지 → PDF 페이지 배치 계산. 단위는 PDF 포인트(1pt = 1/72인치, 1mm = 72/25.4pt).

export const MM = 72 / 25.4;
export const PAGE_SIZES = {
  a4: { label: 'A4', w: 210 * MM, h: 297 * MM },
  letter: { label: 'Letter', w: 8.5 * 72, h: 11 * 72 },
};

/**
 * @param {number} imgW 이미지 가로(px)
 * @param {number} imgH 이미지 세로(px)
 * @param {{ page:'a4'|'letter'|'fit', orientation?:'auto'|'portrait'|'landscape', marginMm?:number }} opt
 * @returns {{ pageW:number, pageH:number, x:number, y:number, w:number, h:number }}
 *   fit: 이미지 크기 그대로 페이지를 만든다(1px = 0.75pt, 96dpi 기준)
 */
export function pageLayout(imgW, imgH, { page, orientation = 'auto', marginMm = 10 }) {
  if (page === 'fit') {
    const w = imgW * 0.75, h = imgH * 0.75;
    return { pageW: w, pageH: h, x: 0, y: 0, w, h };
  }
  const base = PAGE_SIZES[page] ?? PAGE_SIZES.a4;
  const landscape = orientation === 'landscape' || (orientation === 'auto' && imgW > imgH);
  const pageW = landscape ? base.h : base.w;
  const pageH = landscape ? base.w : base.h;
  const m = Math.max(0, marginMm) * MM;
  const boxW = Math.max(1, pageW - 2 * m), boxH = Math.max(1, pageH - 2 * m);
  const k = Math.min(boxW / imgW, boxH / imgH);
  const w = imgW * k, h = imgH * k;
  return { pageW, pageH, x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
}
