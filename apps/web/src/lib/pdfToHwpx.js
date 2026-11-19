// PDF → 한글(HWPX) 변환의 순수 로직.
// PDF에는 "글자를 어디에 찍는지"만 있으므로, 글자 조각을 줄 → 문단·제목으로 묶고 그림과 함께 HTML로 만든다.
// HTML → HWPX는 hwp-convert(MIT)가 하고, 쪽 나눔은 만들어진 문서(section0.xml)에 직접 넣는다.

export const PAGE_MARK = '@@뚝딱쪽나눔@@';

const quantile = (arr, q) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) * q)];
};
const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * pdf.js 글자 조각 → 줄 (위에서 아래 순)
 * @param {{ str: string, transform: number[], width?: number, height?: number }[]} items
 * @returns {{ y: number, x: number, end: number, size: number, text: string }[]}  y는 PDF 좌표(아래가 0), end는 줄 끝 x
 */
export function groupLines(items) {
  const parts = items
    .filter((it) => it && typeof it.str === 'string' && it.str.length && Array.isArray(it.transform))
    .map((it) => {
      const [a, b, c, d, e, f] = it.transform;
      const size = Math.abs(it.height) || Math.hypot(c, d) || Math.hypot(a, b) || 10;
      return { x: e, y: f, size, w: it.width ?? it.str.length * size * 0.5, str: it.str };
    })
    .sort((p, q) => q.y - p.y || p.x - q.x);
  const rows = [];
  for (const p of parts) {
    const row = rows.find((l) => Math.abs(l.y - p.y) <= Math.max(l.size, p.size) * 0.45);
    if (row) {
      // 디자인 효과(그림자·외곽선)로 같은 글자를 거의 같은 자리에 다시 찍은 것은 한 번만
      if (row.parts.some((q) => q.str === p.str && Math.abs(q.x - p.x) < p.size * 0.6)) continue;
      row.parts.push(p);
      row.size = Math.max(row.size, p.size);
    } else rows.push({ y: p.y, size: p.size, parts: [p] });
  }
  // 같은 높이라도 가로로 크게 떨어진 글자(다른 단·표의 다른 칸)는 따로 뗀다
  const lines = [];
  for (const r of rows) {
    r.parts.sort((p, q) => p.x - q.x);
    let seg = null;
    for (const p of r.parts) {
      if (seg && p.x - seg.end > r.size * 2.2) { lines.push(seg); seg = null; }
      if (!seg) seg = { y: r.y, x: p.x, end: p.x, size: r.size, text: '' };
      if (seg.text && p.x - seg.end > r.size * 0.25 && !/\s$/.test(seg.text) && !/^\s/.test(p.str)) seg.text += ' ';
      seg.text += p.str;
      seg.end = Math.max(seg.end, p.x + p.w);
    }
    if (seg) lines.push(seg);
  }
  return lines
    .map((l) => ({ ...l, size: Math.round(l.size * 10) / 10, text: l.text.replace(/\s+/g, ' ').trim() }))
    .filter((l) => l.text)
    .sort((p, q) => q.y - p.y || p.x - q.x);
}

/**
 * 두 단 배치 읽는 순서: 여러 줄이 같은 x 근처에서 갈라지면 두 단으로 보고,
 * 단 전체에 걸친 줄(제목 등) 사이 구간마다 왼쪽 단 → 오른쪽 단 순서로 읽는다.
 * 각 줄에 col('L' | 'R' | 'S')을 붙인다 (한 단 문서면 그대로 돌려준다).
 */
