// 동영상·오디오 → MP3/M4A/WAV 소리 추출 (순수 로직). 실제 변환은 브라우저 WebCodecs + mediabunny(MP3는 LAME WASM)가 한다.

export const FORMATS = [
  { id: 'mp3', label: 'MP3', ext: 'mp3', mime: 'audio/mpeg', codec: 'mp3', note: '어디서나 재생돼요' },
  { id: 'm4a', label: 'M4A (AAC)', ext: 'm4a', mime: 'audio/mp4', codec: 'aac', note: '같은 음질에 더 작아요' },
  { id: 'wav', label: 'WAV', ext: 'wav', mime: 'audio/wav', codec: 'pcm-s16', note: '무손실, 용량이 커요' },
];
export const BITRATES = [128, 192, 320]; // kbps
export const INPUT_EXTS = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', '3gp', 'm4a', 'mp3', 'wav', 'aac', 'ogg', 'opus', 'flac'];

/** "1:23", "1:02:03", "83", "83.5" → 초 (빈 값 null, 잘못되면 NaN) */
export function parseTime(s) {
  const t = String(s ?? '').trim();
  if (!t) return null;
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(t)) return NaN;
  const parts = t.split(':').map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return NaN;
  return parts.reduce((a, p) => a * 60 + p, 0);
}

/** 초 → "1:23" / "1:02:03" (소수 첫째 자리까지, 0이면 생략) */
export function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const tenth = Math.round(sec * 10) / 10;
  const whole = Math.floor(tenth);
  const frac = Math.round((tenth - whole) * 10);
  const h = Math.floor(whole / 3600), m = Math.floor((whole % 3600) / 60), s = whole % 60;
  const ss = String(s).padStart(2, '0') + (frac ? `.${frac}` : '');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** 자르기 구간 검사 → { start, end, length } | { error } (비우면 처음/끝) */
export function trimRange(startText, endText, duration) {
  const s = parseTime(startText), e = parseTime(endText);
  if (Number.isNaN(s) || Number.isNaN(e)) return { error: '시간은 1:23 또는 83처럼 입력해 주세요.' };
  const start = s ?? 0, end = e ?? duration;
  if (start >= duration) return { error: `시작 시간이 영상 길이(${fmtTime(duration)})보다 길어요.` };
  if (end > duration + 0.05) return { error: `끝 시간이 영상 길이(${fmtTime(duration)})보다 길어요.` };
  if (end <= start) return { error: '끝 시간은 시작 시간보다 뒤여야 해요.' };
  return { start, end: Math.min(end, duration), length: Math.min(end, duration) - start, whole: start === 0 && Math.min(end, duration) >= duration - 0.05 };
}

/** 예상 용량 (바이트) */
export function estimateBytes({ format, kbps = 192, seconds, sampleRate = 48000, channels = 2 }) {
  if (format === 'wav') return Math.round(seconds * sampleRate * channels * 2 + 44);
  return Math.round((seconds * kbps * 1000) / 8);
}

export const audioOutName = (name, ext) => name.replace(/\.[^.]+$/, '') + '.' + ext;
