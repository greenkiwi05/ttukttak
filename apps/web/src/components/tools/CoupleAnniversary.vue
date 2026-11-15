<script setup lang="ts">
// 커플 기념일 계산기 UI. 로직은 src/lib/anniversary.js
import { ref, computed } from 'vue';
import DateInput from '../DateInput.vue';
import { anniversaries } from '../../lib/anniversary.js';
import { todayKST, formatKo } from '../../lib/date.js';

const today = todayKST();
const start = ref('');
const startIsDay1 = ref(true);
const showPast = ref(false);

const result = computed(() => (start.value ? anniversaries(start.value, today, startIsDay1.value) : null));
const error = computed(() => (result.value && 'error' in result.value ? result.value.error : ''));
const ok = computed(() => (result.value && !('error' in result.value) ? result.value : null));
const rows = computed(() => (ok.value ? ok.value.list.filter((x) => showPast.value || !x.past) : []));
const next = computed(() => ok.value?.list.find((x) => x.next));
const fmt = (n: number) => n.toLocaleString('ko-KR');
const dText = (d: number) => (d === 0 ? '오늘' : d > 0 ? `D-${fmt(d)}` : `D+${fmt(-d)}`);
</script>

<template>
  <div class="field">
    <label for="start">사귄 날 (처음 만난 날)</label>
    <DateInput id="start" v-model="start" :max="today" placeholder="예: 2025.03.14" />
  </div>
  <label class="check"><input v-model="startIsDay1" type="checkbox" /> 사귄 날을 1일로 세기 (보통 이렇게 세요)</label>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <template v-if="ok">
    <div class="result" aria-live="polite">
      <div class="sub">오늘은</div>
      <div class="big">{{ fmt(ok.today) }}일째</div>
      <p v-if="next" class="sub" style="margin: 8px 0 0">
        다음 기념일 <b>{{ next.name }}</b> · {{ formatKo(next.date) }} · <b>{{ dText(next.dLeft) }}</b>
      </p>
    </div>
    <label class="check"><input v-model="showPast" type="checkbox" /> 지난 기념일도 보기</label>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>기념일</th><th>날짜</th><th>남은 날</th></tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.name" :class="{ past: r.past, next: r.next }">
            <td>{{ r.name }}</td><td>{{ formatKo(r.date) }}</td><td>{{ dText(r.dLeft) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
