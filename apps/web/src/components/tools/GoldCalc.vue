<script setup lang="ts">
// 금값 계산기 UI. 로직은 src/lib/gold.js. 시세는 사용자가 넣고(하드코딩하지 않음), 다시 열 때 편하도록 이 기기에만 기억한다.
import { ref, computed, watch, onMounted } from 'vue';
import { UNITS, PURITY, WEIGHT_PRESETS, pricePerGram, valueOf, weightFor, convert, priceTable, fmtWeight, num } from '../../lib/gold.js';

type Unit = keyof typeof UNITS;
type Pur = keyof typeof PURITY;
const KEY = 'ttukttak:gold';
const price = ref('');
const basis = ref<'don' | 'g'>('don');
const tab = ref<'weight' | 'budget' | 'unit'>('weight');
const weight = ref('1');
const unit = ref<Unit>('don');
const purity = ref<Pur>('24k');
const budget = ref('');
const uWeight = ref('1');
const uFrom = ref<Unit>('don');
const loaded = ref(false);

onMounted(() => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s?.price) price.value = String(s.price);
    if (s?.basis === 'g' || s?.basis === 'don') basis.value = s.basis;
  } catch { /* 저장 불가 */ }
  loaded.value = true;
});
watch([price, basis], () => {
  if (!loaded.value) return;
  try { localStorage.setItem(KEY, JSON.stringify({ price: price.value, basis: basis.value })); } catch { /* 저장 불가 */ }
});

const perGram = computed(() => pricePerGram(price.value, basis.value));
const priceBad = computed(() => price.value.trim() !== '' && !perGram.value);
const v = computed(() => (perGram.value ? valueOf(weight.value, unit.value, purity.value, perGram.value) : null));
const w = computed(() => (perGram.value ? weightFor(budget.value, purity.value, perGram.value) : null));
const table = computed(() => (perGram.value ? priceTable(perGram.value) : []));
const won = (n: number) => Math.round(n).toLocaleString('ko-KR') + '원';
// 한눈에 보기 표는 휴대폰 폭에 맞게 만 원 단위 (소수 첫째 자리까지). 정확한 금액은 위 계산 결과에 나온다
const man = (n: number) => (Math.round(n / 1000) / 10).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
const units = Object.entries(UNITS) as [Unit, { label: string; grams: number }][];
const purities = Object.entries(PURITY) as [Pur, { label: string; ratio: number }][];
const presetLabel = (d: number) => (d === 0.5 ? '반 돈' : d === 10 ? '10돈 (1냥)' : `${d}돈`);
function setPreset(d: number) { weight.value = String(d); unit.value = 'don'; }
const isPreset = (d: number) => unit.value === 'don' && num(weight.value) === d;
</script>

