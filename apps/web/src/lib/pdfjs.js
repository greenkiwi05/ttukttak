// pdf.js(pdfjs-dist) 불러오기 공용 함수 (브라우저 전용, 테스트 대상 아님).
// 필요한 페이지에서만 동적 import 한다 (AGENTS.md 원칙 5).

let cached = null;

export async function loadPdfjs() {
  if (cached) return cached;
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  cached = pdfjs;
  return pdfjs;
}

/** 암호 PDF 등 열기 실패 원인을 사람이 읽을 문장으로 */
export function pdfOpenError(e) {
  const msg = String(e?.name ?? '') + String(e?.message ?? '');
  return /password/i.test(msg) ? '암호가 걸린 PDF는 처리할 수 없어요.' : 'PDF를 읽지 못했어요. 파일이 손상되었을 수 있어요.';
}
