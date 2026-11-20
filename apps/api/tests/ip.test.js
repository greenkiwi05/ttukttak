import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ipInfo } from '../src/ip.js';

test('Cloudflare 헤더와 cf 정보에서 IP·위치·통신사를 꺼낸다', () => {
  const h = new Headers({ 'cf-connecting-ip': '203.0.113.7' });
  const r = ipInfo(h, { country: 'KR', region: 'Seoul', city: 'Seoul', asOrganization: 'Example Telecom', asn: 64500, colo: 'ICN' });
  assert.deepEqual(r, { ip: '203.0.113.7', country: 'KR', region: 'Seoul', city: 'Seoul', isp: 'Example Telecom', asn: 64500 });
});

test('정보가 없으면 null (로컬 개발 등)', () => {
  const r = ipInfo(new Headers(), undefined);
  assert.deepEqual(r, { ip: null, country: null, region: null, city: null, isp: null, asn: null });
});

test('빈 문자열·이상한 값은 null', () => {
  const r = ipInfo(new Headers({ 'x-real-ip': '2001:db8::1' }), { country: ' ', asn: '123' });
  assert.equal(r.ip, '2001:db8::1');
  assert.equal(r.country, null);
  assert.equal(r.asn, null);
});
