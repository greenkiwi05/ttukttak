// 나이스(NEIS) 바이트 계산 (순수 함수).
// 교육부 학교생활기록부 종합지원포털 답변: 한글 1자 3Byte, 영문·숫자 1Byte, 엔터 1Byte → UTF-8 바이트 수와 같다(줄바꿈은 \n 하나로 센다).
// 항목별 최대 글자수는 해마다 바뀌므로 하드코딩하지 않고 사용자가 넣는다.
import { graphemes } from './charCount.js';

const enc = new TextEncoder();
const norm = (t) => String(t ?? '').replace(/\r\n?/g, '\n');
const bytesOf = (s) => enc.encode(s).length;

/** 나이스 기준 바이트 수 */
export const neisBytes = (text) => bytesOf(norm(text));

/** 바이트 제한 안으로 자르기 (글자 중간을 자르지 않는다) */
export function cutToBytes(text, limit) {
  const t = norm(text);
  if (!(limit > 0)) return '';
  let used = 0, out = '';
  for (const g of graphemes(t)) {
    const b = bytesOf(g);
    if (used + b > limit) break;
    used += b; out += g;
  }
  return out;
}

/** 한글 글자 수 ↔ 바이트 (한글 1자 = 3바이트) */
export const bytesForHangul = (chars) => Math.max(0, Math.round(Number(chars) || 0)) * 3;
export const hangulForBytes = (bytes) => Math.floor(Math.max(0, Number(bytes) || 0) / 3);

/**
 * 바이트가 한글(3)·영문(1)과 다른 글자 (가운뎃점 2바이트, 이모지 4바이트 등)
 * @returns {{ ch: string, bytes: number, count: number }[]}
 */
export function unusualChars(text) {
  const m = new Map();
  for (const g of graphemes(norm(text))) {
    const b = bytesOf(g);
    if (b === 1 || (b === 3 && /^[가-힣ㄱ-ㆎ]$/.test(g))) continue;
    const e = m.get(g) ?? { ch: g, bytes: b, count: 0 };
    e.count++; m.set(g, e);
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

/** 붙여 넣은 글 정리: 줄 끝 공백 삭제, 겹친 띄어쓰기를 하나로, 빈 줄은 최대 한 줄, 앞뒤 공백 삭제 */
export function tidy(text) {
  return norm(text)
    .replace(/[ 　]/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 줄바꿈(엔터) 수 */
export const enterCount = (text) => (norm(text).match(/\n/g) ?? []).length;
