// 사진 합치기 배치 계산. 세로로 이어 붙이면 너비를, 가로로 이어 붙이면 높이를 맞춘다.
// fit: 'match' 크기를 맞춤(가장 작은 쪽 기준, 확대 없음) / 'original' 원본 크기 그대로(가운데 정렬)

/**
 * @param {{ w:number, h:number }[]} imgs
 * @param {{ dir:'vertical'|'horizontal', gap?:number, fit?:'match'|'original', maxSide?:number }} o
 * @returns {{ W:number, H:number, rects:{ x:number, y:number, w:number, h:number }[], scaled:boolean }}
 */
export function mergeLayout(imgs, { dir, gap = 0, fit = 'match', maxSide = 16000 }) {
  if (!imgs.length) return { W: 0, H: 0, rects: [], scaled: false };
  const v = dir === 'vertical';
  const cross = (i) => (v ? i.w : i.h); // 맞출 변
  const target = fit === 'match' ? Math.min(...imgs.map(cross)) : Math.max(...imgs.map(cross));
  let sizes = imgs.map((i) => {
    if (fit !== 'match') return { w: i.w, h: i.h };
    const k = target / cross(i);
    return { w: v ? target : i.w * k, h: v ? i.h * k : target };
  });
  const g = Math.max(0, gap);
  let along = sizes.reduce((s, z) => s + (v ? z.h : z.w), 0) + g * (imgs.length - 1);
  let crossLen = target;
  // 결과가 너무 크면 전체를 줄인다 (canvas 한계)
  const k = Math.min(1, maxSide / along, maxSide / crossLen);
  const scaled = k < 1;
  if (scaled) { sizes = sizes.map((z) => ({ w: z.w * k, h: z.h * k })); along *= k; crossLen *= k; }
  const gg = g * k;
  const rects = [];
  let pos = 0;
  for (const z of sizes) {
    const off = ((v ? crossLen - z.w : crossLen - z.h) / 2);
    rects.push(v ? { x: Math.round(off), y: Math.round(pos), w: Math.round(z.w), h: Math.round(z.h) } : { x: Math.round(pos), y: Math.round(off), w: Math.round(z.w), h: Math.round(z.h) });
    pos += (v ? z.h : z.w) + gg;
  }
  return { W: Math.round(v ? crossLen : along), H: Math.round(v ? along : crossLen), rects, scaled };
}
