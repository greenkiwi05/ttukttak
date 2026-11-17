// PDF → 이미지 변환 설정 계산 (렌더링은 pdf.js가 한다).
// PDF 크기 단위는 포인트(1/72인치)라서 배율 = DPI / 72.

export const DPI_PRESETS = [
  { dpi: 96, label: '화면용 (96dpi)' },
  { dpi: 150, label: '보통 (150dpi)' },
  { dpi: 300, label: '인쇄용 (300dpi)' },
];

/** 브라우저 canvas 한계를 넘지 않게 배율을 줄인다 (한 변 8192px, 면적 3,200만 px) */
export function renderScale(pageW, pageH, dpi, maxSide = 8192, maxArea = 32_000_000) {
  let s = dpi / 72;
  s = Math.min(s, maxSide / pageW, maxSide / pageH, Math.sqrt(maxArea / (pageW * pageH)));
  return { scale: s, w: Math.floor(pageW * s), h: Math.floor(pageH * s), reduced: s < dpi / 72 - 1e-9 };
}

/** '계약서.pdf', 3쪽, 12쪽 중 → '계약서_03.jpg' (쪽수 자릿수에 맞춰 0 채움) */
export function pageImageName(pdfName, page, total, ext = 'jpg') {
  const base = pdfName.replace(/\.pdf$/i, '');
  return `${base}_${String(page).padStart(String(total).length, '0')}.${ext}`;
}
