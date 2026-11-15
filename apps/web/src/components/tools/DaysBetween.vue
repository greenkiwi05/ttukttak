<script setup lang="ts">
// 날짜 사이 일수 계산 UI. 로직은 src/lib/daysBetween.js
import { ref, computed } from 'vue';
import { daysBetween } from '../../lib/daysBetween.js';
import { todayKST } from '../../lib/date.js';

const start = ref(todayKST());
const end = ref('');
const includeStart = ref(false);

const result = computed(() => (start.value && end.value ? daysBetween(start.value, end.value, includeStart.value) : null));
const error = computed(() => (result.value && 'error' in result.value ? result.value.error : ''));
const ok = computed(() => (result.value && !('error' in result.value) ? result.value : null));
const fmt = (n: number) => n.toLocaleString('ko-KR');
</script>

<template>
  <div class="row">
    <div class="field">
      <label for="start">시작일</label>
      <input id="start" v-model="start" type="date" />
    </div>
    <div class="field">
      <label for="end">종료일</label>
      <input id="end" v-model="end" type="date" />
    </div>
  </div>
  <label class="check"><input v-model="includeStart" type="checkbox" /> 시작일도 1일로 포함 (예: 근무일·여행 일수)</label>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <div v-if="ok" class="result" aria-live="polite">
    <div class="sub">총 기간</div>
    <div class="big">{{ fmt(ok.days) }}일</div>
    <p class="sub" style="margin: 8px 0 0">
      <b>{{ fmt(ok.weeks) }}</b>주 <b>{{ ok.restDays }}</b>일 · <b>{{ fmt(ok.months) }}</b>개월 <b>{{ ok.monthRestDays }}</b>일
      · 평일(월~금) <b>{{ fmt(ok.weekdays) }}</b>일
    </p>
    <p v-if="ok.swapped" class="muted" style="margin: 6px 0 0">시작일이 종료일보다 늦어서 순서를 바꿔 계산했어요.</p>
    <p class="muted" style="margin: 6px 0 0">평일 수에서 공휴일은 빼지 않았어요.</p>
  </div>
</template>
