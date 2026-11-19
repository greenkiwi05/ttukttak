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

/** PDF 열기 (loadingTask를 돌려준다: 다 쓰면 task.destroy()) */
export function openPdf(pdfjs, data) {
  return pdfjs.getDocument({ data, ...pdfAssetOptions(pdfjs.version) });
}

/** 암호 PDF 등 열기 실패 원인을 사람이 읽을 문장으로 */
export function pdfOpenError(e) {
  const msg = String(e?.name ?? '') + String(e?.message ?? '');
  return /password/i.test(msg) ? '암호가 걸린 PDF는 처리할 수 없어요.' : 'PDF를 읽지 못했어요. 파일이 손상되었을 수 있어요.';
}
