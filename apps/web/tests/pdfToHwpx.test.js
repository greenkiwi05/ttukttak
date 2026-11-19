import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupLines, toBlocks, buildHtml, insertPageBreaks, keepImage, hwpxOutName, PAGE_MARK } from '../src/lib/pdfToHwpx.js';

// pdf.js 글자 조각 흉내: transform = [크기, 0, 0, 크기, x, y]
const it = (str, x, y, size = 10, width) => ({ str, transform: [size, 0, 0, size, x, y], height: size, width: width ?? str.length * size * 0.9 });

test('글자 조각 → 줄: 같은 높이끼리, 왼쪽부터, 띄어쓰기 복원', () => {
  const lines = groupLines([
    it('세계', 150, 700, 10, 20), it('안녕', 100, 700, 10, 20), it('하세요', 120, 700.8, 10, 18),
    it('둘째 줄', 100, 685),
    it('', 100, 600),
  ]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].text, '안녕하세요 세계'); // 하세요 끝(138)과 세계(150) 사이가 벌어져 띄어쓰기, 안녕(120)·하세요(120)는 붙음
  assert.equal(lines[1].text, '둘째 줄');
  assert.ok(lines[0].y > lines[1].y);
});

test('줄 → 문단·제목', () => {
  const L = (text, y, size = 10) => ({ text, y, x: 100, size });
  const blocks = toBlocks([
    L('보고서 제목', 760, 20),
    L('첫 문단 첫 줄인데', 720), L('이어지는 줄이에요.', 706), L('세 번째 줄.', 692),
    L('두 번째 문단이에요.', 660),
    L('1. 목록 첫째', 646), L('2. 목록 둘째', 632),
    L('소제목', 600, 13),
    L('mul-', 580), L('tiline', 566),
  ]);
  assert.deepEqual(blocks.map((b) => [b.type, b.level ?? '', b.text]), [
    ['h', 2, '보고서 제목'],
    ['p', '', '첫 문단 첫 줄인데 이어지는 줄이에요. 세 번째 줄.'],
    ['p', '', '두 번째 문단이에요.'],
    ['p', '', '1. 목록 첫째'],
    ['p', '', '2. 목록 둘째'],
    ['h', 3, '소제목'],
    ['p', '', 'multiline'],
  ]);
  assert.deepEqual(toBlocks([]), []);
});

test('HTML: 위에서 아래 순으로 글·그림, 쪽 사이 표시, 특수문자 이스케이프', () => {
  const html = buildHtml([
    { blocks: [{ type: 'h', level: 2, text: 'A & B', y: 700 }, { type: 'p', text: '<본문>', y: 500 }], images: [{ y: 600, src: 'data:image/png;base64,AAA', width: 300 }] },
    { blocks: [], images: [] },
  ]);
  assert.equal(html, `<h2>A &amp; B</h2>\n<p><img src="data:image/png;base64,AAA" width="300" alt=""></p>\n<p>&lt;본문&gt;</p>\n<p>${PAGE_MARK}</p>\n<p></p>`);
});

test('쪽 나눔 넣기: 표시 문단을 비우고 그 문단에 pageBreak', () => {
  const p = (t) => `<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t>${t}</hp:t></hp:run></hp:p>`;
  const xml = `<hs:sec>${p('첫 쪽')}${p(PAGE_MARK)}${p('둘째 쪽')}${p(PAGE_MARK)}${p('셋째 쪽')}</hs:sec>`;
  const r = insertPageBreaks(xml);
  assert.equal(r.breaks, 2);
  assert.ok(!r.xml.includes(PAGE_MARK));
  assert.equal((r.xml.match(/<hp:p /g) || []).length, 5); // 문단 수는 그대로
  assert.equal((r.xml.match(/pageBreak="1"/g) || []).length, 2);
  assert.ok(r.xml.indexOf('첫 쪽') < r.xml.indexOf('pageBreak="1"') && r.xml.indexOf('pageBreak="1"') < r.xml.indexOf('둘째 쪽'));
  assert.ok(r.xml.includes('<hp:t></hp:t>'));
});

test('그림 크기 거르기·파일 이름', () => {
  assert.equal(keepImage(200, 100), true);
  assert.equal(keepImage(20, 300), false);
  assert.equal(hwpxOutName('보고서.PDF'), '보고서.hwpx');
});

import { cleanPreview } from '../src/lib/pdfToHwpx.js';
test('미리보기 글에서 쪽 나눔 표시 지우기', () => {
  assert.equal(cleanPreview(`첫 쪽\r\n${PAGE_MARK}\r\n둘째 쪽`), '첫 쪽\r\n\r\n둘째 쪽');
});

test('문단 나누기: 문단 간격이 줄 간격보다 많아도, 짧게 끝난 줄 다음', () => {
  // 실제 크롬 PDF에서 잰 값: 줄 간격 17~18, 문단 간격 28.5
  const L = (text, y, end = 520) => ({ text, y, x: 57, end, size: 11 });
  const b1 = toBlocks([L('첫 문단 1줄', 749.9), L('첫 문단 2줄 (짧음)', 732.6, 400), L('두 번째 문단', 704.1, 330), L('1. 목록', 675.6, 150), L('2. 목록', 657.6, 140)]);
  assert.deepEqual(b1.map((b) => b.text), ['첫 문단 1줄 첫 문단 2줄 (짧음)', '두 번째 문단', '1. 목록', '2. 목록']);
  // 문단 사이 간격이 없는 문서: 앞 줄이 짧게 끝나면 새 문단
  const b2 = toBlocks([L('가 문단 첫 줄', 700), L('가 문단 끝.', 686, 300), L('나 문단 첫 줄', 672), L('나 문단 둘째 줄', 658), L('나 문단 끝.', 644, 250)]);
  assert.deepEqual(b2.map((b) => b.text), ['가 문단 첫 줄 가 문단 끝.', '나 문단 첫 줄 나 문단 둘째 줄 나 문단 끝.']);
});

import { fitWidth } from '../src/lib/pdfToHwpx.js';
test('그림 크기: 본문 폭·쪽 높이 안으로', () => {
  assert.equal(fitWidth(300, 200), 300);
  assert.equal(fitWidth(1200, 400), 600); // 넓으면 폭에 맞춤
  assert.equal(fitWidth(595, 842), 495); // A4 한 쪽 전체 → 높이 700에 맞춤
  assert.equal(fitWidth(0, 0), 600);
});
