// PDF 한 쪽에서 그림을 꺼내는 브라우저 전용 함수 (pdf.js, canvas 필요 — 테스트 대상 아님).
// 그림을 그리는 명령(paintImageXObject)이 나올 때의 변환 행렬로 위치(y)와 크기를 계산한다.
import { keepImage, fitWidth, centerFlatness } from './pdfToHwpx.js';

const MAX_PX = 1600;

/** pdf.js 이미지 객체 → JPEG data URL */
function toDataUrl(img) {
  const w = img.width, h = img.height;
  if (!w || !h) return null;
  const scale = Math.min(1, MAX_PX / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0, c.width, c.height);
  } else if (img.data) {
    // kind: 1 = 흑백 1비트, 2 = RGB, 3 = RGBA
    const src = img.data, rgba = new Uint8ClampedArray(w * h * 4);
    if (img.kind === 3) rgba.set(src.subarray(0, rgba.length));
    else if (img.kind === 2) for (let i = 0, j = 0; j < rgba.length; i += 3, j += 4) { rgba[j] = src[i]; rgba[j + 1] = src[i + 1]; rgba[j + 2] = src[i + 2]; rgba[j + 3] = 255; }
    else if (img.kind === 1) {
      const rowBytes = Math.ceil(w / 8);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const on = (src[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
        const k = (y * w + x) * 4; const v = on ? 255 : 0;
        rgba[k] = rgba[k + 1] = rgba[k + 2] = v; rgba[k + 3] = 255;
      }
    } else return null;
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);
    ctx.drawImage(tmp, 0, 0, c.width, c.height);
  } else return null;
  if (isFlat(c)) return null; // 투명 장식이 상자로 바뀐 것(흰 상자·검은 상자·그림자 틀)은 버린다
  return c.toDataURL('image/jpeg', 0.85);
}

function isFlat(c) {
  const N = 96;
  const s = document.createElement('canvas');
  s.width = N; s.height = N;
  const x = s.getContext('2d', { willReadFrequently: true });
  x.drawImage(c, 0, 0, N, N);
  const d = x.getImageData(0, 0, N, N).data;
  const L = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  return centerFlatness(L, N) >= 0.95;
}

const getObj = (page, name) => new Promise((resolve) => {
  const store = name.startsWith('g_') ? page.commonObjs : page.objs;
  try { store.get(name, resolve); } catch { resolve(null); }
  setTimeout(() => resolve(null), 5000); // 못 받으면 건너뜀
});

const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];

/**
 * 한 쪽의 그림들 → [{ y, src, width }] (y: PDF 좌표의 그림 위쪽, width: 화면 px)
 */
export async function pageImages(pdfjs, page) {
  const { OPS } = pdfjs;
  const ops = await page.getOperatorList();
  const out = [];
  const stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i], args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const wPt = Math.hypot(ctm[0], ctm[1]), hPt = Math.hypot(ctm[2], ctm[3]);
      if (!keepImage(wPt, hPt)) continue;
      const img = fn === OPS.paintInlineImageXObject ? args[0] : await getObj(page, args[0]);
      if (!img) continue;
      const src = toDataUrl(img);
      if (!src) continue;
      out.push({ y: ctm[5] + Math.max(0, ctm[3]), src, width: fitWidth((wPt * 96) / 72, (hPt * 96) / 72), wPt, hPt, key: typeof args[0] === 'string' ? args[0] : undefined });
    }
  }
  return out;
}

/**
 * 쪽 전체를 그림으로 (글자가 없는 스캔 쪽, "쪽 모양 그대로" 변환)
 * @param {any} page
 * @param {{ scale?: number, maxW?: number, maxH?: number }} [opts]  maxW·maxH: 넣을 그림 최대 크기(px)
 */
export async function pageSnapshot(page, { scale = 1.5, maxW, maxH } = {}) {
  const vp = page.getViewport({ scale });
  const c = document.createElement('canvas');
  c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
  const base = page.getViewport({ scale: 1 });
  const width = maxW ? fitWidth((base.width * 96) / 72, (base.height * 96) / 72, maxW, maxH) : fitWidth(base.width, base.height);
  return { y: base.height, src: c.toDataURL('image/jpeg', 0.85), width };
}
