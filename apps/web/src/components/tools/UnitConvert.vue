<script setup lang="ts">
// 단위 변환기 UI. 변환표는 src/lib/units.js
import { ref, computed, watch } from 'vue';
import { UNIT_GROUPS, convert, fmtNum } from '../../lib/units.js';

type G = keyof typeof UNIT_GROUPS;
const DEFAULTS: Record<string, [string, string]> = {
  length: ['in', 'cm'], weight: ['lb', 'kg'], area: ['m2', 'pyeong'], volume: ['gal', 'L'], temp: ['F', 'C'], speed: ['mph', 'kmh'], data: ['GB', 'MB'],
};
const group = ref<G>('length');
const value = ref('1');
const from = ref('in');
const to = ref('cm');

watch(group, (g) => { [from.value, to.value] = DEFAULTS[g]; });
const units = computed(() => Object.entries(UNIT_GROUPS[group.value].units) as [string, [string, number]][]);
const num = computed(() => Number(String(value.value).replace(/,/g, '')));
const out = computed(() => (value.value.trim() === '' ? null : convert(num.value, from.value, to.value, group.value)));
const all = computed(() => (value.value.trim() === '' || !Number.isFinite(num.value) ? [] : units.value.filter(([k]) => k !== from.value).map(([k, [label]]) => ({ k, label, v: convert(num.value, from.value, k, group.value) }))));
const label = (k: string) => UNIT_GROUPS[group.value].units[k as never]?.[0] ?? k;
function swap() { [from.value, to.value] = [to.value, from.value]; }
</script>

<template>
  <div class="tabs" role="tablist">
    <button v-for="(g, k) in UNIT_GROUPS" :key="k" type="button" role="tab" :aria-selected="group === k" @click="group = k">{{ g.label }}</button>
  </div>
  <div class="uc">
    <div class="field">
      <label for="val">값</label>
      <input id="val" v-model="value" type="text" inputmode="decimal" />
    </div>
    <div class="field">
      <label for="from">단위</label>
      <select id="from" v-model="from"><option v-for="[k, [l]] in units" :key="k" :value="k">{{ l }}</option></select>
    </div>
    <button type="button" class="btn-sub uc-swap" aria-label="단위 바꾸기" @click="swap">⇅</button>
    <div class="field">
      <label for="to">바꿀 단위</label>
      <select id="to" v-model="to"><option v-for="[k, [l]] in units" :key="k" :value="k">{{ l }}</option></select>
    </div>
  </div>

  <p v-if="value.trim() && !Number.isFinite(num)" class="error">숫자를 입력해 주세요.</p>
  <div v-else-if="out !== null" class="result" aria-live="polite">
    <div class="sub">{{ fmtNum(num) }} {{ label(from) }} =</div>
    <div class="big">{{ fmtNum(out) }}</div>
    <div class="sub">{{ label(to) }}</div>
  </div>

  <div v-if="all.length" class="table-wrap">
    <table class="table">
      <thead><tr><th>{{ fmtNum(num) }} {{ label(from) }}은(는)</th><th>값</th></tr></thead>
      <tbody><tr v-for="r in all" :key="r.k"><td>{{ r.label }}</td><td>{{ fmtNum(r.v) }}</td></tr></tbody>
    </table>
  </div>
</template>

<style scoped>
.uc { display: grid; grid-template-columns: 1fr 1.3fr auto 1.3fr; gap: 10px; align-items: end; }
.uc .field + .field { margin-top: 0; }
.uc-swap { height: 48px; font-size: 1.2rem; }
@media (max-width: 600px) { .uc { grid-template-columns: 1fr 1fr; } .uc-swap { grid-column: 1 / -1; height: 40px; } }
</style>