export function orderColumns(lines) {
  const byRow = new Map();
  for (const l of lines) { const k = Math.round(l.y); byRow.set(k, [...(byRow.get(k) ?? []), l]); }
  const cands = [];
  for (const segs of byRow.values()) {
    if (segs.length < 2) continue;
    segs.sort((a, b) => a.x - b.x);
    for (let i = 1; i < segs.length; i++) cands.push((segs[i - 1].end + segs[i].x) / 2);
  }
  let best = null, bestN = 0;
  for (const c of cands) {
    const n = cands.filter((d) => Math.abs(d - c) <= 25).length;
    if (n > bestN) { best = c; bestN = n; }
  }
  if (bestN < 3) return lines;
  const B = best;
  const col = (l) => (l.end <= B + 10 ? 'L' : l.x >= B - 10 ? 'R' : 'S');
  const out = [];
  let band = [];
  const flush = () => {
    out.push(...band.filter((l) => l.col === 'L'), ...band.filter((l) => l.col === 'R'));
    band = [];
  };
  for (const l of [...lines].sort((p, q) => q.y - p.y || p.x - q.x)) {
    const t = { ...l, col: col(l) };
    if (t.col === 'S') { flush(); out.push(t); } else band.push(t);
  }
  flush();
  return out;
}

const BULLET = /^([•·◦▪■□○●\-–*]|\d{1,3}[.)]|[가-하][.)]|\(\d{1,3}\)|[①-⑳])\s?/;

/**
 * 줄 → 문단·제목. 줄 간격이 벌어지거나, 글자 크기가 바뀌거나, 목록 기호로 시작하면 새 문단.
 * @param {{ y: number, x: number, size: number, text: string }[]} lines 위에서 아래 순
 * @param {number} [body] 본문 글자 크기 (없으면 줄들의 중앙값)
 * @returns {{ type: 'h' | 'p', level?: number, text: string, y: number }[]}
 */
export function toBlocks(lines, body) {
  if (!lines.length) return [];
  const bodySize = body || median(lines.map((l) => l.size));
  const gaps = [];
  for (let i = 1; i < lines.length; i++) if (Math.abs(lines[i].size - bodySize) < 0.5) gaps.push(lines[i - 1].y - lines[i].y);
  // 보통 줄 간격: 문단 사이 간격이 섞여 있으므로 중앙값이 아니라 아래쪽(25%) 값을 쓴다
  const lineGap = quantile(gaps.filter((g) => g > 0), 0.25) || bodySize * 1.5;
  // 꽉 찬 줄의 오른쪽 끝 (이보다 한참 짧게 끝난 줄 다음은 새 문단) — 두 단이면 단마다 따로
  const edge = {};
  for (const c of new Set(lines.map((l) => l.col ?? ''))) {
    const ls = lines.filter((l) => (l.col ?? '') === c && typeof l.end === 'number');
    edge[c] = ls.length >= 3 ? { full: quantile(ls.map((l) => l.end), 0.9), left: quantile(ls.map((l) => l.x), 0.1) } : null;
  }
  const kindOf = (l) => (l.size >= bodySize * 1.25 ? { type: 'h', level: l.size >= bodySize * 1.6 ? 2 : 3 } : { type: 'p' });
  const blocks = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const k = kindOf(l);
    const prev = lines[i - 1];
    const gap = prev ? prev.y - l.y : 0;
    const e = prev ? edge[prev.col ?? ''] : null;
    const shortPrev = !!e && typeof prev.end === 'number' && e.full - prev.end > (e.full - e.left) * 0.15;
    const sameCol = !prev || (prev.col ?? '') === (l.col ?? '');
    const same = cur && sameCol && cur.type === k.type && cur.level === k.level && gap > 0 && gap <= lineGap * 1.35 && !BULLET.test(l.text) && Math.abs(prev.size - l.size) < 0.6 && !shortPrev;
    if (same) {
      // 줄 끝이 하이픈으로 끊긴 영어 단어는 붙이고, 나머지는 띄어서 이어 붙인다
      cur.text = /[A-Za-z]-$/.test(cur.text) ? cur.text.slice(0, -1) + l.text : cur.text + ' ' + l.text;
    } else {
      cur = { ...k, text: l.text, y: l.y };
      blocks.push(cur);
    }
  }
  return blocks;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 쪽별 문단·그림 → HTML (쪽 사이에는 쪽 나눔 표시 문단)
 * @param {{ blocks: { type: string, level?: number, text: string, y: number }[], images?: { y: number, src: string, width: number }[] }[]} pages
 */
