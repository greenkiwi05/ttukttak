// PDF 비밀번호 걸기 로직 (순수 함수). 암호화는 qpdf(AES-256)가 lib/qpdf.worker.js 안에서 한다.

/** AES-256 PDF 비밀번호는 UTF-8 127바이트까지 */
export const MAX_BYTES = 127;

export const normalizePassword = (pw) => String(pw ?? '').normalize('NFC');

/**
 * 새 비밀번호 검사
 * @returns {{ ok: boolean, error: string, hints: string[] }} error: 진행할 수 없는 이유, hints: 막지는 않는 참고 사항
 */
export function checkPassword(pw, again) {
  const p = normalizePassword(pw), a = normalizePassword(again);
  const hints = [];
  if (!p) return { ok: false, error: '', hints };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(p)) return { ok: false, error: '비밀번호에 쓸 수 없는 글자가 있어요.', hints };
  if (new TextEncoder().encode(p).length > MAX_BYTES) return { ok: false, error: '비밀번호가 너무 길어요. 더 짧게 정해 주세요.', hints };
  if (p.length < 8) hints.push('8자 이상으로 하면 훨씬 안전해요.');
  if (/^\d+$/.test(p)) hints.push('숫자로만 된 비밀번호(생년월일·전화번호 등)는 쉽게 풀릴 수 있어요.');
  if (p !== p.trim()) hints.push('맨 앞이나 맨 뒤에 띄어쓰기가 있어요.');
  if (/[^ -~]/.test(p)) hints.push('한글 같은 글자는 일부 앱에서 입력하기 어려울 수 있어요. 영문과 숫자를 권해요.');
  if (a && a !== p) return { ok: false, error: '두 비밀번호가 서로 달라요.', hints };
  return { ok: !!a, error: '', hints };
}

/** qpdf 명령. 값은 모두 --이름=값 형태라 '-'나 '@'로 시작하는 비밀번호도 명령으로 오해되지 않는다 */
export function lockArgs(password, current) {
  const p = normalizePassword(password);
  return [...(current ? [`--password=${current}`] : []), '--encrypt', `--user-password=${p}`, `--owner-password=${p}`, '--bits=256', '--', '/in.pdf', '/out.pdf'];
}

/** 결과 파일 이름 */
export const lockedName = (name) => String(name ?? 'pdf').replace(/\.pdf$/i, '') + '_암호.pdf';
