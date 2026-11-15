// 브라우저 다운로드 헬퍼 (DOM 사용, 테스트 대상 아님).

/** Blob을 파일로 저장 */
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 여러 파일 → ZIP 하나로 저장. fflate는 필요할 때만 불러온다. */
export async function downloadZip(entries, zipName) {
  const { zipSync } = await import('fflate');
  const files = {};
  for (const e of entries) files[e.name] = [new Uint8Array(await e.blob.arrayBuffer()), { level: 0 }];
  downloadBlob(new Blob([zipSync(files)], { type: 'application/zip' }), zipName);
}
