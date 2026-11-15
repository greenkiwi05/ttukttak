<script setup lang="ts">
// 적금·예금 이자 계산기 UI. 로직은 src/lib/savings.js
// 세율은 사용자가 입력한다. 버튼은 입력칸을 채우는 편의 기능 (AGENTS.md 원칙 2).
import { ref, computed } from 'vue';
import { calcSavings, TAX_PRESETS } from '../../lib/savings.js';

const type = ref<'installment' | 'deposit'>('installment');
const amountMan = ref<number | ''>('');
const months = ref<number | ''>(12);
const rate = ref<number | ''>('');
const compound = ref<'simple' | 'monthly'>('simple');
const taxRate = ref<number | ''>(15.4);

const result = computed(() => {
  if (amountMan.value === '' || months.value === '' || rate.value === '' || taxRate.value === '') return null;
  return calcSavings({
    type: type.value,
    amount: Number(amountMan.value) * 10_000,
    months: Math.round(Number(months.value)),
    annualRate: Number(rate.value),
    compound: compound.value,
    taxRate: Number(taxRate.value),
  });
});
const ok = computed(() => (result.value && !('error' in result.value) ? result.value : null));
const error = computed(() => (result.value && 'error' in result.value ? result.value.error : ''));
const won = (n: number) => n.toLocaleString('ko-KR') + '원';
</script>

<template>
  <div class="tabs" role="tablist">
    <button type="button" role="tab" :aria-selected="type === 'installment'" @click="type = 'installment'">적금 (매달 납입)</button>
    <button type="button" role="tab" :aria-selected="type === 'deposit'" @click="type = 'deposit'">예금 (한 번에 예치)</button>
  </div>
  <div class="row">
    <div class="field">
      <label for="amount">{{ type === 'installment' ? '월 납입액 (만원)' : '예치금 (만원)' }}</label>
      <input id="amount" v-model.number="amountMan" type="number" min="1" inputmode="numeric" :placeholder="type === 'installment' ? '예: 50' : '예: 1000'" />
    </div>
    <div class="field">
      <label for="months">기간 (개월)</label>
      <input id="months" v-model.number="months" type="number" min="1" inputmode="numeric" />
    </div>
  </div>
  <div class="row" style="margin-top: 14px">
    <div class="field">
      <label for="rate">연 금리 (%)</label>
      <input id="rate" v-model.number="rate" type="number" min="0" step="0.01" inputmode="decimal" placeholder="상품 안내의 금리" />
    </div>
    <div class="field">
      <label for="tax">이자 세율 (%)</label>
      <input id="tax" v-model.number="taxRate" type="number" min="0" step="0.1" inputmode="decimal" />
      <div class="chips">
        <button v-for="p in TAX_PRESETS" :key="p.label" type="button" class="chip" :class="{ on: taxRate === p.rate }" @click="taxRate = p.rate">{{ p.label }} {{ p.rate }}%</button>
      </div>
    </div>
  </div>
  <div class="field" style="margin-top: 14px">
    <label>이자 방식</label>
    <div class="chips">
      <button type="button" class="chip" :class="{ on: compound === 'simple' }" @click="compound = 'simple'">단리</button>
      <button type="button" class="chip" :class="{ on: compound === 'monthly' }" @click="compound = 'monthly'">월복리</button>
    </div>
  </div>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <div v-if="ok" class="result" aria-live="polite">
    <div class="sub">만기 수령액 (세후)</div>
    <div class="big">{{ won(ok.total) }}</div>
    <p class="sub" style="margin: 8px 0 0">
      원금 <b>{{ won(ok.principal) }}</b> · 세전 이자 <b>{{ won(ok.interest) }}</b> · 세금 <b>{{ won(ok.tax) }}</b> · 세후 이자 <b>{{ won(ok.afterTax) }}</b>
    </p>
  </div>
  <p class="notice">세율 버튼 값은 입력 편의를 위한 기본값이에요. 세율과 비과세·세금우대 조건은 바뀔 수 있으니 가입 상품과 금융기관 안내를 꼭 확인하세요.</p>
</template>
