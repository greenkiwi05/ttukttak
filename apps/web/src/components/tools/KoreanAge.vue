<script setup lang="ts">
// 만 나이 계산기 UI. 계산 로직은 src/lib/age.js (테스트 대상)에만 둔다.
import { ref, computed, watch } from 'vue';
import DateInput from '../DateInput.vue';
import { calcAge, todayKST } from '../../lib/age.js';

const today = todayKST();
const birth = ref('');
const refDate = ref(today);
const submitted = ref(false);
watch([birth, refDate], () => (submitted.value = false));
const birthView = `${Number(today.slice(0, 4)) - 30}-01`; // 달력은 30년 전부터 펼침

const result = computed(() => (submitted.value ? calcAge(birth.value, refDate.value) : null));
const error = computed(() => (result.value && 'error' in result.value ? result.value.error : ''));
const ok = computed(() => (result.value && !('error' in result.value) ? result.value : null));

const fmt = (n: number) => n.toLocaleString('ko-KR');
</script>

<template>
  <form novalidate @submit.prevent="submitted = true">
    <div class="field">
      <label for="birth">생년월일</label>
      <DateInput id="birth" v-model="birth" min="1900-01-01" :max="refDate || today" :initial-view="birthView" />
    </div>
    <div class="field">
      <label for="ref">기준일 <small style="font-weight: 400; color: var(--muted)">(기본: 오늘)</small></label>
      <DateInput id="ref" v-model="refDate" />
    </div>
    <button class="btn" type="submit">계산하기</button>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </form>

  <div v-if="ok" class="result" aria-live="polite">
    <div class="sub">만 나이</div>
    <div class="big">{{ ok.manAge }}세</div>
    <p class="sub" style="margin: 8px 0 0">
      연 나이 <b>{{ ok.yearAge }}</b>세 · 다음 생일 <b>{{ ok.nextBirthday.replaceAll('-', '.') }}</b>
      (<b>{{ fmt(ok.daysToNext) }}</b>일 남음) · 태어난 지 <b>{{ fmt(ok.daysLived) }}</b>일
    </p>
  </div>
</template>
