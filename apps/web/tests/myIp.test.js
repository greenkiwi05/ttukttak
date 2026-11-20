import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ipVersion, isPrivateIp, parseUA, countryName } from '../src/lib/myIp.js';

test('IP 종류', () => {
  assert.equal(ipVersion('203.0.113.7'), 4);
  assert.equal(ipVersion('0.0.0.0'), 4);
  assert.equal(ipVersion('255.255.255.255'), 4);
  assert.equal(ipVersion('256.1.1.1'), null);
  assert.equal(ipVersion('01.2.3.4'), null);
  assert.equal(ipVersion('1.2.3'), null);
  assert.equal(ipVersion('2001:db8::1'), 6);
  assert.equal(ipVersion('2001:0db8:0000:0000:0000:ff00:0042:8329'), 6);
  assert.equal(ipVersion('::1'), 6);
  assert.equal(ipVersion('::ffff:192.0.2.1'), 6);
  assert.equal(ipVersion('2001:db8::1::2'), null);
  assert.equal(ipVersion('2001:db8:1'), null);
  assert.equal(ipVersion('12345::1'), null);
  assert.equal(ipVersion(''), null);
  assert.equal(ipVersion(null), null);
});

test('사설 IP', () => {
  for (const ip of ['10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.0.1', '127.0.0.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1']) assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ['172.32.0.1', '8.8.8.8', '203.0.113.7', '2001:db8::1']) assert.equal(isPrivateIp(ip), false, ip);
});

test('브라우저·운영체제', () => {
  const win = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  assert.deepEqual(parseUA(win), { browser: 'Chrome 131', os: 'Windows 10 또는 11' });
  assert.equal(parseUA(win + ' Edg/131.0.0.0').browser, 'Microsoft Edge 131');
  assert.equal(parseUA(win + ' Whale/4.29.282.14').browser, '네이버 웨일 4');
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  assert.deepEqual(parseUA(iphone), { browser: 'Safari 18', os: 'iOS 18.1 (iPhone)' });
  assert.equal(parseUA(iphone.replace('Safari/604.1', 'KAKAOTALK 10.8.0')).browser, '카카오톡 앱 안 브라우저');
  const samsung = 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36';
  assert.deepEqual(parseUA(samsung), { browser: '삼성 인터넷 26', os: 'Android 14' });
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0';
  assert.deepEqual(parseUA(mac), { browser: 'Firefox 132', os: 'macOS' });
  assert.deepEqual(parseUA(''), { browser: '알 수 없음', os: '알 수 없음' });
});

test('국가 이름', () => {
  assert.equal(countryName('KR'), '대한민국');
  assert.equal(countryName(null), null);
});
