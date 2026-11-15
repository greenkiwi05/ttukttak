import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countText, cutTo } from '../src/lib/charCount.js';
import { buildQrData, escapeQr } from '../src/lib/qr.js';
import { pageLayout, MM, PAGE_SIZES } from '../src/lib/pdfLayout.js';
import { targetSize, renameExt } from '../src/lib/resize.js';
import { readMeta, stripMeta, fileKind } from '../src/lib/exif.js';
import { solarToLunar, lunarToSolar, lunarBirthdays } from '../src/lib/lunar.js';
import { makeLadder, trace, mapping } from '../src/lib/ladder.js';
import { parseList, shuffle, pick, teams, duplicates } from '../src/lib/randomPick.js';

// 결정적인 난수 (테스트용)
function seeded(seed = 42) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// ── 글자수
test('글자수: 공백 포함·제외, 바이트', () => {
  const r = countText('안녕 하세요');
  assert.equal(r.chars, 6);
  assert.equal(r.charsNoSpace, 5);
  assert.equal(r.bytesUtf8, 16);
  assert.equal(r.bytesKr, 11);
  assert.equal(r.words, 2);
});

test('글자수: 이모지 1자, 줄바꿈, 문단, 빈 문자열', () => {
  assert.equal(countText('👍🏽a').chars, 2);
  const r = countText('첫 문단\r\n둘째 줄\n\n둘째 문단');
  assert.equal(r.lines, 4);
  assert.equal(r.paragraphs, 2);
  assert.equal(r.chars, 16);
  assert.equal(r.bytesKr, countText('첫 문단').bytesKr + 2 + countText('둘째 줄').bytesKr + 4 + countText('둘째 문단').bytesKr);
  assert.deepEqual(countText(''), { chars: 0, charsNoSpace: 0, bytesUtf8: 0, bytesKr: 0, words: 0, lines: 0, paragraphs: 0, manuscript: 0 });
  assert.equal(countText('가'.repeat(201)).manuscript, 2);
  assert.equal(cutTo('👍🏽가나다', 2), '👍🏽가');
});

// ── QR
test('QR: 링크·와이파이·연락처 형식과 이스케이프', () => {
  assert.equal(buildQrData('url', { url: 'ttukttaktools.com' }).data, 'https://ttukttaktools.com');
  assert.equal(buildQrData('url', { url: 'http://a.com' }).data, 'http://a.com');
  assert.equal(escapeQr('a;b,c:d"e\\'), 'a\\;b\\,c\\:d\\"e\\\\');
  assert.equal(buildQrData('wifi', { ssid: 'My;Home', password: 'p:w', security: 'WPA' }).data, 'WIFI:T:WPA;S:My\\;Home;P:p\\:w;;');
  assert.equal(buildQrData('wifi', { ssid: 'Cafe', security: 'nopass' }).data, 'WIFI:T:nopass;S:Cafe;;');
  assert.ok(buildQrData('wifi', { ssid: 'x', security: 'WPA' }).error);
  assert.equal(buildQrData('tel', { phone: '010-1234-5678' }).data, 'tel:01012345678');
  assert.equal(buildQrData('email', { email: 'a@example.com', subject: '안녕' }).data, 'mailto:a@example.com?subject=%EC%95%88%EB%85%95');
  assert.equal(buildQrData('contact', { name: '홍길동', phone: '010 1111 2222' }).data, 'MECARD:N:홍길동;TEL:01011112222;;');
  assert.ok(buildQrData('email', { email: 'nope' }).error);
  assert.ok(buildQrData('text', { text: '  ' }).error);
});

// ── PDF 배치
test('PDF 배치: A4 여백 안에 비율 유지, 가운데 정렬, 가로 사진은 가로 페이지', () => {
  const p = pageLayout(1000, 2000, { page: 'a4', marginMm: 10 });
  assert.equal(p.pageW, PAGE_SIZES.a4.w);
  assert.ok(Math.abs(p.h - 277 * MM) < 1e-6); // 세로가 꽉 참
  assert.ok(Math.abs(p.w / p.h - 0.5) < 1e-9);
  assert.ok(Math.abs(p.x * 2 + p.w - p.pageW) < 1e-6);
  const l = pageLayout(3000, 2000, { page: 'a4' });
  assert.ok(l.pageW > l.pageH);
  const port = pageLayout(3000, 2000, { page: 'a4', orientation: 'portrait' });
  assert.ok(port.pageW < port.pageH);
  assert.deepEqual(pageLayout(800, 600, { page: 'fit' }), { pageW: 600, pageH: 450, x: 0, y: 0, w: 600, h: 450 });
});

