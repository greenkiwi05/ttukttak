import { test } from 'node:test';
import assert from 'node:assert/strict';
import { romanizeSyllables, romanizeName, splitName } from '../src/lib/romanize.js';
import { layoutChars, resolveLayout, stampChars } from '../src/lib/stamp.js';

const name = (n, o) => { const r = romanizeName(n, o); return 'error' in r ? r.error : r; };

test('로마자 표기법: 음절 그대로, 받침 ㄹ+ㄹ = ll', () => {
  assert.equal(romanizeSyllables('길동'), 'gildong');
  assert.equal(romanizeSyllables('길동', { hyphen: true }), 'gil-dong');
  assert.equal(romanizeSyllables('복남'), 'boknam'); // 이름은 음운 변화 미반영 (Bongnam 아님)
  assert.equal(romanizeSyllables('설리'), 'seolli');
  assert.equal(romanizeSyllables('한별'), 'hanbyeol');
  assert.equal(romanizeSyllables('의정'), 'uijeong');
  assert.equal(romanizeSyllables('서연'), 'seoyeon');
  assert.equal(romanizeSyllables('외솔'), 'oesol');
  assert.equal(romanizeSyllables('찬희'), 'chanhui');
});

test('이름 전체: 관례 성 표기, 여러 형식', () => {
  const r = name('홍길동');
  assert.equal(r.passport, 'HONG GILDONG');
  assert.equal(r.western, 'Gildong Hong');
  assert.equal(r.korean, 'Hong Gildong');
  assert.equal(name('김민준').korean, 'Kim Minjun');
  assert.equal(name('이서연').korean, 'Lee Seoyeon');
  assert.deepEqual(name('이서연').surnameOptions, ['Lee', 'Yi', 'Rhee', 'I']);
  assert.equal(name('이서연', { surnameSpelling: 'Yi' }).korean, 'Yi Seoyeon');
  assert.equal(name('정하은', { hyphen: true }).korean, 'Jung Ha-eun');
  assert.equal(name('류현진').korean, 'Ryu Hyeonjin');
  assert.equal(name('뢰식').korean, 'Roe Sik'); // 목록에 없는 성은 표기법대로
});

test('복성과 띄어쓰기', () => {
  assert.deepEqual(splitName('남궁민수'), { surname: '남궁', given: '민수' });
  assert.deepEqual(splitName('선우 진'), { surname: '선우', given: '진' });
  assert.deepEqual(splitName('남 궁민'), { surname: '남', given: '궁민' });
  assert.equal(name('남궁민수').passport, 'NAMGUNG MINSU');
  assert.equal(name('').valueOf(), '이름을 입력해 주세요.');
  assert.ok(String(name('John')).includes('한글'));
  assert.ok(String(name('김')).includes('성과 이름'));
});

test('도장 배치: 자동, 3글자 2단, 오른쪽 줄부터', () => {
  assert.equal(resolveLayout(2), 'col');
  assert.equal(resolveLayout(3), 'grid');
  assert.equal(resolveLayout(1, 'grid'), 'col');
  const g4 = layoutChars(['홍', '길', '동', '인'], 'grid');
  assert.ok(g4[0].cx > 0.5 && g4[0].cy < 0.5); // 첫 글자: 오른쪽 위
  assert.ok(g4[1].cx > 0.5 && g4[1].cy > 0.5); // 오른쪽 아래
  assert.ok(g4[2].cx < 0.5 && g4[2].cy < 0.5); // 왼쪽 위
  const g3 = layoutChars(['홍', '길', '동'], 'auto');
  assert.ok(g3[0].h > g3[1].h); // 성은 크게
  const row = layoutChars(['가', '나'], 'row');
  assert.ok(row[0].cx < row[1].cx && row[0].cy === row[1].cy);
  for (const c of g4) assert.ok(c.cx > 0 && c.cx < 1 && c.cy > 0 && c.cy < 1);
});

test('도장 글자 준비', () => {
  assert.deepEqual(stampChars('홍길동', true).chars, ['홍', '길', '동', '인']);
  assert.deepEqual(stampChars('남궁민수', true).chars, ['남', '궁', '민', '수']); // 4자면 '인' 생략
  assert.ok(stampChars('').error);
  assert.ok(stampChars('가나다라마').error);
});
