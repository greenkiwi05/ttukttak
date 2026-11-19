// pdf.js가 PDF를 제대로 읽는 데 필요한 파일을 public/pdfjs/<버전>/ 으로 복사한다 (빌드·개발 서버 시작 전에 자동 실행).
// - cmaps: 한국어 PDF가 많이 쓰는 CID 글꼴의 문자표. 없으면 글자가 통째로 사라진다 (글자 추출 0개, 그림에서도 글자 없음)
// - standard_fonts: PDF에 글꼴이 들어 있지 않을 때 쓰는 기본 글꼴
// - wasm: JPEG2000·JBIG2 이미지 해독기
// - iccs: 색 프로필
// 버전별 폴더라 pdf.js를 올려도 예전 파일이 섞이지 않는다. public/pdfjs/는 gitignore.
// Windows + Node 24.11 한글 경로 문제를 피하려고 재귀 복사(fs.cpSync) 대신 파일 단위로 복사한다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkgPath = require.resolve('pdfjs-dist/package.json');
const root = path.dirname(pkgPath);
const { version } = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const dest = path.join('public', 'pdfjs', version);

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else if (!fs.existsSync(d) || fs.statSync(d).size !== fs.statSync(s).size) fs.copyFileSync(s, d);
  }
}

for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  const src = path.join(root, dir);
  if (fs.existsSync(src)) copyDir(src, path.join(dest, dir));
}
console.log(`pdf.js ${version} 보조 파일 → ${dest}`);