<template>
  <div class="field">
    <label for="gp">오늘 순금(24K) 시세 <small class="muted">어느 가격인지 아래에서 골라요</small></label>
    <div class="price-row">
      <input id="gp" v-model="price" type="text" inputmode="numeric" :placeholder="basis === 'don' ? '1돈 가격 (예: 750000)' : '1g 가격 (예: 200000)'" autocomplete="off" />
      <span class="won">원</span>
    </div>
    <div class="chips">
      <button type="button" class="chip" :class="{ on: basis === 'don' }" @click="basis = 'don'">1돈 가격</button>
      <button type="button" class="chip" :class="{ on: basis === 'g' }" @click="basis = 'g'">1g 가격</button>
    </div>
    <p v-if="priceBad" class="error">시세는 숫자로 넣어 주세요.</p>
    <p v-else-if="perGram" class="muted hint">1g {{ won(perGram) }} · 1돈 {{ won(perGram * 3.75) }} 기준으로 계산해요</p>
    <p v-else class="muted hint">금거래소·은행·뉴스에서 본 순금 시세를 넣으세요. 이 기기에 기억해 둬요.</p>
  </div>

  <div class="tabs" role="tablist" style="margin-top: 16px">
    <button type="button" role="tab" :aria-selected="tab === 'weight'" @click="tab = 'weight'">무게로</button>
    <button type="button" role="tab" :aria-selected="tab === 'budget'" @click="tab = 'budget'">금액으로</button>
    <button type="button" role="tab" :aria-selected="tab === 'unit'" @click="tab = 'unit'">단위 환산</button>
  </div>

  <template v-if="tab !== 'unit'">
    <div class="field">
      <label>순도</label>
      <div class="chips"><button v-for="[k, p] in purities" :key="k" type="button" class="chip" :class="{ on: purity === k }" @click="purity = k">{{ p.label }}</button></div>
    </div>
  </template>

  <template v-if="tab === 'weight'">
    <div class="row" style="margin-top: 14px">
      <div class="field"><label for="gw">무게</label><input id="gw" v-model="weight" type="text" inputmode="decimal" placeholder="예: 1" /></div>
      <div class="field"><label for="gu">단위</label><select id="gu" v-model="unit"><option v-for="[k, u] in units" :key="k" :value="k">{{ u.label }}</option></select></div>
    </div>
    <div class="chips"><button v-for="d in WEIGHT_PRESETS" :key="d" type="button" class="chip" :class="{ on: isPreset(d) }" @click="setPreset(d)">{{ presetLabel(d) }}</button></div>
    <div v-if="v" class="result" aria-live="polite">
      <div class="sub">{{ PURITY[purity].label }} {{ fmtWeight(num(weight)) }}{{ UNITS[unit].label }}</div>
      <div class="big">{{ won(v.won) }}</div>
      <div class="sub">{{ fmtWeight(v.grams) }}g · {{ fmtWeight(v.don) }}돈</div>
      <p v-if="purity !== '24k'" class="sub" style="margin: 8px 0 0">금 함량({{ PURITY[purity].ratio * 100 }}%) 기준 값이에요. 금은방에서 실제로 쳐주는 {{ PURITY[purity].label }} 가격은 이보다 낮을 수 있어요.</p>
    </div>
  </template>

  <template v-else-if="tab === 'budget'">
    <div class="field" style="margin-top: 14px">
      <label for="gb">예산</label>
      <div class="price-row"><input id="gb" v-model="budget" type="text" inputmode="numeric" placeholder="예: 1000000" /><span class="won">원</span></div>
    </div>
    <div v-if="w" class="result" aria-live="polite">
      <div class="sub">{{ won(num(budget)) }}으로 살 수 있는 {{ PURITY[purity].label }}</div>
      <div class="big">약 {{ fmtWeight(w.don) }}돈</div>
      <div class="sub">{{ fmtWeight(w.grams) }}g · 부가세·수수료를 빼기 전 금 값만 계산했어요</div>
    </div>
  </template>

  <template v-else>
    <div class="row" style="margin-top: 14px">
      <div class="field"><label for="uw">무게</label><input id="uw" v-model="uWeight" type="text" inputmode="decimal" /></div>
      <div class="field"><label for="uf">단위</label><select id="uf" v-model="uFrom"><option v-for="[k, u] in units" :key="k" :value="k">{{ u.label }}</option></select></div>
    </div>
    <div class="table-wrap">
      <table class="table">
        <tbody><tr v-for="[k, u] in units" :key="k" :class="{ next: k === uFrom }"><td>{{ u.label }}</td><td>{{ fmtWeight(convert(uWeight, uFrom, k) ?? NaN, 4) }}</td></tr></tbody>
      </table>
    </div>
  </template>

  <p v-if="tab !== 'unit' && !perGram && !priceBad" class="notice">위에 오늘 순금 시세를 넣으면 금액이 바로 나와요.</p>

  <template v-if="table.length && tab !== 'unit'">
    <h3 class="tt">한눈에 보기 <small class="muted">(단위: 만 원 · 금 함량 기준)</small></h3>
    <div class="table-wrap">
      <table class="table glance">
        <thead><tr><th>무게</th><th v-for="[k, p] in purities" :key="k">{{ p.label.replace(' (24K)', '') }}</th></tr></thead>
        <tbody><tr v-for="r in table" :key="r.don"><td>{{ r.don }}돈</td><td v-for="[k] in purities" :key="k">{{ man(r.values[k]) }}</td></tr></tbody>
      </table>
    </div>
  </template>
</template>

<style scoped>
.price-row { display: flex; align-items: center; gap: 8px; }
.price-row input { flex: 1; min-width: 0; }
.won { font-weight: 600; }
.hint { margin: 8px 0 0; }
.tt { margin: 22px 0 6px; font-size: 1rem; }
/* 휴대폰에서도 네 칸이 한 화면에 들어가게 */
.glance th, .glance td { padding: 8px 6px; }
@media (max-width: 420px) { .glance { font-size: .92rem; } }
</style>
