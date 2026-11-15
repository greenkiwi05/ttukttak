// 이미지 크기 조절 계산.
//  percent: 비율(%) · width: 가로 고정(세로 비율 유지) · height: 세로 고정 · box: 가로×세로 상자 안에 비율 유지로 맞춤
//  · exact: 가로×세로 그대로(비율 무시)

export const FORMATS = {
  jpeg: { label: 'JPG', mime: 'image/jpeg', ext: 'jpg', lossy: true },
  png: { label: 'PNG', mime: 'image/png', ext: 'png', lossy: false },
  webp: { label: 'WEBP', mime: 'image/webp', ext: 'webp', lossy: true },
};

/**
 * @param {number} srcW
 * @param {number} srcH
 * @param {{ mode:'percent'|'width'|'height'|'box'|'exact', percent?:number, width?:number, height?:number, noUpscale?:boolean }} o
 * @returns {{ w:number, h:number } | { error:string }}
 */
export function targetSize(srcW, srcH, o) {
  const pos = (n) => Number.isFinite(n) && n > 0;
  let w, h;
  switch (o.mode) {
    case 'percent':
      if (!pos(o.percent)) return { error: '비율(%)을 입력해 주세요.' };
      w = (srcW * o.percent) / 100; h = (srcH * o.percent) / 100; break;
    case 'width':
      if (!pos(o.width)) return { error: '가로 크기를 입력해 주세요.' };
      w = o.width; h = (srcH * o.width) / srcW; break;
    case 'height':
      if (!pos(o.height)) return { error: '세로 크기를 입력해 주세요.' };
      h = o.height; w = (srcW * o.height) / srcH; break;
    case 'box': {
      if (!pos(o.width) || !pos(o.height)) return { error: '가로와 세로를 모두 입력해 주세요.' };
      const k = Math.min(o.width / srcW, o.height / srcH);
      w = srcW * k; h = srcH * k; break;
    }
    case 'exact':
      if (!pos(o.width) || !pos(o.height)) return { error: '가로와 세로를 모두 입력해 주세요.' };
      w = o.width; h = o.height; break;
    default:
      return { error: '크기 조절 방식을 골라 주세요.' };
  }
  if (o.noUpscale && o.mode !== 'exact' && (w > srcW || h > srcH)) { w = srcW; h = srcH; }
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  if (w > 16384 || h > 16384) return { error: '한 변이 16,384px을 넘으면 브라우저에서 만들 수 없어요.' };
  return { w, h };
}

/** 'photo.HEIC.png' + webp → 'photo.HEIC.webp' */
export const renameExt = (name, ext) => name.replace(/\.[^.]+$/, '') + '.' + ext;
