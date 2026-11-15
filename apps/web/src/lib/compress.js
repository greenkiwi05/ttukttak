// 목표 용량 압축 탐색 (순수 로직). 실제 인코딩은 주입받은 encode(scale, quality) 함수가 한다.
// 1) 원래 크기에서 JPEG 품질을 이진 탐색해 목표 이하 중 가장 높은 품질을 찾는다.
// 2) 최저 품질로도 넘으면 해상도를 단계적으로 줄여 다시 탐색한다.

export const MIN_Q = 0.3;
export const MAX_Q = 0.95;
export const SCALE_STEP = 0.8;
export const MIN_SCALE = 0.1;

/**
 * @param {(scale:number, quality:number) => Promise<{ size:number }>} encode
 * @param {number} targetBytes
 * @param {{ iterations?: number }} [opt]
 * @returns {Promise<{ scale:number, quality:number, size:number, fits:boolean, result:any }>}
 */
export async function searchTarget(encode, targetBytes, { iterations = 7 } = {}) {
  let scale = 1;
  let last = null;
  while (scale >= MIN_SCALE - 1e-9) {
    const best = await bestQuality(encode, scale, targetBytes, iterations);
    if (best) return { scale, quality: best.quality, size: best.out.size, fits: true, result: best.out };
    last = { scale, quality: MIN_Q };
    scale = Math.round(scale * SCALE_STEP * 1000) / 1000;
  }
  // 끝까지 못 맞추면 가장 작게 만든 결과를 돌려준다
  const out = await encode(last.scale, MIN_Q);
  return { scale: last.scale, quality: MIN_Q, size: out.size, fits: out.size <= targetBytes, result: out };
}

async function bestQuality(encode, scale, target, iterations) {
  const hi = await encode(scale, MAX_Q);
  if (hi.size <= target) return { quality: MAX_Q, out: hi };
  const lo = await encode(scale, MIN_Q);
  if (lo.size > target) return null;
  let a = MIN_Q, b = MAX_Q, best = { quality: MIN_Q, out: lo };
  for (let i = 0; i < iterations; i++) {
    const q = (a + b) / 2;
    const out = await encode(scale, q);
    if (out.size <= target) { best = { quality: q, out }; a = q; } else { b = q; }
  }
  return best;
}

/** 바이트 → '1.2MB' / '300KB' */
export function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2).replace(/\.?0+$/, '')}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
}

/** 원본 파일명 → 결과 파일명 (확장자를 .jpg로) */
export const toJpgName = (name, suffix = '') => name.replace(/\.[^.]+$/, '') + suffix + '.jpg';

export const TARGET_PRESETS = [
  { label: '100KB', bytes: 100 * 1024 },
  { label: '300KB', bytes: 300 * 1024 },
  { label: '500KB', bytes: 500 * 1024 },
  { label: '1MB', bytes: 1024 * 1024 },
  { label: '2MB', bytes: 2 * 1024 * 1024 },
];
