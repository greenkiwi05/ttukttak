import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPdf, passwordState, canRearrange, pdfOpenError, decryptPdf } from '../src/lib/pdfjs.js';

const ex = (code) => Object.assign(new Error('No password given'), { name: 'PasswordException', code });

test('열기 실패가 비밀번호 때문인지 구분', () => {
  assert.equal(passwordState(ex(1)), 'need');
  assert.equal(passwordState(ex(2)), 'wrong');
  assert.equal(passwordState(new Error('Invalid PDF')), '');
  assert.equal(passwordState(null), '');
  assert.match(pdfOpenError(ex(1)), /비밀번호/);
  assert.match(pdfOpenError(new Error('x')), /손상/);
});

test('비밀번호는 있을 때만 넘긴다', () => {
  const calls = [];
  const fake = { version: '0', getDocument: (o) => (calls.push(o), {}) };
  openPdf(fake, 'd');
  openPdf(fake, 'd', '');
  openPdf(fake, 'd', 'abc');
  assert.equal('password' in calls[0], false);
  assert.equal('password' in calls[1], false);
  assert.equal(calls[2].password, 'abc');
});

test('합치기·나누기 허용 여부', () => {
  assert.equal(canRearrange(null), true); // 암호 없음
  assert.equal(canRearrange(new Set([4, 8, 16])), true); // 내용 수정 허용
  assert.equal(canRearrange(new Set([4, 0x400])), true); // 문서 조립 허용
  assert.equal(canRearrange(new Set([4])), false); // 인쇄만 허용
  assert.equal(canRearrange(new Set()), false);
});

test('암호 풀기: 빈 쪽을 함께 뽑고, 편집이 막힌 문서는 거절하고, 항상 정리한다', async () => {
  const make = (perm) => {
    const st = { destroyed: 0, args: null };
    const doc = { numPages: 3, getPermissions: async () => perm, extractPages: async (a) => ((st.args = a), new Uint8Array([1])) };
    return { st, lib: { version: '0', getDocument: () => ({ promise: Promise.resolve(doc), destroy: async () => { st.destroyed++; } }) } };
  };
  const ok = make(new Set([8]));
  assert.deepEqual(await decryptPdf(ok.lib, 'd', 'p', 'BLANK'), { bytes: new Uint8Array([1]), pages: 3 });
  assert.deepEqual(ok.st.args, [{ document: null }, { document: 'BLANK' }]);
  assert.equal(ok.st.destroyed, 1);
  const no = make(new Set([4]));
  await assert.rejects(decryptPdf(no.lib, 'd', 'p', 'BLANK'), { name: 'RestrictedError' });
  assert.equal(no.st.args, null);
  assert.equal(no.st.destroyed, 1);
});
