<script setup lang="ts">
// 전역일 계산기 UI. 로직은 src/lib/discharge.js. 복무 개월 수는 사용자가 넣는다(제도에 따라 바뀌어서 하드코딩하지 않음).
// 다시 열었을 때 복무율을 바로 보도록 입대일·개월 수만 이 기기의 브라우저에 저장한다(서버 전송 없음).
import { ref, computed, watch, onMounted } from 'vue';
import DateInput from '../DateInput.vue';
import { serviceStatus, milestones } from '../../lib/discharge.js';
import { todayKST, formatKo, monthsAndDays } from '../../lib/date.js';

const KEY = 'ttukttak:discharge';
const start = ref('');
const months = ref<number | ''>('');
const today = todayKST();
const PRESETS = [18, 20, 21, 24, 36];
const loaded = ref(false);

onMounted(() => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s?.start) start.value = s.start;
    if (s?.months) months.value = s.months;
  } catch { /* 저장 불가 */ }
  loaded.value = true;
});
watch([start, months], () => {
  if (!loaded.value) return;
  try { localStorage.setItem(KEY, JSON.stringify({ start: start.value, months: months.value })); } catch { /* 저장 불가 */ }
});

const st = computed(() => (start.value && months.value ? serviceStatus(start.value, months.value, today) : null));
const list = computed(() => (st.value ? milestones(start.value, months.value) : []));
const nextIdx = computed(() => list.value.findIndex((m) => m.date >= today));
const leftMD = computed(() => (st.value && st.value.state === 'serving' ? monthsAndDays(today, st.value.end) : null));
const fmt = (n: number) => n.toLocaleString('ko-KR');
const monthsError = computed(() => (months.value !== '' && (!Number.isInteger(Number(months.value)) || Number(months.value) < 1 || Number(months.value) > 120) ? '복무 기간은 1~120 사이의 개월 수로 넣어 주세요.' : ''));
</script>

<template>
  <div class="row">
    <div class="field">
      <label for="enlist">입대일 (입영일)</label>
      <DateInput id="enlist" v-model="start" placeholder="예: 2026.01.05" />
    </div>
    <div class="field">
      <label for="months">복무 기간 (개월)</label>
      <input id="months" v-model.number="months" type="number" min="1" max="120" inputmode="numeric" placeholder="예: 18" />
    </div>
  </div>
  <div class="chips">
    <button v-for="n in PRESETS" :key="n" type="button" class="chip" :class="{ on: months === n }" @click="months = n">{{ n }}개월</button>
  </div>
  <p class="muted" style="margin: 8px 0 0">복무 기간은 군별·복무 형태와 입영 시기에 따라 달라요. 병무청에서 내 복무 기간을 확인해 넣으세요.</p>
  <p v-if="monthsError" class="error" role="alert">{{ monthsError }}</p>

  <template v-if="st">
    <div class="result" aria-live="polite">
      <div class="sub">전역(소집해제) 예정일</div>
      <div class="big">{{ formatKo(st.end) }}</div>
      <template v-if="st.state === 'serving'">
        <p class="sub" style="margin: 6px 0 0">
          전역까지 <b>D-{{ fmt(st.left) }}</b>
          <template v-if="leftMD"> · {{ leftMD.months }}개월 {{ leftMD.days }}일 남음</template>
        </p>
        <div class="progress" style="height: 10px; margin-top: 12px"><div :style="{ width: st.percent + '%' }"></div></div>
        <p class="sub" style="margin: 6px 0 0">복무율 <b>{{ st.percent.toFixed(1) }}%</b> · {{ fmt(st.served) }}일째 / 전체 {{ fmt(st.total) }}일</p>
      </template>
      <p v-else-if="st.state === 'before'" class="sub" style="margin: 6px 0 0">입대까지 {{ fmt(st.left - st.total + 1) }}일 남았어요 · 전체 복무 {{ fmt(st.total) }}일</p>
      <p v-else class="sub" style="margin: 6px 0 0">전역을 축하해요! 전체 복무 {{ fmt(st.total) }}일</p>
    </div>

    <h3 style="margin: 22px 0 6px; font-size: 1rem">복무 기념일</h3>
    <div class="table-wrap">
      <table class="table">
        <tbody>
          <tr v-for="(m, i) in list" :key="m.label" :class="{ past: m.date < today, next: i === nextIdx }">
            <td>{{ m.label }}</td>
            <td>{{ formatKo(m.date) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
