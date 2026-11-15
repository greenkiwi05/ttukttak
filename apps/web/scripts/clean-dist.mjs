// 빌드 전에 dist/를 지운다.
// Windows + Node 24.11에서 fs.rmSync(recursive)가 한글이 들어간 경로(C:\Users\<한글 이름>\...)에서
// 프로세스째 크래시하는 문제가 있어, Astro가 이전 dist를 지우다 죽는다.
// 파일 단위로 직접 지워서 피한다. 다른 OS(Cloudflare 빌드 등)에서도 무해하다.
import fs from 'node:fs';
import path from 'node:path';

function del(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) del(p);
    else fs.unlinkSync(p);
  }
  fs.rmdirSync(dir);
}

if (fs.existsSync('dist')) del('dist');
