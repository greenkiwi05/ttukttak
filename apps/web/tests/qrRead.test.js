import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCode, checkUrl, parseFields, cameraMessage, uniqueCodes, scanSizes } from '../src/lib/qrRead.js';
import { buildQrData } from '../src/lib/qr.js';

const val = (r, label) => r.rows.find((x) => x.label === label)?.value;

test('링크: http/https만 열 수 있다', () => {
  const r = parseCode('https://example.com/a?b=1');
  assert.equal(r.kind, 'url');
  assert.equal(r.href, 'https://example.com/a?b=1');
  assert.equal(r.url.host, 'example.com');
  assert.deepEqual(r.url.warnings, []);
  assert.equal(parseCode('  HTTPS://EXAMPLE.COM/A ').href, 'https://example.com/A');
  assert.equal(parseCode('example.com/abc').href, 'https://example.com/abc');
  assert.equal(parseCode('URLTO:제목:https://example.com').href, 'https://example.com/');
});

test('위험한 스킴은 열 수 없는 글자로만', () => {
  for (const s of ['javascript:alert(1)', 'data:text/html,<script>1</script>', 'intent://x#Intent;end', 'file:///etc/passwd', 'market://details?id=x', 'vbscript:x']) {
    const r = parseCode(s);
    assert.equal(r.href, null, s);
    assert.equal(r.kind, /^(intent|market):/.test(s) ? 'scheme' : 'danger', s);
  }
  assert.equal(parseCode('JavaScript:alert(1) // 공백').kind, 'danger');
  assert.equal(parseCode('JavaScript:alert(1)').href, null);
  assert.equal(checkUrl('javascript:alert(1)'), null);
  assert.equal(checkUrl(''), null);
  assert.equal(checkUrl('https://'), null);
});

test('링크 주의점', () => {
  const w = (u) => checkUrl(u).warnings.join(' ');
  assert.match(w('http://example.com'), /http/);
  assert.match(w('https://bit.ly/abc'), /짧은 주소/);
  assert.match(w('https://www.bit.ly/abc'), /짧은 주소/);
  assert.equal(w('https://notbit.ly.example.com/'), '');
  assert.equal(w('https://mybit.ly/'), '');
  assert.match(w('https://192.0.2.1/login'), /IP/);
  assert.match(w('https://naver.com@example.com/'), /@/);
  assert.equal(checkUrl('https://naver.com@example.com/').host, 'example.com');
  assert.match(w('https://xn--80ak6aa92e.com/'), /영문이 아닌/);
  assert.match(w('https://аpple.com/'), /영문이 아닌/); // 키릴 문자 а
  assert.match(w('https://example.com:8443/'), /:8443/);
  assert.match(w('https://example.com/app.apk'), /내려받/);
});

test('QR 만들기 도구가 만든 문자열을 그대로 되읽는다', () => {
  const wifi = parseCode(buildQrData('wifi', { ssid: '카페;우리:집', password: 'p\\a;s:"s,', security: 'WPA' }).data); // secret-scan:allow (특수문자 해석 시험용 가짜 값)
  assert.equal(wifi.kind, 'wifi');
  assert.equal(val(wifi, '이름 (SSID)'), '카페;우리:집');
  assert.equal(val(wifi, '비밀번호'), 'p\\a;s:"s,');
  assert.equal(wifi.copy, 'p\\a;s:"s,');
  assert.equal(wifi.rows.find((x) => x.label === '비밀번호').secret, true);
  const open = parseCode(buildQrData('wifi', { ssid: 'free', security: 'nopass' }).data);
  assert.equal(val(open, '비밀번호'), undefined);
  assert.equal(val(open, '보안 방식'), '없음');
  assert.equal(open.copy, 'free');
  const c = parseCode(buildQrData('contact', { name: '홍길동', phone: '02-000-0000', email: 'a@example.com', org: '뚝딱', url: 'https://example.com' }).data);
  assert.equal(c.kind, 'contact');
  assert.equal(val(c, '이름'), '홍길동');
  assert.equal(val(c, '전화'), '020000000');
  assert.equal(val(c, '이메일'), 'a@example.com');
  assert.equal(val(c, '홈페이지'), 'https://example.com');
  assert.equal(parseCode(buildQrData('tel', { phone: '02-000-0000' }).data).href, 'tel:020000000');
  const sms = parseCode(buildQrData('sms', { phone: '02-000-0000', message: '안녕: 하세요' }).data);
  assert.equal(val(sms, '내용'), '안녕: 하세요');
  assert.equal(sms.href, 'sms:020000000');
  const m = parseCode(buildQrData('email', { email: 'a@example.com', subject: '제목', body: '내용' }).data);
  assert.equal(val(m, '제목'), '제목');
  assert.ok(m.href.startsWith('mailto:a@example.com?'));
  assert.equal(parseCode(buildQrData('url', { url: 'example.com' }).data).kind, 'url');
});

test('vCard·일정·위치·글자', () => {
  const v = parseCode('BEGIN:VCARD\r\nVERSION:3.0\r\nN:홍;길동;;;\r\nFN:홍길동\r\nTEL;TYPE=CELL:02-000-0000\r\nEMAIL;TYPE=INTERNET:a@example.com\r\nORG:뚝딱;개발\r\nEND:VCARD');
  assert.equal(val(v, '이름'), '홍길동');
  assert.equal(val(v, '전화'), '02-000-0000');
  assert.equal(val(v, '회사'), '뚝딱 개발');
  const e = parseCode('BEGIN:VEVENT\nSUMMARY:모임\nDTSTART:20261201T100000\nLOCATION:서울\nEND:VEVENT');
  assert.equal(val(e, '제목'), '모임');
  assert.equal(val(parseCode('geo:37.5,127.0'), '위도'), '37.5');
  assert.equal(parseCode('그냥 글자예요').kind, 'text');
  assert.equal(parseCode('안녕하세요. 반가워요').kind, 'text');
  assert.equal(parseCode('12:30 회의').kind, 'text');
  assert.equal(parseCode('').kind, 'text');
  assert.equal(parseCode('tel:*#06#').href, null); // 특수 코드는 걸지 않음
});

test('바코드는 번호로만 보여 준다', () => {
  const r = parseCode('8801234567893', { barcode: true });
  assert.equal(r.kind, 'barcode');
  assert.equal(r.href, null);
  assert.equal(val(r, '번호·내용'), '8801234567893');
});

test('보조 함수', () => {
  assert.deepEqual(parseFields('S:a\\;b;T:WPA;;'), [['S', 'a;b'], ['T', 'WPA']]);
  assert.match(cameraMessage('NotAllowedError'), /권한/);
  assert.match(cameraMessage('NotFoundError'), /찾지 못/);
  assert.match(cameraMessage('Unsupported'), /브라우저/);
  for (const n of ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'Unsupported', 'Whatever']) assert.match(cameraMessage(n), /사진/);
  assert.equal(uniqueCodes([{ text: 'a' }, { text: 'a' }, { text: 'b' }, { text: '' }]).length, 2);
  assert.deepEqual(scanSizes(1000, 500), [1, 0.8]);
  assert.deepEqual(scanSizes(300, 300), [1]);
  assert.equal(scanSizes(4800, 100)[0], 0.5);
  assert.equal(scanSizes(4800, 100).length, 3);
  assert.deepEqual(scanSizes(0, 0), []);
});
