// pdf.js(pdfjs-dist) 불러오기 공용 함수 (브라우저 전용, 테스트 대상 아님).
// 필요한 페이지에서만 동적 import 한다 (AGENTS.md 원칙 5).
// PDF는 반드시 openPdf()로 연다 — 한국어 PDF의 CID 글꼴 문자표(cMap)·기본 글꼴·이미지 해독기 위치를 알려 줘야
// 글자가 사라지지 않는다. 파일은 scripts/copy-pdfjs-assets.mjs가 public/pdfjs/<버전>/ 으로 복사해 둔다.

let cached = null;

export async function loadPdfjs() {
  if (cached) return cached;
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  cached = pdfjs;
  return pdfjs;
}

/** getDocument에 넘길 보조 파일 위치 */
export function pdfAssetOptions(version) {
  const base = `/pdfjs/${version}/`;
  return { cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/', wasmUrl: base + 'wasm/', iccUrl: base + 'iccs/' };
}

/** PDF 열기 (loadingTask를 돌려준다: 다 쓰면 task.destroy()). password는 암호 PDF일 때만 */
export function openPdf(pdfjs, data, password) {
  return pdfjs.getDocument({ data, ...(password ? { password } : {}), ...pdfAssetOptions(pdfjs.version) });
}

/** 열기 실패가 비밀번호 때문인지: 'need'(입력 필요) · 'wrong'(틀림) · ''(다른 이유) */
export function passwordState(e) {
  if (e?.name !== 'PasswordException') return '';
  return e.code === 2 ? 'wrong' : 'need';
}

/** 쪽을 합치거나 나눠도 되는 PDF인지. 권한 목록이 없으면(암호 없음) 허용, 있으면 '내용 수정'이나 '문서 조립' 권한이 있어야 한다 */
export function canRearrange(permissions) {
  return !permissions || permissions.has(0x08) || permissions.has(0x400);
}

/**
 * 암호 PDF → 암호 없는 PDF 바이트 (pdf-lib가 암호 PDF를 열지 못해서 합치기·나누기 전에 쓴다).
 * 문서 하나만 뽑으면 pdf.js가 암호를 유지하므로 빈 쪽 하나를 함께 넣어 뽑는다. 빈 쪽은 맨 뒤라 pages까지만 쓰면 된다.
 * 만든 사람이 편집을 막아 둔 문서는 풀지 않는다(RestrictedError).
 * @param {Uint8Array} blank 빈 쪽 하나짜리 PDF
 * @returns {Promise<{ bytes: Uint8Array, pages: number }>}
 */
export async function decryptPdf(pdfjs, data, password, blank) {
  const task = openPdf(pdfjs, data, password);
  try {
    const doc = await task.promise;
    if (!canRearrange(await doc.getPermissions())) throw Object.assign(new Error('restricted'), { name: 'RestrictedError' });
    const bytes = await doc.extractPages([{ document: null }, { document: blank }]);
    if (!bytes) throw new Error('extract');
    return { bytes, pages: doc.numPages };
  } finally {
    await task.destroy();
  }
}

/** 암호 PDF 등 열기 실패 원인을 사람이 읽을 문장으로 */
export function pdfOpenError(e) {
  const msg = String(e?.name ?? '') + String(e?.message ?? '');
  return /password/i.test(msg) ? '비밀번호가 걸린 PDF예요. 비밀번호를 확인해 주세요.' : 'PDF를 읽지 못했어요. 파일이 손상되었을 수 있어요.';
}
