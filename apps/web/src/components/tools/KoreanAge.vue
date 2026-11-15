<script setup lang="ts">
// 만 나이 계산기 UI. 계산 로직은 src/lib/age.js (테스트 대상)에만 둔다.
import { ref, computed } from 'vue';
import { calcAge, todayKST } from '../../lib/age.js';

const today = todayKST();
const birth = ref('');
const refDate = ref(today);
const submitted = ref(false);

const result = computed(() => (submitted.value ? calcAge(birth.value, refDate.value) : null));
const error = computed(() => (result.value && 'error' in result.value ? result.value.error : ''));
const ok = computed(() => (result.value && !('error' in result.value) ? result.value : null));

const fmt = (n: number) => n.toLocaleString('ko-KR');
</script>

<template>
  <form novalidate @submit.prevent="submitted = true">
    <div class="field">
      <label for="birth">생년월일</label>
      <input id="birth" v-model="birth" type="date" min="1900-01-01" :max="refDate" required @input="submitted = false" />
    </div>
    <div class="field">
      <label for="ref">기준일 <small style="font-weight: 400; color: var(--muted)">(기본: 오늘)</small></label>
      <input id="ref" v-model="refDate" type="date" required @input="submitted = false" />
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
