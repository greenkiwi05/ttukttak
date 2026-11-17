// 동영상 용량 줄이기 설정 계산 (순수 로직). 실제 인코딩은 브라우저 WebCodecs + mediabunny가 한다.

export const RES_PRESETS = [
  { id: 'original', label: '원본 크기', short: 0 },
  { id: '1080', label: '1080p', short: 1080 },
  { id: '720', label: '720p', short: 720 },
  { id: '480', label: '480p', short: 480 },
];
export const SIZE_PRESETS_MB = [10, 25, 50, 100];
export const MIN_VIDEO_BPS = 100_000;

const even = (n) => Math.max(2, Math.round(n / 2) * 2);

/** 짧은 변을 short px로 줄인 크기 (가로·세로 영상 모두). 원본이 더 작으면 그대로. 인코더를 위해 짝수로 맞춘다 */
export function scaleDims(w, h, short) {
  if (!short || Math.min(w, h) <= short) return { w: even(w), h: even(h), scaled: false };
  const k = short / Math.min(w, h);
  return { w: even(w * k), h: even(h * k), scaled: true };
}

/**
 * 목표 용량에 맞는 영상 비트레이트. 컨테이너 오버헤드로 3%를 남겨 둔다.
 * @returns {{ videoBps:number, audioBps:number } | { error:string }}
 */
export function bitrateForTarget(targetBytes, durationSec, { audioBps = 128_000, keepAudio = true } = {}) {
  if (!(durationSec > 0)) return { error: '영상 길이를 알 수 없어요.' };
  if (!(targetBytes > 0)) return { error: '목표 용량을 입력해 주세요.' };
  const total = (targetBytes * 8 * 0.97) / durationSec;
  let audio = keepAudio ? audioBps : 0;
  // 예산이 빠듯하면 소리 비트레이트를 먼저 낮춘다
  if (keepAudio && total - audio < MIN_VIDEO_BPS * 2) audio = Math.min(audio, 64_000);
  const video = Math.floor(total - audio);
  if (video < MIN_VIDEO_BPS) {
    const minMB = Math.ceil((((MIN_VIDEO_BPS + audio) * durationSec) / 8 / 0.97 / 1024 / 1024) * 10) / 10;
    return { error: `영상이 길어서 이 용량으로는 줄일 수 없어요. ${minMB}MB 이상으로 정해 주세요.` };
  }
  return { videoBps: video, audioBps: audio };
}

/**
 * 목표보다 크게 나왔을 때 다시 시도할 영상 비트레이트. 넘친 비율만큼 줄이고 7% 여유를 더 둔다.
 * 더 줄일 수 없으면 null.
 */
export function retryBitrate(prevVideoBps, actualBytes, targetBytes) {
  if (actualBytes <= targetBytes) return null;
  const next = Math.floor(prevVideoBps * (targetBytes / actualBytes) * 0.93);
  return next >= MIN_VIDEO_BPS ? next : null;
}

/** 예상 용량(바이트) */
export const estimateBytes = (videoBps, audioBps, durationSec) => Math.round(((videoBps + audioBps) * durationSec) / 8 / 0.97);

/** 83 → '1:23', 3723 → '1:02:03' */
export function fmtDuration(sec) {
  const s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/** 'IMG_1234.MOV' → 'IMG_1234_small.mp4' */
export const videoOutName = (name) => name.replace(/\.[^.]+$/, '') + '_small.mp4';
