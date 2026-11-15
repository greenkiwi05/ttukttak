import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loanSchedule, scheduleToCsv } from '../src/lib/loan.js';
import { calcSavings } from '../src/lib/savings.js';
import { parsePageRanges, splitFileName } from '../src/lib/pageRange.js';
import { filterFiles, uniqueNames } from '../src/lib/files.js';

const sum = (rows, k) => rows.reduce((s, x) => s + x[k], 0);

test('대출: 원리금균등 공식 (1억, 연 5%, 360개월 → 월 536,822원)', () => {
  const r = loanSchedule({ principal: 100_000_000, annualRate: 5, months: 360, method: 'equal-payment' });
  assert.equal(r.firstPayment, 536_822);
  assert.equal(sum(r.rows, 'principal'), 100_000_000);
  assert.equal(r.rows.at(-1).balance, 0);
  assert.ok(Math.abs(r.lastPayment - 536_822) < 1000); // 매달 원 단위 반올림 누적분만 보정
});

test('대출: 원금균등은 원금 일정, 상환액 감소', () => {
  const r = loanSchedule({ principal: 12_000_000, annualRate: 6, months: 12, method: 'equal-principal' });
  assert.equal(r.rows[0].principal, 1_000_000);
  assert.equal(r.rows[0].interest, 60_000);
  assert.ok(r.firstPayment > r.lastPayment);
  assert.equal(r.totalInterest, 390_000);
});

test('대출: 만기일시는 마지막에 원금 전부', () => {
  const r = loanSchedule({ principal: 10_000_000, annualRate: 4.8, months: 12, method: 'bullet' });
  assert.equal(r.rows[0].payment, 40_000);
  assert.equal(r.rows.at(-1).principal, 10_000_000);
  assert.equal(r.totalInterest, 480_000);
});

test('대출: 금리 0%와 거치기간', () => {
  const z = loanSchedule({ principal: 1_000_000, annualRate: 0, months: 3, method: 'equal-payment' });
  assert.deepEqual(z.rows.map((x) => x.payment), [333_333, 333_333, 333_334]);
  assert.equal(z.totalInterest, 0);
  const g = loanSchedule({ principal: 12_000_000, annualRate: 6, months: 24, graceMonths: 12, method: 'equal-principal' });
  assert.equal(g.rows.length, 24);
  assert.equal(g.rows[11].principal, 0);
  assert.equal(g.rows[11].interest, 60_000);
  assert.equal(g.rows[12].principal, 1_000_000);
  assert.equal(g.firstPayment, 1_060_000);
});

test('대출: 잘못된 입력과 CSV', () => {
  assert.ok(loanSchedule({ principal: 0, annualRate: 5, months: 12, method: 'bullet' }).error);
  assert.ok(loanSchedule({ principal: 1e6, annualRate: 5, months: 12, graceMonths: 12, method: 'bullet' }).error);
  const csv = scheduleToCsv([{ no: 1, payment: 10, principal: 9, interest: 1, balance: 0 }]);
  assert.ok(csv.startsWith('﻿회차'));
  assert.ok(csv.endsWith('1,10,9,1,0'));
});

test('예금: 단리·월복리', () => {
  const s = calcSavings({ type: 'deposit', amount: 10_000_000, months: 12, annualRate: 3.6, compound: 'simple', taxRate: 15.4 });
  assert.equal(s.interest, 360_000);
  assert.equal(s.tax, 55_440);
  assert.equal(s.total, 10_304_560);
  const m = calcSavings({ type: 'deposit', amount: 10_000_000, months: 12, annualRate: 3.6, compound: 'monthly', taxRate: 0 });
  assert.equal(m.interest, 366_000); // 1e7 × (1.003^12 − 1) = 365,999.8
  assert.equal(m.tax, 0);
});

test('적금: 단리 공식 = 월납입 × 이율/12 × n(n+1)/2', () => {
  const s = calcSavings({ type: 'installment', amount: 1_000_000, months: 12, annualRate: 4, compound: 'simple', taxRate: 15.4 });
  assert.equal(s.principal, 12_000_000);
  assert.equal(s.interest, 260_000);
  assert.equal(s.tax, 40_040);
  assert.equal(s.afterTax, 219_960);
});

test('적금: 세율은 입력값 그대로 쓰고, 잘못된 입력은 에러', () => {
  const a = calcSavings({ type: 'installment', amount: 500_000, months: 24, annualRate: 3, compound: 'monthly', taxRate: 9.5 });
  assert.equal(a.tax, Math.floor(a.interest * 0.095));
  assert.ok(calcSavings({ type: 'deposit', amount: 0, months: 12, annualRate: 3, compound: 'simple', taxRate: 0 }).error);
  assert.ok(calcSavings({ type: 'deposit', amount: 1, months: 12, annualRate: 3, compound: 'simple', taxRate: -1 }).error);
});

test('페이지 범위 파서', () => {
  assert.deepEqual(parsePageRanges('1-3, 5', 10), { groups: [[1, 2, 3], [5]], pages: [1, 2, 3, 5] });
  assert.deepEqual(parsePageRanges('8-', 10).pages, [8, 9, 10]);
  assert.deepEqual(parsePageRanges(' 2 ~ 3 ,2', 5).pages, [2, 3]);
  assert.ok(parsePageRanges('', 5).error);
  assert.ok(parsePageRanges('0', 5).error);
  assert.ok(parsePageRanges('6', 5).error);
  assert.ok(parsePageRanges('4-2', 5).error);
  assert.ok(parsePageRanges('a', 5).error);
  assert.equal(splitFileName('보고서.PDF', [1, 2, 3]), '보고서_p1-3.pdf');
  assert.equal(splitFileName('a.pdf', [5]), 'a_p5.pdf');
});

test('파일 검증과 이름 중복 처리', () => {
  const files = [
    { name: 'a.HEIC', size: 10 }, { name: 'b.png', size: 10 }, { name: 'c.heic', size: 999 }, { name: 'd.heif', size: 10 },
  ];
  const r = filterFiles(files, { exts: ['heic', 'heif'], maxSize: 100, maxCount: 30 });
  assert.deepEqual(r.accepted.map((f) => f.name), ['a.HEIC', 'd.heif']);
  assert.equal(r.rejected.length, 2);
  const c = filterFiles(files, { exts: ['heic', 'heif', 'png'], maxSize: 100, maxCount: 2, already: 1 });
  assert.equal(c.accepted.length, 1);
  assert.deepEqual(uniqueNames(['a.jpg', 'A.jpg', 'b.jpg', 'a.jpg']), ['a.jpg', 'A (2).jpg', 'b.jpg', 'a (3).jpg']);
});
