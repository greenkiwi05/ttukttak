<script setup lang="ts">
// 영업일 계산기 UI. 로직은 src/lib/holidays.js, 공휴일은 /api/holidays (한국천문연구원 특일 정보)
// 입력한 날짜는 서버로 보내지 않고 브라우저에서만 계산한다.
import { ref, computed, onMounted } from 'vue';
import DateInput from '../DateInput.vue';
import { loadHolidays, businessDays, addBusinessDays, parseExtra, dow } from '../../lib/holidays.js';

const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const mode = ref<'between' | 'add'>('between');
const hol = ref<Map<string, string[]>>(new Map());
const range = ref<{ min: number; max: number } | null>(null);
const state = ref<'loading' | 'ok' | 'fail'>('loading');

onMounted(async () => {
  const d = await loadHolidays();
  if (d) { hol.value = d.map; range.value = d.range; state.value = 'ok'; } else state.value = 'fail';
});

const from = ref(today);
const to = ref('');
const includeStart = ref(true);
const includeEnd = ref(true);
const n = ref<number | ''>(10);
const dir = ref<1 | -1>(1);
const extraText = ref('');
const extra = computed(() => parseExtra(extraText.value));

const between = computed(() => (from.value && to.value ? businessDays({ from: from.value, to: to.value, hol: hol.value, extra: extra.value, includeStart: includeStart.value, includeEnd: includeEnd.value }) : null));
const added = computed(() => (from.value && n.value !== '' ? addBusinessDays({ from: from.value, n: Number(n.value) * dir.value, hol: hol.value, extra: extra.value }) : null));
const ok = <T extends object>(r: T | { error: string } | null) => (r && !('error' in r) ? (r as T) : null);
const err = (r: object | null) => (r && 'error' in r ? (r as { error: string }).error : '');
const bOk = computed(() => ok(between.value));
const aOk = computed(() => ok(added.value));

const fmt = (d: string) => `${d.slice(0, 4)}년 ${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일 (${dow(d)})`;
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}(${dow(d)})`;
// 공휴일이 아직 없는 해가 계산 범위에 들어가면 알려 준다
const outOfRange = computed(() => {
  if (!range.value) return '';
  const ys = [from.value, mode.value === 'between' ? to.value : aOk.value?.date].filter(Boolean).map((d) => Number(d!.slice(0, 4)));
  const bad = [...new Set(ys.filter((y) => y < range.value!.min || y > range.value!.max))];
  return bad.length ? `${bad.join('·')}년 공휴일 정보가 아직 없어서, 그 해는 주말만 빼고 계산했어요.` : '';
});
</script>

<template>
  <div class="tabs" role="tablist">
    <button type="button" role="tab" :aria-selected="mode === 'between'" @click="mode = 'between'">두 날짜 사이 영업일</button>
    <button type="button" role="tab" :aria-selected="mode === 'add'" @click="mode = 'add'">며칠 영업일 뒤 날짜</button>
  </div>
  <p v-if="state === 'fail'" class="notice" style="margin-top: 0">공휴일 정보를 불러오지 못해서 지금은 주말만 빼고 계산해요.</p>

  <template v-if="mode === 'between'">
    <div class="row">
      <div class="field"><label for="bd-from">시작 날짜</label><DateInput id="bd-from" v-model="from" placeholder="예: 2026.11.19" /></div>
      <div class="field"><label for="bd-to">끝 날짜</label><DateInput id="bd-to" v-model="to" placeholder="예: 2026.12.31" /></div>
    </div>
    <div class="chips">
      <label class="check"><input v-model="includeStart" type="checkbox" /> 시작일 포함</label>
      <label class="check"><input v-model="includeEnd" type="checkbox" /> 끝 날짜 포함</label>
    </div>
  </template>
  <template v-else>
    <div class="row">
      <div class="field"><label for="bd-base">기준 날짜</label><DateInput id="bd-base" v-model="from" placeholder="예: 2026.11.19" /></div>
      <div class="field">
        <label for="bd-n">영업일 수</label>
        <input id="bd-n" v-model.number="n" type="number" min="1" max="3000" inputmode="numeric" />
        <div class="chips">
          <button type="button" class="chip" :class="{ on: dir === 1 }" @click="dir = 1">뒤 (이후)</button>
          <button type="button" class="chip" :class="{ on: dir === -1 }" @click="dir = -1">앞 (이전)</button>
          <button v-for="q in [3, 5, 7, 10, 14, 30]" :key="q" type="button" class="chip" :class="{ on: n === q }" @click="n = q">{{ q }}일</button>
        </div>
      </div>
    </div>
  </template>

  <details style="margin-top: 14px">
    <summary class="muted">회사 휴무일 등 추가로 쉬는 날 넣기 (선택)</summary>
    <div class="field" style="margin-top: 8px">
      <label for="bd-extra">쉬는 날짜 <small class="muted">(예: 2026.12.24, 2026.12.31)</small></label>
      <textarea id="bd-extra" v-model="extraText" rows="2" class="textarea" placeholder="2026.12.24, 2026.12.31"></textarea>
      <small class="muted">{{ extra.size }}일 추가됨</small>
    </div>
  </details>

  <template v-if="mode === 'between'">
    <p v-if="err(between)" class="error" role="alert">{{ err(between) }}</p>
    <template v-else-if="bOk">
      <div class="result" aria-live="polite">
        <div class="sub">{{ fmt(from) }} ~ {{ fmt(to) }}</div>
        <div class="big">영업일 {{ bOk.days.toLocaleString() }}일</div>
        <p class="sub" style="margin: 6px 0 0">
          전체 {{ bOk.calendar.toLocaleString() }}일 중 주말 {{ bOk.weekends }}일 · 평일 공휴일 {{ bOk.holidays.length }}일<template v-if="bOk.extraDays"> · 추가 휴무 {{ bOk.extraDays }}일</template> 제외
        </p>
      </div>
      <p v-if="bOk.holidays.length" class="muted" style="margin: 8px 0 0">
        뺀 공휴일: {{ bOk.holidays.slice(0, 20).map((h) => `${md(h.date)} ${h.names[0]}`).join(', ') }}<template v-if="bOk.holidays.length > 20"> 외 {{ bOk.holidays.length - 20 }}일</template>
      </p>
    </template>
  </template>
  <template v-else>
    <p v-if="err(added)" class="error" role="alert">{{ err(added) }}</p>
    <template v-else-if="aOk">
      <div class="result" aria-live="polite">
        <div class="sub">{{ fmt(from) }} 기준 {{ n }}영업일 {{ dir === 1 ? '뒤' : '앞' }}</div>
        <div class="big">{{ fmt(aOk.date) }}</div>
        <p class="sub" style="margin: 6px 0 0">기준일은 세지 않고 다음 영업일부터 셌어요.</p>
      </div>
      <p v-if="aOk.skipped.length" class="muted" style="margin: 8px 0 0">
        건너뛴 휴일: {{ aOk.skipped.slice(0, 20).map((h) => `${md(h.date)} ${h.names[0]}`).join(', ') }}
      </p>
    </template>
  </template>
  <p v-if="outOfRange" class="notice">{{ outOfRange }}</p>
</template>

<style scoped>
.check { display: inline-flex; gap: 6px; align-items: center; font-weight: 500; margin-right: 12px; }
</style>