// ── 크기 조절
test('크기 조절: 비율·가로·세로·상자·확대 금지', () => {
  assert.deepEqual(targetSize(4000, 3000, { mode: 'percent', percent: 50 }), { w: 2000, h: 1500 });
  assert.deepEqual(targetSize(4000, 3000, { mode: 'width', width: 1080 }), { w: 1080, h: 810 });
  assert.deepEqual(targetSize(4000, 3000, { mode: 'height', height: 600 }), { w: 800, h: 600 });
  assert.deepEqual(targetSize(4000, 3000, { mode: 'box', width: 1000, height: 1000 }), { w: 1000, h: 750 });
  assert.deepEqual(targetSize(400, 300, { mode: 'width', width: 800, noUpscale: true }), { w: 400, h: 300 });
  assert.deepEqual(targetSize(400, 300, { mode: 'exact', width: 100, height: 100 }), { w: 100, h: 100 });
  assert.ok(targetSize(400, 300, { mode: 'width' }).error);
  assert.ok(targetSize(400, 300, { mode: 'percent', percent: 10000 }).error);
  assert.equal(renameExt('a.b.HEIC', 'jpg'), 'a.b.jpg');
});

// ── EXIF
function tiffWithGps() {
  // 빅엔디언 TIFF: IFD0(Make, Orientation=6, GPS 포인터) + GPS IFD(N 37°33'36", E 126°58'41.4")
  const b = [];
  const u16 = (v) => b.push(v >> 8, v & 255);
  const u32 = (v) => b.push((v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255);
  b.push(0x4d, 0x4d); u16(42); u32(8);
  // IFD0 @8: 3 entries → 8 + 2 + 36 + 4 = 50, Make 데이터 @50 ("Apple\0"), GPS IFD @56
  u16(3);
  u16(0x010f); u16(2); u32(6); u32(50);
  u16(0x0112); u16(3); u32(1); u16(6); u16(0);
  u16(0x8825); u16(4); u32(1); u32(56);
  u32(0);
  b.push(...[...'Apple'].map((c) => c.charCodeAt(0)), 0);
  // GPS IFD @56: 4 entries → 56 + 2 + 48 + 4 = 110, 위도 데이터 @110 (24바이트), 경도 @134
  u16(4);
  u16(1); u16(2); u32(2); b.push(0x4e, 0, 0, 0);
  u16(2); u16(5); u32(3); u32(110);
  u16(3); u16(2); u32(2); b.push(0x45, 0, 0, 0);
  u16(4); u16(5); u32(3); u32(134);
  u32(0);
  for (const [n, d] of [[37, 1], [33, 1], [36, 1]]) { u32(n); u32(d); }
  for (const [n, d] of [[126, 1], [58, 1], [414, 10]]) { u32(n); u32(d); }
  return b;
}
function seg(marker, payload) {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 255, ...payload];
}
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
function sampleJpeg() {
  return new Uint8Array([
    0xff, 0xd8,
    ...seg(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...seg(0xe1, [...ascii('Exif'), 0, 0, ...tiffWithGps()]),
    ...seg(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1]),
    ...seg(0xfe, ascii('secret note')),
    ...seg(0xdb, [0, 1, 2]),
    0xff, 0xda, 0, 4, 9, 9, 0x11, 0x22, 0xff, 0x00, 0x33, 0xff, 0xd9,
  ]);
}

test('EXIF: GPS·기기·회전 정보 읽기', () => {
  const m = readMeta(sampleJpeg());
  assert.equal(m.kind, 'jpeg');
  assert.equal(m.make, 'Apple');
  assert.equal(m.orientation, 6);
  assert.ok(Math.abs(m.gps.lat - 37.56) < 1e-9);
  assert.ok(Math.abs(m.gps.lon - (126 + 58 / 60 + 41.4 / 3600)) < 1e-9);
  assert.deepEqual(m.found, ['EXIF', '주석']);
});

