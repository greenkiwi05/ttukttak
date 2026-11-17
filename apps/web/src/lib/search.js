// 사이트 안 도구 검색 (순수 로직). 띄어쓰기·대소문자 무시, 초성 검색(ㅁㄴㅇ → 만 나이) 지원.

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

export const normalize = (s) => String(s ?? '').toLowerCase().replace(/[\s·\-_()/]+/g, '');

/** 한글 음절을 초성으로 바꾼다 (그 밖의 글자는 그대로) */
export function toChosung(s) {
  let out = '';
  for (const ch of String(s ?? '')) {
    const c = ch.charCodeAt(0);
    out += c >= 0xac00 && c <= 0xd7a3 ? CHO[Math.floor((c - 0xac00) / 588)] : ch;
  }
  return out;
}

const isChosungOnly = (s) => /^[ㄱ-ㅎ]+$/.test(s);

/**
 * @param {{ title:string, short?:string, keywords?:string }} tool
 * @param {string} term 정규화된 검색어 한 단어
 * @returns {number} 0이면 안 맞음
 */
function termScore(tool, term) {
  const fields = [[tool.title, 10], [tool.keywords ?? '', 5], [tool.short ?? '', 2]];
  let best = 0;
  for (const [text, w] of fields) {
    const n = normalize(text);
    if (!n) continue;
    if (isChosungOnly(term)) {
      if (toChosung(n).includes(term)) best = Math.max(best, w);
    } else if (n.startsWith(term)) best = Math.max(best, w * 1.5);
    else if (n.includes(term)) best = Math.max(best, w);
  }
  return best;
}

/**
 * 띄어 쓴 단어는 모두 맞아야 한다(AND). 점수 높은 순.
 * @template {{ title:string, short?:string, keywords?:string }} T
 * @param {T[]} tools
 * @param {string} query
 * @returns {T[]}
 */
export function searchTools(tools, query, limit = 8) {
  const terms = String(query ?? '').split(/\s+/).map(normalize).filter(Boolean);
  if (!terms.length) return [];
  const scored = [];
  for (const [i, t] of tools.entries()) {
    let total = 0;
    for (const term of terms) {
      const s = termScore(t, term);
      if (!s) { total = 0; break; }
      total += s;
    }
    if (total) scored.push({ t, total, i });
  }
  scored.sort((a, b) => b.total - a.total || a.i - b.i);
  return scored.slice(0, limit).map((x) => x.t);
}
