// 동영상 MP4 변환 계획 (순수 로직). 실제 변환은 브라우저 WebCodecs + mediabunny가 한다.
// H.264 영상·AAC 소리는 다시 압축하지 않고 MP4로 옮겨 담기만 한다(빠르고 화질 그대로).
// 그 밖의 코덱은 어디서나 재생되는 H.264·AAC로 다시 만든다.

export const VIDEO_NAMES = { avc: 'H.264', hevc: 'HEVC (H.265)', vp8: 'VP8', vp9: 'VP9', av1: 'AV1', prores: 'ProRes' };
export const AUDIO_NAMES = { aac: 'AAC', mp3: 'MP3', opus: 'Opus', vorbis: 'Vorbis', flac: 'FLAC', ac3: 'AC-3', eac3: 'E-AC-3' };
export const codecName = (c, kind = 'video') => (kind === 'video' ? VIDEO_NAMES : AUDIO_NAMES)[c] ?? (c ? String(c).toUpperCase() : '없음');

/** 읽을 수 있는 확장자 (mediabunny 입력 형식 기준. AVI는 지원하지 않음) */
export const VIDEO_EXTS = ['mov', 'mp4', 'm4v', 'mkv', 'webm', '3gp', 'ts', 'mts', 'm2ts'];

/**
 * @param {{ video: string|null, audio: string|null, ext?: string }} src 원본 코덱
 * @param {{ keepHevc?: boolean }} [opt] keepHevc: HEVC를 다시 만들지 않고 그대로 담기 (빠르지만 일부 기기에서 재생 안 됨)
 * @returns {{ video: 'copy'|'encode'|'unsupported', audio: 'copy'|'encode'|'none', fast: boolean, already: boolean }}
 *  fast: 다시 압축하는 것 없이 옮겨 담기만 / already: 이미 어디서나 재생되는 MP4라 바꿀 필요 없음
 */
export function planMp4(src, { keepHevc = false } = {}) {
  const v = src.video;
  const video = v === 'avc' || (v === 'hevc' && keepHevc) ? 'copy' : v === 'prores' || !v ? 'unsupported' : 'encode';
  const audio = !src.audio ? 'none' : src.audio === 'aac' ? 'copy' : 'encode';
  const fast = video === 'copy' && audio !== 'encode';
  const already = v === 'avc' && (audio === 'copy' || audio === 'none') && ['mp4', 'm4v'].includes(String(src.ext ?? '').toLowerCase());
  return { video, audio, fast, already };
}

/** 'IMG_1234.MOV' → 'IMG_1234.mp4' (원래 MP4면 덮어쓰지 않게 '_변환'을 붙인다) */
export function mp4Name(name) {
  const base = String(name ?? 'video').replace(/\.[^.]+$/, '');
  return /\.mp4$/i.test(String(name)) ? `${base}_변환.mp4` : `${base}.mp4`;
}

/** 파일 이름 → 확장자 (소문자) */
export const extOf = (name) => (String(name ?? '').match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase();