test('EXIF 지우기: GPS·주석 제거, ICC·영상 데이터 유지, 회전 정보만 남김', () => {
  const src = sampleJpeg();
  const out = stripMeta(src);
  const m = readMeta(out);
  assert.equal(m.gps, null);
  assert.equal(m.make, undefined);
  assert.equal(m.orientation, 6);
  assert.deepEqual(m.found, ['EXIF']);
  const s = Buffer.from(out).toString('latin1');
  assert.ok(s.includes('ICC_PROFILE') && s.includes('JFIF'));
  assert.ok(!s.includes('secret note') && !s.includes('Apple'));
  const tail = Buffer.from(src.subarray(src.indexOf(0xda) - 1)).toString('hex');
  assert.ok(Buffer.from(out).toString('hex').endsWith(tail));
  // 회전 정보도 지우는 옵션
  const bare = readMeta(stripMeta(src, { keepOrientation: false }));
  assert.deepEqual(bare.found, []);
  assert.equal(bare.orientation, 1);
});

test('EXIF: PNG 텍스트 청크 제거, 다른 형식은 거절', () => {
  const chunk = (type, data) => [0, 0, 0, data.length, ...ascii(type), ...data, 0, 0, 0, 0];
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, ...chunk('IHDR', [1, 2, 3]), ...chunk('tEXt', ascii('GPS')), ...chunk('IDAT', [7]), ...chunk('IEND', [])]);
  assert.equal(fileKind(png), 'png');
  assert.deepEqual(readMeta(png).found, ['PNG tEXt']);
  const out = stripMeta(png);
  assert.equal(out.length, png.length - 15);
  assert.deepEqual(readMeta(out).found, []);
  assert.throws(() => stripMeta(new Uint8Array([1, 2, 3, 4])));
});

// ── 음력
test('음력: 설날·추석·간지', () => {
  const s = solarToLunar(2026, 2, 17);
  assert.deepEqual(s.lunar, { year: 2026, month: 1, day: 1, leap: false });
  assert.equal(s.gapja, '병오년');
  assert.equal(lunarToSolar(2026, 8, 15).solar, '2026-09-25');
  assert.equal(lunarToSolar(2025, 6, 1, true).solar, '2025-07-25');
  assert.ok(lunarToSolar(2026, 6, 1, true).error.includes('윤6월'));
  assert.ok(solarToLunar(2051, 1, 1).error);
});

test('음력 생일표: 윤달은 평달로, 30일이 없으면 29일로', () => {
  const r = lunarBirthdays(6, 10, true, 2025, 3);
  assert.equal(r.length, 3);
  assert.equal(r[0].note, '');
  assert.equal(r[1].note, '윤달 없음 → 평달');
  const t = lunarBirthdays(1, 30, false, 2020, 10);
  assert.equal(t.length, 10);
  assert.ok(t.some((x) => x.note.includes('29일')));
});

// ── 사다리
test('사다리: 가로줄이 붙지 않고, 칸마다 최소 1개, 결과는 1:1', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const n = 2 + (seed % 11);
    const l = makeLadder(n, 10, seeded(seed));
    for (const row of l.rungs) for (let i = 1; i < row.length; i++) assert.ok(!(row[i] && row[i - 1]));
    for (let i = 0; i < n - 1; i++) assert.ok(l.rungs.some((row) => row[i]), `seed ${seed} gap ${i}`);
    const m = mapping(l);
    assert.deepEqual([...m].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i));
  }
  const t = trace({ n: 2, rows: 1, rungs: [[true]] }, 0);
  assert.equal(t.end, 1);
  assert.deepEqual(t.path, [{ col: 0, row: 0 }, { col: 0, row: 0.5 }, { col: 1, row: 0.5 }, { col: 1, row: 1 }]);
});

// ── 제비뽑기
test('제비뽑기: 목록 파싱, 중복 없는 뽑기, 팀 나누기', () => {
  assert.deepEqual(parseList(' 가, 나\n\n다 ,'), ['가', '나', '다']);
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const s = shuffle(names, seeded(7));
  assert.deepEqual([...s].sort(), names);
  const p = pick(names, 3, seeded(3));
  assert.equal(new Set(p.winners).size, 3);
  assert.ok(pick(names, 8).error);
  const t = teams(names, 3, seeded(5)).teams;
  assert.deepEqual(t.map((x) => x.length), [3, 2, 2]);
  assert.deepEqual(t.flat().sort(), names);
  assert.ok(teams(names, 1).error);
  assert.deepEqual(duplicates(['a', 'b', 'a']), ['a']);
});