export function buildHtml(pages) {
  const out = [];
  pages.forEach((pg, i) => {
    if (i > 0) out.push(`<p>${PAGE_MARK}</p>`);
    const items = [...pg.blocks.map((b) => ({ y: b.y, b })), ...(pg.images ?? []).map((im) => ({ y: im.y, im }))].sort((p, q) => q.y - p.y);
    // 쪽의 첫 내용이 그림이면 쪽 나눔 뒤 빈 쪽이 생길 수 있어서, 글이 있는 쪽은 첫 글 뒤로 그림을 옮긴다
    const firstText = items.findIndex((x) => x.b);
    if (firstText > 0) items.unshift(...items.splice(firstText, 1));
    // 글자 없이 그림만 있는 쪽(스캔)은 맨 위에 "N쪽"을 넣는다 — 그림이 쪽의 첫 내용이면 쪽 나눔 뒤 빈 쪽이 생기는 문제를 막고, 몇 쪽인지도 보이게
    if (!pg.blocks.length && items.length) out.push(`<p>${i + 1}쪽</p>`);
    for (const it of items) {
      if (it.im) out.push(`<p><img src="${it.im.src}" width="${Math.round(it.im.width)}" alt=""></p>`);
      else if (it.b.type === 'h') out.push(`<h${it.b.level}>${esc(it.b.text)}</h${it.b.level}>`);
      else out.push(`<p>${esc(it.b.text)}</p>`);
    }
    if (!items.length) out.push('<p></p>');
  });
  return out.join('\n');
}

/**
 * HWPX 본문(section0.xml)의 쪽 나눔 표시 문단을 빈 문단으로 바꾸고 그 문단에 쪽 나눔(pageBreak="1")을 건다.
 * (문단을 지우면 뒤 문단들의 줄 배치 정보(linesegarray)가 어긋나서 지우지 않는다)
 * @returns {{ xml: string, breaks: number }}
 */
export function insertPageBreaks(xml) {
  let breaks = 0;
  for (;;) {
    const at = xml.indexOf(PAGE_MARK);
    if (at < 0) break;
    const start = xml.lastIndexOf('<hp:p ', at);
    if (start < 0) break;
    const tagEnd = xml.indexOf('>', start);
    const tag = xml.slice(start, tagEnd).replace(/pageBreak="0"/, 'pageBreak="1"');
    xml = xml.slice(0, start) + tag + xml.slice(tagEnd);
    const at2 = xml.indexOf(PAGE_MARK, start);
    xml = xml.slice(0, at2) + xml.slice(at2 + PAGE_MARK.length);
    breaks++;
  }
  return { xml, breaks };
}

/** 미리보기 글(Preview/PrvText.txt)에 남은 쪽 나눔 표시 지우기 */
export const cleanPreview = (text) => String(text).split(PAGE_MARK).join('').replace(/(\r?\n){3,}/g, '\r\n\r\n');

/**
 * 한 쪽의 그림 고르기
 * - 글이 있는 쪽에서 쪽 면적의 절반 넘게 덮는 그림은 배경으로 보고 뺀다 (브로슈어 배경 사진 등)
 * - 같은 그림을 여러 번 그린 것은 한 번만
 * @param {{ key?: string, wPt: number, hPt: number }[]} images
 */
export function selectImages(images, pageW, pageH, hasText) {
  const seen = new Set();
  return images.filter((im) => {
    if (hasText && im.wPt * im.hPt > pageW * pageH * 0.5) return false;
    if (im.key) { if (seen.has(im.key)) return false; seen.add(im.key); }
    return true;
  });
}

/** 그림을 넣을지: 너무 작은 것(아이콘·선)은 뺀다 (PDF 단위 pt) */
export const keepImage = (w, h) => w >= 40 && h >= 40;

/** 한글 문서에 넣을 그림 너비(px): 최대 480×420px (쪽 높이를 넘으면 다음 쪽으로 밀려 빈 쪽이 생기고, 크면 쪽 수가 크게 늘어난다) */
export function fitWidth(wPx, hPx, maxW = 480, maxH = 420) {
  if (!(wPx > 0) || !(hPx > 0)) return Math.min(maxW, wPx || maxW);
  return Math.round(Math.min(wPx, maxW, (maxH * wPx) / hPx));
}

export const hwpxOutName = (name) => name.replace(/\.pdf$/i, '') + '.hwpx';
