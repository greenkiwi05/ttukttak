<script setup lang="ts">
// 대출 원리금 상환 계산기 UI. 로직은 src/lib/loan.js
import { ref, computed } from 'vue';
import { loanSchedule, scheduleToCsv, METHODS } from '../../lib/loan.js';
import { downloadBlob } from '../../lib/download.js';

const amountMan = ref<number | ''>(''); // 만원 단위 입력
const rate = ref<number | ''>('');
const period = ref<number | ''>('');
const periodUnit = ref<'year' | 'month'>('year');
const method = ref<keyof typeof METHODS>('equal-payment');
const grace = ref<number | ''>(0);
const showTable = ref(false);

const months = computed(() => (period.value === '' ? 0 : periodUnit.value === 'year' ? Number(period.value) * 12 : Number(period.value)));
const result = computed(() => {
  if (amountMan.value === '' || rate.value === '' || period.value === '') return null;
  return loanSchedule({
    principal: Number(amountMan.value) * 10_000,
    annualRate: Number(rate.value),
    months: Math.round(months.value),
    method: method.value,
    graceMonths: grace.value === '' ? 0 : Math.round(Number(grace.value)),
  });
});
const ok = computed(() => (result.value && !('error' in result.value) ? result.value : null));
const error = computed(() => (result.value && 'error' in result.value ? result.value.error : ''));
const won = (n: number) => n.toLocaleString('ko-KR') + '원';

function csv() {
  if (!ok.value) return;
  downloadBlob(new Blob([scheduleToCsv(ok.value.rows)], { type: 'text/csv;charset=utf-8' }), '대출_상환표.csv');
}
</script>

<template>
  <div class="field">
    <label for="amount">대출금 (만원)</label>
    <input id="amount" v-model.number="amountMan" type="number" min="1" inputmode="numeric" placeholder="예: 10000 (= 1억 원)" />
  </div>
  <div class="row" style="margin-top: 14px">
    <div class="field">
      <label for="rate">연 금리 (%)</label>
      <input id="rate" v-model.number="rate" type="number" min="0" step="0.01" inputmode="decimal" placeholder="예: 4.5" />
    </div>
    <div class="field">
      <label for="period">대출 기간</label>
      <div style="display: flex; gap: 6px">
        <input id="period" v-model.number="period" type="number" min="1" inputmode="numeric" placeholder="예: 30" />
        <select v-model="periodUnit" aria-label="기간 단위" style="width: 90px"><option value="year">년</option><option value="month">개월</option></select>
      </div>
    </div>
  </div>
  <div class="field" style="margin-top: 14px">
    <label>상환 방식</label>
    <div class="chips">
      <button v-for="(label, k) in METHODS" :key="k" type="button" class="chip" :class="{ on: method === k }" @click="method = k">{{ label }}</button>
    </div>
  </div>
  <div class="field" style="margin-top: 14px">
    <label for="grace">거치기간 (개월, 선택) <small class="muted">이자만 내는 기간</small></label>
    <input id="grace" v-model.number="grace" type="number" min="0" inputmode="numeric" />
  </div>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <template v-if="ok">
    <div class="result" aria-live="polite">
      <div class="sub">{{ method === 'bullet' ? '매달 이자' : '첫 달 상환액' }}</div>
      <div class="big">{{ won(ok.firstPayment) }}</div>
      <p class="sub" style="margin: 8px 0 0">
        마지막 달 <b>{{ won(ok.lastPayment) }}</b> · 총 이자 <b>{{ won(ok.totalInterest) }}</b> · 총 상환액 <b>{{ won(ok.totalPayment) }}</b>
      </p>
    </div>
    <div style="display: flex; gap: 8px; margin-top: 12px">
      <button type="button" class="btn-sub" @click="showTable = !showTable">{{ showTable ? '상환표 접기' : `월별 상환표 보기 (${ok.rows.length}회)` }}</button>
      <button type="button" class="btn-sub" @click="csv">CSV 다운로드</button>
    </div>
    <div v-if="showTable" class="table-wrap">
      <table class="table">
        <thead><tr><th>회차</th><th>상환금</th><th>원금</th><th>이자</th><th>잔액</th></tr></thead>
        <tbody>
          <tr v-for="r in ok.rows" :key="r.no">
            <td>{{ r.no }}</td><td>{{ r.payment.toLocaleString() }}</td><td>{{ r.principal.toLocaleString() }}</td>
            <td>{{ r.interest.toLocaleString() }}</td><td>{{ r.balance.toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
  <p class="muted" style="margin: 12px 0 0">고정금리 기준 예상치예요. 실제 금액은 은행의 이자 계산 방식(일할 계산 등)에 따라 조금 다를 수 있어요.</p>
</template>
