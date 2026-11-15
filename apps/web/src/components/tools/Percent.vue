<script setup lang="ts">
// 퍼센트·할인율 계산기 UI. 로직은 src/lib/percent.js
import { ref, computed } from 'vue';
import { percentOf, ratio, changeRate, discountPrice, discountRate, num } from '../../lib/percent.js';

const TABS = [
  { id: 'of', label: 'A의 B%' },
  { id: 'ratio', label: 'A는 B의 몇 %' },
  { id: 'change', label: '증감률' },
  { id: 'discount', label: '할인 계산' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const tab = ref<TabId>('discount');
const a = ref('');
const b = ref('');
const discountMode = ref<'rate' | 'sale'>('rate');

const labels = computed(() => {
  switch (tab.value) {
    case 'of': return ['A (전체 값)', 'B (%)'];
    case 'ratio': return ['A (부분 값)', 'B (전체 값)'];
    case 'change': return ['이전 값', '이후 값'];
    default: return ['정가 (원)', discountMode.value === 'rate' ? '할인율 (%)' : '할인가 (원)'];
  }
});

const fmt = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });

const result = computed<{ big: string; sub?: string } | { error: string } | null>(() => {
  const x = num(a.value), y = num(b.value);
  if (x === null || y === null) return null;
  switch (tab.value) {
    case 'of':
      return { big: fmt(percentOf(x, y)), sub: `${fmt(x)}의 ${fmt(y)}%` };
    case 'ratio': {
      const r = ratio(x, y);
      return r === null ? { error: '전체 값(B)이 0이면 계산할 수 없어요.' } : { big: `${fmt(r)}%`, sub: `${fmt(x)}은(는) ${fmt(y)}의 ${fmt(r)}%` };
    }
    case 'change': {
      const r = changeRate(x, y);
      if (r === null) return { error: '이전 값이 0이면 증감률을 계산할 수 없어요.' };
      return { big: `${r > 0 ? '+' : ''}${fmt(r)}%`, sub: `${r > 0 ? '증가' : r < 0 ? '감소' : '변화 없음'} · 차이 ${fmt(y - x)}` };
    }
    default:
      if (discountMode.value === 'rate') {
        const d = discountPrice(x, y);
        return { big: `${fmt(d.sale)}원`, sub: `${fmt(d.off)}원 할인` };
      } else {
        const r = discountRate(x, y);
        return r === null ? { error: '정가가 0이면 계산할 수 없어요.' } : { big: `${fmt(r)}% 할인`, sub: `${fmt(x - y)}원 할인` };
      }
  }
});
const ok = computed(() => (result.value && !('error' in result.value) ? result.value : null));
const error = computed(() => (result.value && 'error' in result.value ? result.value.error : ''));

function select(id: TabId) {
  tab.value = id;
  a.value = '';
  b.value = '';
}
</script>

<template>
  <div class="tabs" role="tablist">
    <button v-for="t in TABS" :key="t.id" type="button" role="tab" :aria-selected="tab === t.id" @click="select(t.id)">{{ t.label }}</button>
  </div>
  <div v-if="tab === 'discount'" class="chips" style="margin: -8px 0 14px">
    <button type="button" class="chip" :class="{ on: discountMode === 'rate' }" @click="discountMode = 'rate'; b = ''">할인율로 할인가 구하기</button>
    <button type="button" class="chip" :class="{ on: discountMode === 'sale' }" @click="discountMode = 'sale'; b = ''">할인가로 할인율 구하기</button>
  </div>
  <div class="row">
    <div class="field">
      <label for="pa">{{ labels[0] }}</label>
      <input id="pa" v-model="a" type="text" inputmode="decimal" />
    </div>
    <div class="field">
      <label for="pb">{{ labels[1] }}</label>
      <input id="pb" v-model="b" type="text" inputmode="decimal" />
    </div>
  </div>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <div v-if="ok" class="result" aria-live="polite">
    <div class="big">{{ ok.big }}</div>
    <div v-if="ok.sub" class="sub">{{ ok.sub }}</div>
  </div>
  <p class="muted" style="margin: 10px 0 0">결과는 소수 둘째 자리에서 반올림해요.</p>
</template>
