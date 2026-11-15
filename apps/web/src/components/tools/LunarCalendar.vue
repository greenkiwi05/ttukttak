<script setup lang="ts">
// 음력 ↔ 양력 변환 UI. 로직은 src/lib/lunar.js (변환표 내장, 오프라인)
import { ref, computed } from 'vue';
import DateInput from '../DateInput.vue';
import { solarToLunar, lunarToSolar, lunarBirthdays } from '../../lib/lunar.js';
import { todayKST, formatKo, parseDate } from '../../lib/date.js';

const tab = ref<'s2l' | 'l2s'>('l2s');
const solar = ref(todayKST());
const ly = ref<number | ''>(Number(todayKST().slice(0, 4)));
const lm = ref<number | ''>(1);
const ld = ref<number | ''>(1);
const leap = ref(false);
const thisYear = Number(todayKST().slice(0, 4));

const s2l = computed(() => {
  const p = parseDate(solar.value);
  return p ? solarToLunar(p.y, p.m, p.d) : null;
});
const l2s = computed(() => (ly.value && lm.value && ld.value ? lunarToSolar(Number(ly.value), Number(lm.value), Number(ld.value), leap.value) : null));
const table = computed(() => (lm.value && ld.value ? lunarBirthdays(Number(lm.value), Number(ld.value), leap.value, thisYear, 10) : []));
</script>

<template>
  <div class="tabs" role="tablist">
    <button type="button" role="tab" :aria-selected="tab === 'l2s'" @click="tab = 'l2s'">음력 → 양력</button>
    <button type="button" role="tab" :aria-selected="tab === 's2l'" @click="tab = 's2l'">양력 → 음력</button>
  </div>

  <template v-if="tab === 's2l'">
    <div class="field"><label for="sd">양력 날짜</label><DateInput id="sd" v-model="solar" min="1000-02-13" max="2050-12-31" /></div>
    <p v-if="s2l && 'error' in s2l" class="error">{{ s2l.error }}</p>
    <div v-else-if="s2l" class="result" aria-live="polite">
      <div class="sub">{{ formatKo(solar) }}은 음력으로</div>
      <div class="big">{{ s2l.lunar.year }}년 {{ s2l.lunar.leap ? '윤' : '' }}{{ s2l.lunar.month }}월 {{ s2l.lunar.day }}일</div>
      <div v-if="s2l.gapja" class="sub">{{ s2l.gapja }}</div>
    </div>
  </template>

  <template v-else>
    <div class="row3">
      <div class="field"><label for="ly">음력 연도</label><input id="ly" v-model.number="ly" type="number" min="1000" max="2050" /></div>
      <div class="field"><label for="lm">월</label><input id="lm" v-model.number="lm" type="number" min="1" max="12" /></div>
      <div class="field"><label for="ld">일</label><input id="ld" v-model.number="ld" type="number" min="1" max="30" /></div>
    </div>
    <label class="check"><input v-model="leap" type="checkbox" /> 윤달</label>
    <p v-if="l2s && 'error' in l2s" class="error">{{ l2s.error }}</p>
    <div v-else-if="l2s" class="result" aria-live="polite">
      <div class="sub">음력 {{ ly }}년 {{ leap ? '윤' : '' }}{{ lm }}월 {{ ld }}일은 양력으로</div>
      <div class="big">{{ formatKo(l2s.solar) }}</div>
      <div v-if="l2s.gapja" class="sub">{{ l2s.gapja }}</div>
    </div>

    <template v-if="table.length">
      <h3 style="margin: 22px 0 6px; font-size: 1rem">음력 {{ leap ? '윤' : '' }}{{ lm }}월 {{ ld }}일, 앞으로 10년 양력 날짜 (음력 생일)</h3>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>연도</th><th>양력 날짜</th><th>참고</th></tr></thead>
          <tbody>
            <tr v-for="r in table" :key="r.year" :class="{ next: r.year === thisYear }">
              <td>{{ r.year }}년</td><td>{{ formatKo(r.solar) }}</td><td>{{ r.note }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </template>
  <p class="muted" style="margin: 12px 0 0">한국천문연구원 기준 음력이에요. 1000년 ~ 2050년까지 계산할 수 있어요.</p>
</template>
