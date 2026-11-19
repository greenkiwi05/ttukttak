// 사진 글자 추출(OCR) 결과 정리 (순수 로직). 인식은 tesseract.js(브라우저 안 WASM)가 한다.

export const LANGS = [
  { id: 'kor+eng', label: '한국어 + 영어' },
  { id: 'eng', label: '영어만' },
];
export const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'];

/**
 * 인식 결과 다듬기
 * - 줄 끝 공백 제거, 빈 줄 3개 이상은 2개로
 * - joinLines: 문단 안의 줄바꿈을 공백으로 이어 붙임 (빈 줄로 나뉜 문단은 유지)
 */
export function cleanText(text, { joinLines = false } = {}) {
  let t = String(text ?? '').replace(/\r/g, '').split('\n').map((l) => l.replace(/[ \t]+$/g, '')).join('\n');
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  if (joinLines) {
    t = t.split(/\n{2,}/).map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean).join(' ')).join('\n\n');
  }
  return t;
}

/** 진행 상태 문구 (tesseract logger status → 한국어) */
export function statusKo(status) {
  if (/load|initializ/i.test(status)) return '인식 엔진·언어 데이터를 준비하는 중… (처음 한 번만 오래 걸려요)';
  if (/recogniz/i.test(status)) return '글자를 읽는 중…';
  return '준비 중…';
}

/** 글자 수 (공백 제외) */
export const charCount = (t) => String(t ?? '').replace(/\s/g, '').length;
