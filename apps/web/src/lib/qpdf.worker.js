// PDF 비밀번호 걸기 작업자: qpdf(WASM, Apache-2.0)를 별도 스레드에서 돌려 큰 파일도 화면이 멈추지 않게 한다.
// 한 번 쓰고 종료하므로 비밀번호와 파일이 메모리에 남지 않는다. 바깥으로 보내는 것은 없다.
import createModule from '@neslinesli93/qpdf-wasm';
import wasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url';
import { lockArgs, normalizePassword } from './pdfLock.js';

self.onmessage = async ({ data }) => {
  try {
    const q = await createModule({ locateFile: () => wasmUrl, noInitialRun: true });
    const run = (args) => { try { return q.callMain(args); } catch { return -1; } };
    q.FS.writeFile('/in.pdf', new Uint8Array(data.bytes));
    const code = run(lockArgs(data.password, data.current)); // 0 성공, 3 경고만 있는 성공
    if (code !== 0 && code !== 3) { self.postMessage({ error: 'encrypt' }); return; }
    // 정말 이 비밀번호로만 열리는지 확인: 맞는 비밀번호는 3(열림), 비밀번호 없이는 열기 실패
    const p = normalizePassword(data.password);
    const opens = run(['--requires-password', `--password=${p}`, '/out.pdf']) === 3;
    const locked = ![0, 3].includes(run(['/out.pdf', '/test.pdf']));
    if (!opens || !locked) { self.postMessage({ error: 'verify' }); return; }
    const out = q.FS.readFile('/out.pdf');
    self.postMessage({ bytes: out }, [out.buffer]);
  } catch {
    self.postMessage({ error: 'load' });
  }
};
