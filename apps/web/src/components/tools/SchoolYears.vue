<script setup lang="ts">
// 졸업년도 계산기 UI. 로직은 src/lib/schoolYears.js. 입력값은 저장하지도, 서버로 보내지도 않는다.
import { ref, computed } from 'vue';
import { schoolTimeline, gradeNow, LAST_EARLY_YEAR } from '../../lib/schoolYears.js';
import { todayKST } from '../../lib/date.js';

const birthYear = ref<number | ''>('');
const birthMonth = ref(0); // 0 = 모름
const adjust = ref(0);
const uniYears = ref(4);
const retake = ref(0);
const leave = ref(0);
const today = todayKST();

const t = computed(() =>
  birthYear.value !== '' && String(birthYear.value).length === 4
    ? schoolTimeline({ birthYear: Number(birthYear.value), birthMonth: birthMonth.value, adjust: adjust.value, retake: retake.value, leave: leave.value, uniYears: uniYears.value })
    : null,
);
const now = computed(() => (t.value ? gradeNow(t.value.rows[0].entry, today) : null));
const error = computed(() => (birthYear.value !== '' && String(birthYear.value).length === 4 && !t.value ? '출생연도는 1930~2030 사이로 넣어 주세요.' : ''));
const askMonth = computed(() => birthYear.value !== '' && Number(birthYear.value) <= LAST_EARLY_YEAR && birthMonth.value === 0);
const ADJ: [number, string][] = [[0, '제때 입학'], [-1, '1년 일찍 (조기입학)'], [1, '1년 늦게 (입학 유예)']];
</script>

<template>
  <div class="row">
    <div class="field">
      <label for="by">출생연도</label>
      <input id="by" v-model.number="birthYear" type="number" min="1930" max="2030" inputmode="numeric" placeholder="예: 1998" />
    </div>
    <div class="field">
      <label for="bm">출생월 <small class="muted">(빠른년생 확인용)</small></label>
      <select id="bm" v-model.number="birthMonth">
        <option :value="0">모름·상관없음</option>
        <option v-for="m in 12" :key="m" :value="m">{{ m }}월</option>
      </select>
    </div>
  </div>
  <p v-if="askMonth" class="muted" style="margin: 8px 0 0">{{ LAST_EARLY_YEAR }}년 이전 1·2월생은 한 해 일찍 입학했을 수 있어요. 출생월을 고르면 자동으로 반영돼요.</p>

  <div class="field" style="margin-top: 14px">
    <label>초등학교 입학</label>
    <div class="chips">
      <button v-for="[v, l] in ADJ" :key="v" type="button" class="chip" :class="{ on: adjust === v }" @click="adjust = v">{{ l }}</button>
    </div>
  </div>

  <div class="uni-row" style="margin-top: 14px">
    <div class="field">
      <label for="uy">대학 학제</label>
      <select id="uy" v-model.number="uniYears">
        <option :value="2">2년</option><option :value="3">3년</option><option :value="4">4년</option><option :value="6">6년</option>
      </select>
    </div>
    <div class="field">
      <label for="rt">재수</label>
      <select id="rt" v-model.number="retake"><option v-for="n in 4" :key="n" :value="n - 1">{{ n === 1 ? '없음' : `${n - 1}년` }}</option></select>
    </div>
    <div class="field">
      <label for="lv">휴학</label>
      <select id="lv" v-model.number="leave"><option v-for="n in 5" :key="n" :value="n - 1">{{ n === 1 ? '없음' : `${n - 1}년` }}</option></select>
    </div>
  </div>
  <p class="muted" style="margin: 6px 0 0">휴학에는 군 휴학도 넣으세요. 대학 졸업 연도에만 반영돼요.</p>

  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <template v-if="t">
    <div class="result" aria-live="polite">
      <div class="sub">고등학교 졸업</div>
      <div class="big">{{ t.rows[2].grad }}년 2월</div>
      <p class="sub" style="margin: 6px 0 0">
        초등학교 입학 {{ t.rows[0].entry }}년 · 대학 {{ t.hakbeon }}학번<template v-if="retake === 0"> (현역 기준)</template>
        <template v-if="now && now.label !== '고등학교 졸업'"><br />{{ now.schoolYear }}학년도 기준 <b>{{ now.label }}</b></template>
      </p>
      <p v-if="t.early" class="sub" style="margin: 6px 0 0">빠른년생이라 같은 해 3월 이후 출생자보다 한 학년 위로 계산했어요.</p>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>학교</th><th>입학</th><th>졸업</th></tr></thead>
        <tbody>
          <tr v-for="r in t.rows" :key="r.key"><td>{{ r.name }}</td><td>{{ r.entry }}년 3월</td><td>{{ r.grad }}년 2월</td></tr>
        </tbody>
      </table>
    </div>
    <p class="notice">학교는 3월에 입학하고 2월에 졸업하는 것으로 계산했어요. 검정고시·유학·편입·조기졸업은 반영하지 않으니 실제 학력과 다르면 졸업장을 확인하세요.</p>
  </template>
</template>

<style scoped>
.uni-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.uni-row .field + .field { margin-top: 0; }
.uni-row select { min-width: 0; width: 100%; padding-left: 10px; }
</style>
