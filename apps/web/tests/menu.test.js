import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MENUS, CUISINES, TAGS, filterMenus, pickMenu, mapLinks } from '../src/lib/menu.js';

test('메뉴 목록이 올바른지', () => {
  const names = MENUS.map((m) => m.name);
  assert.equal(new Set(names).size, names.length, '이름 중복 없음');
  for (const m of MENUS) {
    assert.ok(CUISINES.includes(m.cuisine), m.name);
    for (const t of m.tags) assert.ok(t in TAGS, `${m.name}: ${t}`);
    assert.ok(m.emoji);
  }
  for (const c of CUISINES) assert.ok(MENUS.some((m) => m.cuisine === c), c);
  for (const t of Object.keys(TAGS)) assert.ok(MENUS.some((m) => m.tags.includes(t)), t);
});

test('조건 거르기', () => {
  assert.equal(filterMenus().length, MENUS.length);
  const jp = filterMenus({ cuisines: ['일식'] });
  assert.ok(jp.length > 0 && jp.every((m) => m.cuisine === '일식'));
  const two = filterMenus({ cuisines: ['일식', '중식'] });
  assert.ok(two.some((m) => m.cuisine === '일식') && two.some((m) => m.cuisine === '중식'));
  const soupSpicy = filterMenus({ tags: ['soup', 'spicy'] });
  assert.ok(soupSpicy.length > 0 && soupSpicy.every((m) => m.tags.includes('soup') && m.tags.includes('spicy')));
  assert.ok(soupSpicy.some((m) => m.name === '김치찌개'));
  assert.ok(!filterMenus({ exclude: ['김치찌개'] }).some((m) => m.name === '김치찌개'));
  assert.equal(filterMenus({ cuisines: ['양식'], tags: ['hangover'] }).length, 0);
});

test('뽑기', () => {
  const list = filterMenus({ cuisines: ['중식'] });
  assert.equal(pickMenu(list, () => 0).name, list[0].name);
  assert.equal(pickMenu(list, () => 0.9999).name, list.at(-1).name);
  // 직전 메뉴는 다시 안 나옴
  for (let i = 0; i < 20; i++) assert.notEqual(pickMenu(list, () => i / 20, list[0].name).name, list[0].name);
  // 후보가 하나면 직전과 같아도 그대로
  assert.equal(pickMenu([list[0]], Math.random, list[0].name).name, list[0].name);
  assert.equal(pickMenu([], Math.random), null);
});

test('지도 검색 주소', () => {
  const l = mapLinks('김치찌개');
  assert.equal(l.naver, 'https://map.naver.com/p/search/%EA%B9%80%EC%B9%98%EC%B0%8C%EA%B0%9C');
  assert.equal(l.kakao, 'https://map.kakao.com/?q=%EA%B9%80%EC%B9%98%EC%B0%8C%EA%B0%9C');
});
