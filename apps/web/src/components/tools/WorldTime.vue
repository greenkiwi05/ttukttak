<script setup lang="ts">
// 세계 시간·시차 계산기 UI. 로직은 src/lib/worldTime.js (브라우저 IANA 시간대, 서머타임 자동 반영)
// 고른 도시는 이 기기에만 기억한다.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import DateInput from '../DateInput.vue';
import { CITIES, DEFAULT_CITIES, cityById, zonedToUtc, localInfo, diffLabel, utcLabel, isDst, fmtLocal, dayPart } from '../../lib/worldTime.js';

const mode = ref<'now' | 'pick'>('now');
const base = ref('seoul');
const ids = ref<string[]>([...DEFAULT_CITIES]);
const add = ref('');
const now = ref<number | null>(null); // 화면에 붙은 뒤 채운다 (서버 렌더와 어긋나지 않게)
const date = ref('');
const time = ref('09:00');
let timer: ReturnType<typeof setInterval> | null = null;

const KEY = 'ttukttak:worldtime';
onMounted(() => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (Array.isArray(s.ids) && s.ids.every((x: string) => cityById(x))) ids.value = s.ids;
    if (s.base && cityById(s.base)) base.value = s.base;
  } catch { /* 저장 불가 */ }
  now.value = Date.now();
  timer = setInterval(() => (now.value = Date.now()), 15000);
  const b = localInfo(cityById(base.value)!.tz, now.value);
  date.value = `${b.y}-${String(b.m).padStart(2, '0')}-${String(b.d).padStart(2, '0')}`;
});
onBeforeUnmount(() => timer && clearInterval(timer));
watch([ids, base], () => { try { localStorage.setItem(KEY, JSON.stringify({ ids: ids.value, base: base.value })); } catch { /* 저장 불가 */ } }, { deep: true });

const baseCity = computed(() => cityById(base.value)!);
// 보여줄 순간: 지금, 또는 기준 도시의 고른 날짜·시각
const moment = computed(() => {
  if (mode.value === 'now' || !date.value || !/^\d{2}:\d{2}$/.test(time.value)) return now.value;
  const [y, m, d] = date.value.split('-').map(Number);
  const [h, mi] = time.value.split(':').map(Number);
  return zonedToUtc({ y, m, d, h, mi }, baseCity.value.tz);
});
const baseInfo = computed(() => (moment.value === null ? null : localInfo(baseCity.value.tz, moment.value)));
const cards = computed(() => {
  if (moment.value === null || !baseInfo.value) return [];
  const all = ids.value.includes(base.value) ? ids.value : [base.value, ...ids.value];
  return all.map((id) => {
    const c = cityById(id)!;
    const info = localInfo(c.tz, moment.value!);
    return { ...c, info, f: fmtLocal(info, baseInfo.value!), diff: info.offset - baseInfo.value!.offset, dst: isDst(c.tz, moment.value!), part: dayPart(info.h) };
  });
});
const addable = computed(() => CITIES.filter((c) => !ids.value.includes(c.id)));
function addCity() { if (add.value && !ids.value.includes(add.value)) ids.value.push(add.value); add.value = ''; }
function remove(id: string) { ids.value = ids.value.filter((x) => x !== id); if (base.value === id) base.value = ids.value[0] ?? 'seoul'; }
const PART = { work: '업무 시간', free: '저녁·이른 아침', night: '잠잘 시간' };
</script>

<template>
  <div class="tabs" role="tablist">
    <button type="button" role="tab" :aria-selected="mode === 'now'" @click="mode = 'now'">지금 세계 시간</button>
    <button type="button" role="tab" :aria-selected="mode === 'pick'" @click="mode = 'pick'">시간 정해서 바꾸기</button>
  </div>

  <div class="row">
    <div class="field">
      <label for="wt-base">기준 도시</label>
      <select id="wt-base" v-model="base">
        <option v-for="c in CITIES" :key="c.id" :value="c.id">{{ c.name }} ({{ c.country }})</option>
      </select>
    </div>
    <div class="field">
      <label for="wt-add">도시 추가</label>
      <select id="wt-add" v-model="add" @change="addCity">
        <option value="">도시를 고르세요</option>
        <option v-for="c in addable" :key="c.id" :value="c.id">{{ c.name }} ({{ c.country }})</option>
      </select>
    </div>
  </div>

  <div v-if="mode === 'pick'" class="row" style="margin-top: 12px">
    <div class="field"><label for="wt-date">{{ baseCity.name }} 날짜</label><DateInput id="wt-date" v-model="date" placeholder="예: 2026.12.24" /></div>
    <div class="field"><label for="wt-time">{{ baseCity.name }} 시각</label><input id="wt-time" v-model="time" type="time" step="300" /></div>
  </div>

  <div v-if="cards.length" class="cards" aria-live="polite">
    <div v-for="c in cards" :key="c.id" class="city" :class="[c.part, { base: c.id === base }]">
      <div class="head">
        <b>{{ c.name }}</b>
        <button v-if="c.id !== base" type="button" class="x" :aria-label="`${c.name} 빼기`" @click="remove(c.id)">×</button>
        <small v-else class="tag">기준</small>
      </div>
      <div class="time">{{ c.f.time }}</div>
      <div class="date">{{ c.f.date }} <span v-if="c.f.dayNote" class="note">{{ c.f.dayNote }}</span></div>
      <small class="muted">{{ c.id === base ? c.country : diffLabel(c.diff, baseCity.name) }}</small>
      <small class="muted">{{ utcLabel(c.info.offset) }}<template v-if="c.dst"> · 서머타임</template> · <span class="part">{{ PART[c.part as keyof typeof PART] }}</span></small>
    </div>
  </div>
  <p class="muted" style="margin: 12px 0 0">서머타임은 날짜에 맞춰 자동으로 반영돼요. 카드 색: 초록은 업무 시간(9~18시), 회색은 잠잘 시간(23~7시)이에요.</p>
</template>

<style scoped>
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; margin-top: 16px; }
.city { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; background: #fff; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.city.base { border-color: var(--accent); background: var(--accent-soft); }
.city.work { box-shadow: inset 4px 0 0 #2f9e44; }
.city.night { box-shadow: inset 4px 0 0 #adb5bd; }
.city.free { box-shadow: inset 4px 0 0 #f59f00; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.head b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.x { border: 0; background: none; font-size: 1.1rem; color: var(--muted); cursor: pointer; padding: 0 2px; }
.tag { color: var(--accent); font-weight: 700; }
.time { font-size: 1.5rem; font-weight: 800; }
.date { font-size: .9rem; }
.note { color: #c92a2a; font-weight: 700; margin-left: 2px; }
</style>
