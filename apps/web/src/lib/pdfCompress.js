// PDF 용량 줄이기 설정 (순수 로직).
// 방식: 쪽마다 정해진 해상도(dpi)로 그려 JPEG로 다시 담는다. 사진·스캔이 많은 PDF에서 효과가 크고,
// 글자는 그림이 되어 검색·복사가 안 된다. 글자 위주의 작은 PDF는 오히려 커질 수 있어 결과를 비교해 안내한다.

export const COMPRESS_PRESETS = [
  { id: 'light', label: '조금 (화질 우선)', dpi: 150, quality: 0.8 },
  { id: 'medium', label: '보통 (추천)', dpi: 110, quality: 0.68 },
  { id: 'strong', label: '많이 (용량 우선)', dpi: 80, quality: 0.55 },
];

/** 원본 대비 결과 판단 */
export function compareSize(before, after) {
  const pct = before > 0 ? Math.round((1 - after / before) * 100) : 0;
  return { smaller: after < before, pct };
}

/** '계약서.PDF' → '계약서_small.pdf' */
export const compressedName = (name) => name.replace(/\.pdf$/i, '') + '_small.pdf';

/** 쪽 크기(pt)와 dpi → 그릴 픽셀 크기 (A4 150dpi ≈ 1240×1754) */
export function pagePixels(widthPt, heightPt, dpi) {
  const k = dpi / 72;
  return { w: Math.max(1, Math.round(widthPt * k)), h: Math.max(1, Math.round(heightPt * k)) };
}
