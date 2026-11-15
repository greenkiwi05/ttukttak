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
    words: trimmed ? trimmed.split(/\s+/u).length : 0,
    lines: t ? t.split('\n').length : 0,
    paragraphs: trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length : 0,
    manuscript: Math.ceil(gs.length / 200),
  };
}

/** 목표 글자수에 맞게 자르기 (graphemes 기준) */
export const cutTo = (text, n) => graphemes(String(text ?? '')).slice(0, n).join('');
