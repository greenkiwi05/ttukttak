// 파일 목록 검증·이름 처리 (HEIC 변환, PDF 합치기 등 파일 도구 공용).

/**
 * @param {{ name:string, size:number }[]} files
 * @param {{ exts:string[], maxSize:number, maxCount:number, already?:number }} rule
 * @returns {{ accepted:any[], rejected:{ file:any, reason:string }[] }}
 */
export function filterFiles(files, { exts, maxSize, maxCount, already = 0 }) {
  const accepted = [], rejected = [];
  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!exts.includes(ext)) rejected.push({ file: f, reason: `${exts.map((e) => e.toUpperCase()).join('·')} 파일만 넣을 수 있어요` });
    else if (f.size > maxSize) rejected.push({ file: f, reason: `${Math.round(maxSize / 1024 / 1024)}MB를 넘어요` });
    else if (already + accepted.length >= maxCount) rejected.push({ file: f, reason: `한 번에 ${maxCount}개까지 넣을 수 있어요` });
    else accepted.push(f);
  }
  return { accepted, rejected };
}

/** 같은 이름이 겹치면 a.jpg, a (2).jpg, a (3).jpg … */
export function uniqueNames(names) {
  const seen = new Map();
  return names.map((n) => {
    const key = n.toLowerCase();
    const c = (seen.get(key) || 0) + 1;
    seen.set(key, c);
    return c === 1 ? n : n.replace(/(\.[^.]+)?$/, (ext) => ` (${c})${ext || ''}`);
  });
}
