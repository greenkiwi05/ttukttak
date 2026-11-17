// 상단바 도구 검색. 색인은 SiteHeader가 페이지에 심어 둔 JSON(#tool-index), 검색 로직은 src/lib/search.js.
// 열기: 돋보기 버튼·[data-open-search] 요소, 단축키 "/" 또는 Ctrl(⌘)+K. 방향키로 고르고 Enter로 이동.
import { searchTools } from '../lib/search.js';

type Item = { slug: string; title: string; short: string; keywords: string; emoji: string };
const POPULAR = ['pdf-merge-split', 'image-compress', 'id-photo', 'hwp-to-pdf', 'korean-age', 'char-count', 'video-compress', 'dutch-pay'];

const dlg = document.querySelector<HTMLDialogElement>('.search-dlg');
const input = dlg?.querySelector<HTMLInputElement>('input[name="q"]');
const list = dlg?.querySelector<HTMLUListElement>('.search-results');
const hint = dlg?.querySelector<HTMLElement>('.search-hint');
const empty = dlg?.querySelector<HTMLElement>('.search-empty');
const tools: Item[] = JSON.parse(document.getElementById('tool-index')?.textContent || '[]');
let active = 0;

function render() {
  if (!dlg || !input || !list || !hint || !empty) return;
  const q = input.value.trim();
  const found: Item[] = q ? searchTools(tools, q) : POPULAR.map((s) => tools.find((t) => t.slug === s)).filter((t): t is Item => !!t);
  hint.hidden = !!q;
  empty.hidden = !q || found.length > 0;
  active = 0;
  list.innerHTML = '';
  found.forEach((t, i) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.id = `sr-${i}`;
    const a = document.createElement('a');
    a.href = `/tools/${t.slug}/`;
    a.innerHTML = `<span aria-hidden="true">${t.emoji}</span><span><strong></strong><small></small></span>`;
    a.querySelector('strong')!.textContent = t.title;
    a.querySelector('small')!.textContent = t.short;
    li.appendChild(a);
    list.appendChild(li);
  });
  highlight();
}

function highlight() {
  const items = list?.querySelectorAll('li') ?? [];
  items.forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
  input?.setAttribute('aria-activedescendant', items.length ? `sr-${active}` : '');
  items[active]?.scrollIntoView({ block: 'nearest' });
}

function open(text = '') {
  if (!dlg || !input) return;
  if (!dlg.open) dlg.showModal();
  input.value = text;
  render();
  input.focus();
}

document.querySelectorAll('[data-open-search]').forEach((el) => el.addEventListener('click', () => open()));
input?.addEventListener('input', render);
input?.addEventListener('keydown', (e) => {
  const n = list?.children.length ?? 0;
  if (e.key === 'ArrowDown' && n) { e.preventDefault(); active = (active + 1) % n; highlight(); }
  else if (e.key === 'ArrowUp' && n) { e.preventDefault(); active = (active - 1 + n) % n; highlight(); }
  else if (e.key === 'Enter') {
    const a = list?.children[active]?.querySelector('a');
    if (a) { e.preventDefault(); location.href = a.href; }
  }
});
// 바깥(어두운 배경)을 누르면 닫기
dlg?.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
document.addEventListener('keydown', (e) => {
  const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable="true"]');
  if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
    e.preventDefault();
    open();
  }
});
