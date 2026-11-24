import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPassword, lockArgs, lockedName, normalizePassword, MAX_BYTES } from '../src/lib/pdfLock.js';

test('새 비밀번호 검사', () => {
  assert.deepEqual(checkPassword('', ''), { ok: false, error: '', hints: [] });
  assert.equal(checkPassword('abcd1234', '').ok, false); // 확인 칸을 채워야 함
  assert.equal(checkPassword('abcd1234', '').error, '');
  assert.deepEqual(checkPassword('abcd1234', 'abcd1234'), { ok: true, error: '', hints: [] });
  assert.match(checkPassword('abcd1234', 'abcd123').error, /서로 달라요/);
  assert.match(checkPassword('a\nb', 'a\nb').error, /쓸 수 없는/);
});

test('참고 사항은 막지 않는다', () => {
  const r = checkPassword('900101', '900101');
  assert.equal(r.ok, true);
  assert.match(r.hints.join(' '), /8자 이상/);
  assert.match(r.hints.join(' '), /숫자로만/);
  assert.match(checkPassword(' abcdefgh', ' abcdefgh').hints.join(' '), /띄어쓰기/);
  assert.match(checkPassword('한글비밀번호여덟자', '한글비밀번호여덟자').hints.join(' '), /한글/);
});

test('길이 제한은 바이트 기준', () => {
  assert.equal(checkPassword('a'.repeat(MAX_BYTES), 'a'.repeat(MAX_BYTES)).ok, true);
  assert.match(checkPassword('a'.repeat(MAX_BYTES + 1), '').error, /너무 길어요/);
  assert.equal(checkPassword('가'.repeat(42), '가'.repeat(42)).ok, true); // 126바이트
  assert.match(checkPassword('가'.repeat(43), '').error, /너무 길어요/);
});

test('풀어쓴 한글(맥)과 모아쓴 한글을 같게', () => {
  const nfd = '한글'.normalize('NFD');
  assert.equal(normalizePassword(nfd), '한글');
  assert.equal(checkPassword(nfd, '한글').ok, true);
});

test('qpdf 명령', () => {
  assert.deepEqual(lockArgs('ab'), ['--encrypt', '--user-password=ab', '--owner-password=ab', '--bits=256', '--', '/in.pdf', '/out.pdf']);
  assert.equal(lockArgs('ab', 'old')[0], '--password=old');
  // '-'·'@'로 시작해도 따로 떨어진 인자가 되지 않는다
  for (const p of ['--help', '@file', '-']) assert.ok(lockArgs(p).every((a) => a !== p));
});

test('파일 이름', () => {
  assert.equal(lockedName('계약서.pdf'), '계약서_암호.pdf');
  assert.equal(lockedName('A.PDF'), 'A_암호.pdf');
  assert.equal(lockedName(undefined), 'pdf_암호.pdf');
});
