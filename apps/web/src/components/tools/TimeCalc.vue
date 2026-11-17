<script setup lang="ts">
// 시간 계산기 UI. 로직은 src/lib/timeCalc.js
import { ref, computed } from 'vue';
import { parseDuration, fmtHMS, fmtColon, addToClock, clockDiff, sumDurations } from '../../lib/timeCalc.js';

type Mode = 'add' | 'diff' | 'sum';
const mode = ref<Mode>('add');
const clock = ref('09:00');
const delta = ref('');
const sign = ref<1 | -1>(1);
const start = ref('');
const end = ref('');
const list = ref('');

const addResult = computed(() => {
  if (!delta.value.trim()) return null;
  const d = parseDuration(delta.value);
  return addToClock(clock.value, d === null ? null : d * sign.value);
});
const diffResult = computed(() => (start.value && end.value ? clockDiff(start.value, end.value) : null));
const addOk = computed(() => (addResult.value && 'time' in addResult.value ? addResult.value : null));
const diffOk = computed(() => (diffResult.value && 'sec' in diffResult.value ? diffResult.value : null));
const errOf = (r: object | null) => (r && 'error' in r ? String(r.error) : '');
const sumResult = computed(() => (list.value.trim() ? sumDurations(list.value) : null));
const dayText = (n: number) => (n === 0 ? '같은 날' : n > 0 ? `${n}일 뒤` : `${-n}일 전`);
const hours = (sec: number) => (sec / 3600).toFixed(2).replace(/\.?0+$/, '');
</script>

<template>
  <div class="tabs" role="tablist">
    <button type="button" role="tab" :aria-selected="mode === 'add'" @click="mode = 'add'">시간 더하기·빼기</button>
    <button type="button" role="tab" :aria-selected="mode === 'diff'" @click="mode = 'diff'">두 시각 사이</button>
    <button type="button" role="tab" :aria-selected="mode === 'sum'" @click="mode = 'sum'">시간 합계</button>
  </div>

  <template v-if="mode === 'add'">
    <div class="row">
      <div class="field"><label for="clock">기준 시각</label><input id="clock" v-model="clock" type="text" inputmode="numeric" placeholder="예: 09:30" /></div>
      <div class="field">
        <label for="delta">더할 시간</label>
        <input id="delta" v-model="delta" type="text" placeholder="예: 1:30, 90분, 2시간" />
      </div>
    </div>
    <div class="chips">
      <button type="button" class="chip" :class="{ on: sign === 1 }" @click="sign = 1">＋ 더하기 (후)</button>
      <button type="button" class="chip" :class="{ on: sign === -1 }" @click="sign = -1">－ 빼기 (전)</button>
    </div>
    <p v-if="errOf(addResult)" class="error">{{ errOf(addResult) }}</p>
    <div v-else-if="addOk" class="result" aria-live="polite">
      <div class="sub">{{ clock }}에서 {{ fmtHMS(Math.abs(parseDuration(delta) ?? 0)) }} {{ sign === 1 ? '후' : '전' }}</div>
      <div class="big">{{ addOk.time }}</div>
      <div class="sub">{{ dayText(addOk.dayOffset) }}</div>
    </div>
  </template>

  <template v-else-if="mode === 'diff'">
    <div class="row">
      <div class="field"><label for="st">시작 시각</label><input id="st" v-model="start" type="text" inputmode="numeric" placeholder="예: 09:00" /></div>
      <div class="field"><label for="en">끝 시각</label><input id="en" v-model="end" type="text" inputmode="numeric" placeholder="예: 17:30" /></div>
    </div>
    <p v-if="errOf(diffResult)" class="error">{{ errOf(diffResult) }}</p>
    <div v-else-if="diffOk" class="result" aria-live="polite">
      <div class="sub">두 시각 사이{{ diffOk.overnight ? ' (다음 날까지)' : '' }}</div>
      <div class="big">{{ fmtHMS(diffOk.sec) }}</div>
      <div class="sub">{{ hours(diffOk.sec) }}시간 · {{ diffOk.sec / 60 }}분</div>
    </div>
  </template>

  <template v-else>
    <div class="field">
      <label for="list">더할 시간 <small class="muted">(줄마다 하나씩, 빼려면 앞에 -)</small></label>
      <textarea id="list" v-model="list" rows="6" class="textarea" placeholder="1:30&#10;45분&#10;2시간 10분&#10;-20분"></textarea>
    </div>
    <div v-if="sumResult" class="result" aria-live="polite">
      <div class="sub">{{ sumResult.count }}개 합계</div>
      <div class="big">{{ fmtHMS(sumResult.total) }}</div>
      <div class="sub">{{ fmtColon(sumResult.total) }} · {{ hours(sumResult.total) }}시간 · {{ Math.round(sumResult.total / 60).toLocaleString() }}분</div>
      <p v-if="sumResult.bad.length" class="error" style="margin: 8px 0 0">읽지 못한 줄: {{ sumResult.bad.join(', ') }}</p>
    </div>
  </template>
  <p class="muted" style="margin: 12px 0 0">시간은 1:30, 1시간 30분, 90분, 1.5시간처럼 써도 되고, 숫자만 쓰면 '분'으로 계산해요.</p>
</template>
