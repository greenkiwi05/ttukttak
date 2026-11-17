<script setup lang="ts">
// 근무시간 계산기 UI. 로직은 src/lib/workHours.js — 가산수당·주휴수당은 계산하지 않는다.
import { ref, computed } from 'vue';
import { workMinutes, sumWeek, fmtDuration, parseTime, fmtTime } from '../../lib/workHours.js';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const rows = ref(DAYS.map((d, i) => ({ day: d, start: i < 5 ? '' : '', end: '', breakMin: '' as number | '' })));
const wage = ref<number | ''>('');

const each = computed(() => rows.value.map((r) => (r.start || r.end ? workMinutes({ ...r, breakMin: Number(r.breakMin) || 0 }) : null)));
const week = computed(() => sumWeek(rows.value.map((r) => ({ ...r, breakMin: Number(r.breakMin) || 0 })), Number(wage.value) || 0));

function tidy(r: { start: string; end: string }, k: 'start' | 'end') {
  const m = parseTime(r[k]);
  if (m !== null) r[k] = m === 1440 ? '24:00' : fmtTime(m);
}
function copyDown(i: number) {
  const src = rows.value[i];
  for (let j = i + 1; j < 5; j++) Object.assign(rows.value[j], { start: src.start, end: src.end, breakMin: src.breakMin });
}
const won = (n: number) => n.toLocaleString('ko-KR') + '원';
</script>

<template>
  <p class="muted" style="margin: 0 0 10px">시각은 <b>0930</b>, <b>9:30</b>, <b>21</b>처럼 편하게 입력하세요. 퇴근이 출근보다 이르면 다음 날 퇴근으로 계산해요.</p>
  <div class="wh-head"><span>요일</span><span>출근</span><span>퇴근</span><span>휴게(분)</span><span>근무</span></div>
  <div v-for="(r, i) in rows" :key="r.day" class="wh-row">
    <b>{{ r.day }}</b>
    <input v-model="r.start" type="text" inputmode="numeric" placeholder="09:00" :aria-label="`${r.day}요일 출근`" @blur="tidy(r, 'start')" />
    <input v-model="r.end" type="text" inputmode="numeric" placeholder="18:00" :aria-label="`${r.day}요일 퇴근`" @blur="tidy(r, 'end')" />
    <input v-model.number="r.breakMin" type="number" min="0" step="10" inputmode="numeric" placeholder="60" :aria-label="`${r.day}요일 휴게시간(분)`" />
    <span class="wh-out">
      <template v-if="each[i] && 'error' in each[i]!"><small class="error" style="margin: 0">{{ (each[i] as any).error }}</small></template>
      <template v-else-if="each[i]">{{ fmtDuration((each[i] as any).minutes) }}<small v-if="(each[i] as any).overnight" class="muted"> (익일)</small></template>
    </span>
    <button v-if="i === 0 && r.start && r.end" type="button" class="btn-sub wh-copy" @click="copyDown(0)">월요일 시간을 금요일까지 복사</button>
  </div>

  <div class="field" style="margin-top: 14px">
    <label for="wage">시급 (원, 선택)</label>
    <input id="wage" v-model.number="wage" type="number" min="0" inputmode="numeric" placeholder="계약서의 시급을 입력" />
  </div>

  <div v-if="week.days" class="result" aria-live="polite">
    <div class="sub">이번 주 근무 ({{ week.days }}일)</div>
    <div class="big">{{ fmtDuration(week.total) }}</div>
    <p class="sub" style="margin: 8px 0 0">
      {{ (week.total / 60).toFixed(2).replace(/\.?0+$/, '') }}시간 · 하루 평균 {{ fmtDuration(Math.round(week.total / week.days)) }}
      <template v-if="week.pay"> · 시급 × 시간 <b>{{ won(week.pay) }}</b></template>
    </p>
  </div>
  <p class="notice">연장·야간·휴일 가산수당과 주휴수당은 포함하지 않은 단순 계산이에요. 실제 급여는 근로계약서와 회사 기준을 확인하세요.</p>
</template>

<style scoped>
.wh-head, .wh-row { display: grid; grid-template-columns: 34px 1fr 1fr 1fr 1.1fr; gap: 6px; align-items: center; }
.wh-head { font-size: .82rem; color: var(--muted); margin-bottom: 4px; }
.wh-row { margin-top: 6px; }
.wh-row input { padding: 9px 8px; font-size: .95rem; min-width: 0; text-align: center; }
.wh-out { font-size: .9rem; font-weight: 600; }
.wh-copy { grid-column: 2 / -1; padding: 6px 10px; font-size: .85rem; }
</style>
