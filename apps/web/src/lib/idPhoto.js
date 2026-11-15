// 증명사진 크롭 계산 (순수 로직). 실제 그리기는 canvas가 한다.
// 규격은 사진의 가로×세로 크기만 다룬다. 얼굴 크기·배경 같은 세부 규정은 기관 안내를 따른다.

export const DPI = 300;
export const cmToPx = (cm, dpi = DPI) => Math.round((cm / 2.54) * dpi);

export const PRESETS = [
  { id: 'half', label: '반명함 · 이력서', wCm: 3, hCm: 4 },
  { id: 'passport', label: '여권 · 비자', wCm: 3.5, hCm: 4.5 },
  { id: 'card', label: '명함판', wCm: 5, hCm: 7 },
].map((p) => ({ ...p, w: cmToPx(p.wCm), h: cmToPx(p.hCm) }));

/** 이미지 안에 들어가는, 비율이 aspect(가로/세로)인 가장 큰 사각형 크기 */
export function baseCrop(imgW, imgH, aspect) {
  return imgW / imgH > aspect ? { w: imgH * aspect, h: imgH } : { w: imgW, h: imgW / aspect };
}

/**
 * 확대 배율과 중심점으로 크롭 영역 계산. 영역은 항상 이미지 안에 있도록 중심을 보정한다.
 * @param {{ imgW:number, imgH:number, aspect:number, zoom:number, cx:number, cy:number }} p  cx, cy: 이미지 좌표의 중심
 * @returns {{ x:number, y:number, w:number, h:number, cx:number, cy:number }}
 */
export function cropRect({ imgW, imgH, aspect, zoom, cx, cy }) {
  const b = baseCrop(imgW, imgH, aspect);
  const z = Math.max(1, zoom);
  const w = b.w / z, h = b.h / z;
  const ccx = Math.min(Math.max(cx, w / 2), imgW - w / 2);
  const ccy = Math.min(Math.max(cy, h / 2), imgH - h / 2);
  return { x: ccx - w / 2, y: ccy - h / 2, w, h, cx: ccx, cy: ccy };
}

/**
 * 미리보기 위에서 손가락/마우스를 (dx, dy) 화면 픽셀만큼 끌었을 때 새 중심점.
 * 사진을 끄는 느낌이 되도록 크롭 중심은 반대로 움직인다.
 */
export function panCenter(rect, viewW, dx, dy) {
  const k = rect.w / viewW; // 화면 1px = 이미지 k px
  return { cx: rect.cx - dx * k, cy: rect.cy - dy * k };
}

/** 원하는 출력 픽셀이 원본 크롭 영역보다 크면(=업스케일) 경고용으로 true */
export const isUpscaled = (rect, outW) => rect.w < outW;
