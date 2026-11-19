// 동영상 → GIF 설정 계산 (순수 로직). 프레임 읽기는 mediabunny, GIF 만들기는 gifenc가 한다.

export const WIDTHS = [320, 480, 640];
export const FPS = [10, 15, 20];
export const MAX_SECONDS = 20;
export const MAX_FRAMES = 300;

/** 가로 폭에 맞춘 크기 (원본보다 키우지 않음, 짝수) */
export function gifDims(w, h, width) {
  const tw = Math.min(width, w);
  const th = Math.max(2, Math.round((h * tw) / w / 2) * 2);
  return { w: Math.max(2, Math.round(tw / 2) * 2), h: th };
}

/**
 * 뽑을 프레임 시각 목록
 * @returns {{ times: number[], delay: number } | { error: string }}  delay: 프레임 사이 ms
 */
export function frameTimes({ start, end, fps }) {
  const len = end - start;
  if (!(len > 0)) return { error: '구간을 다시 정해 주세요.' };
  if (len > MAX_SECONDS + 0.05) return { error: `GIF는 ${MAX_SECONDS}초까지 만들 수 있어요. 구간을 줄여 주세요.` };
  const n = Math.max(1, Math.floor(len * fps));
  if (n > MAX_FRAMES) return { error: `프레임이 너무 많아요(${n}장). 초당 프레임을 낮추거나 구간을 줄여 주세요.` };
  const times = Array.from({ length: n }, (_, i) => Math.round((start + i / fps) * 1000) / 1000);
  return { times, delay: Math.round(1000 / fps) };
}

/** 대략적인 용량 (실제는 장면에 따라 크게 달라짐) — 픽셀당 약 0.35바이트 */
export const estimateGifBytes = (w, h, frames) => Math.round(w * h * frames * 0.35);

export const gifOutName = (name) => name.replace(/\.[^.]+$/, '') + '.gif';
