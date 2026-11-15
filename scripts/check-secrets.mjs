// 스테이징된 변경에서 비밀번호·키·토큰·이메일 등 민감정보를 찾아 커밋을 막는다.
// 오탐이면 해당 줄 끝에 `secret-scan:allow` 주석을 붙인다.
import { execSync } from 'node:child_process';

const git = (args) => execSync(`git ${args}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const BLOCKED_FILES = [
  /(^|\/)\.env(\..*)?$/, /(^|\/)\.dev\.vars$/, /\.(pem|key|p12|pfx|keystore)$/i,
  /(^|\/)id_(rsa|ed25519|ecdsa)/, /credentials.*\.json$/i, /service-account.*\.json$/i, /(^|\/)\.npmrc$/,
];
const SKIP_FILES = [/package-lock\.json$/, /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|wasm)$/i];

const RULES = [
  ['개인키', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS 액세스 키', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub 토큰', /\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}/],
  ['Google API 키', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack 토큰', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Stripe/OpenAI/Anthropic 키', /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}|\bsk-(ant-|proj-)?[A-Za-z0-9_-]{20,}/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['DB 접속 문자열(비밀번호 포함)', /\b[a-z+]+:\/\/[^\s:@\/]+:[^\s@\/]+@/i],
  ['비밀번호/시크릿 대입', /\b(pass(word|wd)?|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*['"`][^'"`\s]{4,}['"`]/i],
  ['이메일 주소', /\b[A-Za-z0-9._%+-]+@(?!example\.(com|org|net)\b)(?![A-Za-z0-9-]*\.?noreply\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
];
const ALLOW_EMAILS = [/noreply@/i, /@users\.noreply\.github\.com$/i, /@example\./i];

const files = git('diff --cached --name-only --diff-filter=ACMR').split('\n').filter(Boolean);
const problems = [];

for (const f of files) {
  if (BLOCKED_FILES.some((r) => r.test(f))) { problems.push(`${f}: 비밀정보 파일은 커밋할 수 없어요`); continue; }
  if (SKIP_FILES.some((r) => r.test(f))) continue;
  const diff = git(`diff --cached -U0 --no-color -- "${f}"`);
  let line = 0;
  for (const raw of diff.split('\n')) {
    const h = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (h) { line = Number(h[1]); continue; }
    if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
    const text = raw.slice(1);
    if (!text.includes('secret-scan:allow')) {
      for (const [name, re] of RULES) {
        const m = text.match(re);
        if (!m) continue;
        if (name === '이메일 주소' && ALLOW_EMAILS.some((a) => a.test(m[0]))) continue;
        problems.push(`${f}:${line}  [${name}]  ${text.trim().slice(0, 120)}`);
      }
    }
    line++;
  }
}

if (problems.length) {
  console.error('\n🚫 커밋 차단: 민감정보로 보이는 내용이 있어요 (public 저장소).\n');
  for (const p of problems) console.error('  ' + p);
  console.error('\n제거 후 다시 커밋하세요. 오탐이면 해당 줄에 `secret-scan:allow` 주석을 붙이세요.\n');
  process.exit(1);
}
