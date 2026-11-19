<script setup lang="ts">
// 공휴일 달력 UI. 로직은 src/lib/holidays.js, 데이터는 /api/holidays (한국천문연구원 특일 정보)
import { ref, computed, onMounted } from 'vue';
import { loadHolidays, yearList, longWeekends, bridgeDays, monthGrid, daysBetween, dow, isWeekend } from '../../lib/holidays.js';

const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const thisYear = Number(today.slice(0, 4));
const hol = ref<Map<string, string[]> | null>(null);
const range = ref<{ min: number; max: number } | null>(null);
const state = ref<'loading' | 'ok' | 'fail'>('loading');
const year = ref(thisYear);

onMounted(async () => {
  const d = await loadHolidays();
  if (!d) { state.value = 'fail'; return; }
  hol.value = d.map;
  range.value = d.range;
  const q = Number(new URLSearchParams(location.search).get('year'));
  if (q && d.range && q >= d.range.min && q <= d.range.max) year.value = q;
  state.value = 'ok';
});

const has = computed(() => !!hol.value && yearList(year.value, hol.value).length > 0);
const list = computed(() => (hol.value ? yearList(year.value, hol.value) : []));
const weekdayCount = computed(() => list.value.filter((h) => !h.weekend).length);
const lw = computed(() => (hol.value ? longWeekends(year.value, hol.value) : []));
const br = computed(() => (hol.value ? bridgeDays(year.value, hol.value) : []));
const next = computed(() => list.value.find((h) => h.date >= today) ?? null);
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;
const dday = (d: string) => { const n = daysBetween(today, d); return n === 0 ? '오늘' : n > 0 ? `D-${n}` : '지남'; };
const months = computed(() => Array.from({ length: 12 }, (_, i) => ({ m: i + 1, weeks: monthGrid(year.value, i + 1) })));
const cls = (d: string | null) => {
  if (!d) return 'empty';
  const w = new Date(Date.parse(d + 'T00:00:00Z')).getUTCDay();
  return [hol.value?.has(d) ? 'hol' : '', w === 0 ? 'sun' : w === 6 ? 'sat' : '', d === today ? 'today' : ''].join(' ');
};
const go = (n: number) => { const y = year.value + n; if (range.value && y >= range.value.min && y <= range.value.max + 1) year.value = y; };
</script>

<template>
  <p v-if="state === 'loading'" class="muted">공휴일을 불러오는 중이에요…</p>
  <p v-else-if="state === 'fail'" class="notice">지금은 공휴일 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
  <template v-else>
    <div class="year-nav">
      <button type="button" class="btn-sub" :disabled="!range || year <= range.min" aria-label="이전 해" @click="go(-1)">◀</button>
      <b>{{ year }}년</b>
      <button type="button" class="btn-sub" :disabled="!range || year > range.max" aria-label="다음 해" @click="go(1)">▶</button>
    </div>

    <p v-if="!has" class="notice">{{ year }}년 공휴일은 아직 발표되지 않았어요. 정부가 발표하면 자동으로 반영돼요.</p>
    <template v-else>
      <div class="result" aria-live="polite">
        <div class="sub">{{ year }}년 공휴일</div>
        <div class="big">{{ list.length }}일 <small class="muted" style="font-size: 1rem">(평일 {{ weekdayCount }}일)</small></div>
        <p v-if="next && year === thisYear" class="sub" style="margin: 6px 0 0">
          다음 공휴일: <b>{{ md(next.date) }}({{ dow(next.date) }}) {{ next.names.join('·') }}</b> · {{ dday(next.date) }}
        </p>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>날짜</th><th>공휴일</th><th></th></tr></thead>
          <tbody>
            <tr v-for="h in list" :key="h.date" :class="{ past: h.date < today }">
              <td>{{ md(h.date) }} ({{ dow(h.date) }})</td>
              <td style="text-align: left; white-space: normal">{{ h.names.join(' · ') }}<small v-if="h.weekend" class="muted"> · 주말과 겹침</small></td>
              <td>{{ dday(h.date) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 class="h3">{{ year }}년 연휴 (3일 이상)</h3>
      <ul v-if="lw.length" class="plain">
        <li v-for="x in lw" :key="x.start"><b>{{ md(x.start) }}({{ dow(x.start) }}) ~ {{ md(x.end) }}({{ dow(x.end) }})</b> {{ x.days }}일 · {{ x.names.join('·') }}</li>
      </ul>
      <p v-else class="muted">3일 이상 이어지는 연휴가 없어요.</p>

      <h3 class="h3">연차 쓰기 좋은 날</h3>
      <ul v-if="br.length" class="plain">
        <li v-for="x in br" :key="x.leave[0]">
          <b>{{ x.leave.map((d) => `${md(d)}(${dow(d)})`).join(', ') }}</b> 연차 {{ x.leave.length }}일 → {{ md(x.start) }} ~ {{ md(x.end) }} <b>{{ x.days }}일 연속</b> 휴식
        </li>
      </ul>
      <p v-else class="muted">연차 하루·이틀로 길게 이어지는 날이 없어요.</p>

      <h3 class="h3">{{ year }}년 달력</h3>
      <div class="months">
        <div v-for="mo in months" :key="mo.m" class="month">
          <b>{{ mo.m }}월</b>
          <table>
            <thead><tr><th v-for="(w, i) in ['일', '월', '화', '수', '목', '금', '토']" :key="w" :class="{ sun: i === 0, sat: i === 6 }">{{ w }}</th></tr></thead>
            <tbody>
              <tr v-for="(wk, i) in mo.weeks" :key="i">
                <td v-for="(d, j) in wk" :key="j" :class="cls(d)" :title="d && hol?.has(d) ? hol.get(d)!.join(', ') : undefined">{{ d ? Number(d.slice(8)) : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p class="muted" style="margin: 8px 0 0"><span class="key hol"></span> 공휴일 <span class="key today"></span> 오늘 · 날짜에 마우스를 올리면 공휴일 이름이 보여요.</p>
    </template>
  </template>
</template>

<style scoped>
.year-nav { display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 1.2rem; margin-bottom: 12px; }
.year-nav .btn-sub { margin-top: 0; padding: 8px 14px; }
.h3 { margin: 22px 0 6px; font-size: 1rem; }
.plain { margin: 0; padding-left: 18px; line-height: 1.8; }
.months { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.month { border: 1px solid var(--line); border-radius: 10px; padding: 8px; background: #fff; }
.month table { width: 100%; border-collapse: collapse; font-size: .8rem; text-align: center; margin-top: 4px; }
.month th { font-weight: 600; color: var(--muted); padding: 2px 0; }
.month td { padding: 3px 0; border-radius: 6px; }
.sun { color: #e03131; }
.sat { color: #1c7ed6; }
.hol { background: #ffe3e3; color: #c92a2a; font-weight: 700; }
.today { outline: 2px solid var(--accent); outline-offset: -2px; }
.key { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: middle; margin: 0 2px 0 6px; }
.key.hol { background: #ffe3e3; }
.key.today { outline: 2px solid var(--accent); outline-offset: -2px; }
</style>
