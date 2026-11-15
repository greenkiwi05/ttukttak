<script setup lang="ts">
// D-day 계산기 UI. 로직은 src/lib/dday.js
import { ref, computed } from 'vue';
import { calcDday } from '../../lib/dday.js';
import { todayKST, formatKo } from '../../lib/date.js';

const target = ref('');
const base = ref(todayKST());
const includeToday = ref(false);

const result = computed(() => (target.value ? calcDday(target.value, base.value, includeToday.value) : null));
const error = computed(() => (result.value && 'error' in result.value ? result.value.error : ''));
const ok = computed(() => (result.value && !('error' in result.value) ? result.value : null));
const fmt = (n: number) => n.toLocaleString('ko-KR');
</script>

<template>
  <div class="row">
    <div class="field">
      <label for="target">목표일</label>
      <input id="target" v-model="target" type="date" />
    </div>
    <div class="field">
      <label for="base">기준일 <small class="muted">(기본: 오늘)</small></label>
      <input id="base" v-model="base" type="date" />
    </div>
  </div>
  <label class="check"><input v-model="includeToday" type="checkbox" /> 기준일(오늘)을 1일로 포함해서 세기</label>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <div v-if="ok" class="result" aria-live="polite">
    <div class="sub">{{ formatKo(target) }}</div>
    <div class="big">{{ ok.label }}</div>
    <p class="sub" style="margin: 8px 0 0">
      <template v-if="ok.diff === 0">바로 오늘이에요!</template>
      <template v-else>
        {{ ok.diff > 0 ? '남은' : '지난' }} 날 <b>{{ fmt(ok.days) }}</b>일
        · <b>{{ ok.weeks }}</b>주 <b>{{ ok.restDays }}</b>일
        · <b>{{ ok.months }}</b>개월 <b>{{ ok.monthRestDays }}</b>일
      </template>
    </p>
  </div>
</template>
