// 글자수 세기. 사이트마다 세는 기준이 달라서 규칙을 명확히 정해 둔다.
//  - 글자: 화면에 보이는 한 글자(grapheme) 단위. 이모지·결합 문자도 1자. 줄바꿈도 1자로 센다.
//  - 공백 제외: 스페이스·탭·줄바꿈 등 모든 공백 문자를 뺀 글자 수
//  - 바이트(UTF-8): 실제 저장 크기. 한글 1자 = 3바이트
//  - 바이트(한글 2바이트 기준): 한글 등 ASCII가 아닌 글자 2, 영문·숫자·공백 1, 줄바꿈 2(\r\n)
//  - 원고지: 공백 포함 글자 수 ÷ 200 올림 (띄어쓰기·문단 규칙을 반영하지 않은 단순 계산)

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ko', { granularity: 'grapheme' }) : null;

/** 문자열 → 글자(grapheme) 배열 */
export function graphemes(str) {
  return segmenter ? Array.from(segmenter.segment(str), (s) => s.segment) : Array.from(str);
}

const isSpace = (g) => /^\s+$/u.test(g);

/**
 * @param {string} text
 * @returns {{ chars:number, charsNoSpace:number, bytesUtf8:number, bytesKr:number, words:number, lines:number, paragraphs:number, manuscript:number }}
 */
export function countText(text) {
  const t = String(text ?? '').replace(/\r\n?/g, '\n');
  const gs = graphemes(t);
  let charsNoSpace = 0, bytesKr = 0;
  for (const g of gs) {
    if (!isSpace(g)) charsNoSpace++;
    if (g === '\n') bytesKr += 2;
    else bytesKr += /^[\x00-\x7f]+$/.test(g) ? g.length : 2;
  }
  const trimmed = t.trim();
  return {
    chars: gs.length,
    charsNoSpace,
    bytesUtf8: new TextEncoder().encode(t).length,
    bytesKr,
    words: wordList(t).length,
    lines: t ? t.split('\n').length : 0,
    paragraphs: trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length : 0,
    manuscript: Math.ceil(gs.length / 200),
  };
}

/** 목표 글자수에 맞게 자르기 (graphemes 기준) */
export const cutTo = (text, n) => graphemes(String(text ?? '')).slice(0, n).join('');

// ── 단어 수 세기 ──
// 단어: 공백으로 나눈 토막 중 글자·숫자가 하나라도 있는 것 (" - ", "…" 같은 기호만 있는 토막은 빼요).
// well-known, don't 처럼 하이픈·아포스트로피로 이어진 말은 1단어 (워드 프로그램과 같은 방식).
const HAS_WORD = /[\p{L}\p{N}]/u;
const EDGE_PUNCT = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/** 단어 배열 (앞뒤 문장부호는 떼어 냄) */
export function wordList(text) {
  return String(text ?? '').split(/\s+/u).filter((w) => HAS_WORD.test(w)).map((w) => w.replace(EDGE_PUNCT, ''));
}

/** 자주 쓴 단어에서 뺄 영어 기능어 */
const STOP = new Set('a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those i you he she we they me my your our their his her them us not no do does did so than then there here what which who whom will would can could should may might must have has had about into over also just very'.split(' '));

/**
 * 단어 통계
 * @returns {{ words:number, unique:number, sentences:number, avgLen:number, readMin:number, top:[string, number][] }}
 */
export function wordStats(text, topN = 10) {
  const t = String(text ?? '');
  const ws = wordList(t);
  const freq = new Map();
  let letters = 0;
  for (const w of ws) {
    const k = w.toLowerCase();
    letters += graphemes(w).length;
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  // 문장: . ! ? 。(그리고 줄바꿈)으로 나눈 조각 중 글자가 있는 것
  const sentences = t.split(/[.!?。？！]+(?=\s|$)|\n+/u).filter((x) => HAS_WORD.test(x)).length;
  const top = [...freq].filter(([k, n]) => n > 1 && !STOP.has(k)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, topN);
  return {
    words: ws.length,
    unique: freq.size,
    sentences,
    avgLen: ws.length ? letters / ws.length : 0,
    readMin: ws.length / 200, // 영어 기준 분당 약 200단어로 어림
    top,
  };
}

/** 앞에서부터 n단어까지만 남기기 (원래 띄어쓰기·줄바꿈 유지) */
export function cutWords(text, n) {
  const t = String(text ?? '');
  if (n <= 0) return '';
  let count = 0;
  const re = /\S+/gu;
  let m;
  while ((m = re.exec(t))) {
    if (!HAS_WORD.test(m[0])) continue;
    count++;
    if (count === n) return t.slice(0, m.index + m[0].length);
  }
  return t;
}
