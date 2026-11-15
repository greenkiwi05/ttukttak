<script setup lang="ts">
// 공용 날짜 입력칸: 키보드로 바로 치거나(19980510, 1998.5.10, 980510) 달력 버튼으로 고른다.
// 브라우저 기본 date 입력은 생년월일처럼 먼 날짜를 고르기 불편해서 대신 쓴다. v-model 값은 'YYYY-MM-DD'.
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue';
import { parseDateInput, autoFormat, displayOf, monthGrid, shiftMonth, inRange } from '../lib/dateInput.js';
import { todayKST } from '../lib/date.js';

const props = withDefaults(
  defineProps<{ modelValue: string; id: string; min?: string; max?: string; initialView?: string; placeholder?: string }>(),
  { min: '1900-01-01', max: '2100-12-31', initialView: '', placeholder: '예: 1998.05.10' },
);
const emit = defineEmits<{ 'update:modelValue': [string] }>();

const today = todayKST();
const text = ref(displayOf(props.modelValue));
const touched = ref(false);
const open = ref(false);
const view = ref({ y: 2000, m: 1 });
const root = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);

// 바깥에서 값이 바뀐 경우에만 입력칸을 다시 채운다 (내가 방금 보낸 값이면 무시 → 치는 중인 글자가 지워지지 않음)
let lastEmitted: string | null = null;
function send(v: string) { lastEmitted = v; emit('update:modelValue', v); }
watch(() => props.modelValue, (v) => {
  if (v === lastEmitted) return;
  lastEmitted = null;
  text.value = displayOf(v);
});

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  text.value = autoFormat(raw);
  if (text.value !== raw) (e.target as HTMLInputElement).value = text.value;
  const iso = parseDateInput(text.value);
  send(iso && inRange(iso, props.min, props.max) ? iso : '');
}
function onBlur() {
  touched.value = true;
  const iso = parseDateInput(text.value);
  if (iso && inRange(iso, props.min, props.max)) text.value = displayOf(iso);
}
const error = computed(() => {
  if (!touched.value || !text.value.trim()) return '';
  const iso = parseDateInput(text.value);
  if (!iso) return '날짜를 확인해 주세요. 예: 1998.05.10 또는 19980510';
  if (!inRange(iso, props.min, props.max)) return `${displayOf(props.min)} ~ ${displayOf(props.max)} 사이로 입력해 주세요.`;
  return '';
});

// ── 달력
const years = computed(() => {
  const a = Number(props.min.slice(0, 4)), b = Number(props.max.slice(0, 4));
  return Array.from({ length: b - a + 1 }, (_, i) => b - i); // 최근 연도가 위로
});
const cells = computed(() => monthGrid(view.value.y, view.value.m));

function toggle() {
  if (open.value) { open.value = false; return; }
  const base = props.modelValue || (props.initialView ? props.initialView + '-01' : today);
  view.value = { y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) };
  open.value = true;
  nextTick(() => root.value?.querySelector<HTMLButtonElement>('.cal-day.sel, .cal-day.today, .cal-day:not(:disabled)')?.focus());
}
function go(delta: number) { view.value = shiftMonth(view.value.y, view.value.m, delta); }
function pick(iso: string) {
  text.value = displayOf(iso);
  touched.value = true;
  send(iso);
  open.value = false;
  inputEl.value?.focus();
}
function onDocDown(e: PointerEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false;
}
watch(open, (o) => (o ? document.addEventListener('pointerdown', onDocDown) : document.removeEventListener('pointerdown', onDocDown)));
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocDown));
const WD = ['일', '월', '화', '수', '목', '금', '토'];
</script>

<template>
  <div ref="root" class="date-input" @keydown.esc="open = false">
    <input
      :id="id" ref="inputEl" :value="text" type="text" inputmode="numeric" autocomplete="off" :placeholder="placeholder"
      :aria-invalid="!!error" @input="onInput" @blur="onBlur"
    />
    <button type="button" class="cal-btn" :aria-expanded="open" aria-label="달력에서 고르기" @click="toggle">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
    </button>
    <p v-if="error" class="error" style="margin: 6px 0 0; font-size: .88rem">{{ error }}</p>

    <div v-if="open" class="cal" role="dialog" aria-label="날짜 고르기">
      <div class="cal-head">
        <button type="button" class="cal-nav" aria-label="이전 달" @click="go(-1)">‹</button>
        <select v-model.number="view.y" aria-label="연도">
          <option v-for="y in years" :key="y" :value="y">{{ y }}년</option>
        </select>
        <select v-model.number="view.m" aria-label="월">
          <option v-for="m in 12" :key="m" :value="m">{{ m }}월</option>
        </select>
        <button type="button" class="cal-nav" aria-label="다음 달" @click="go(1)">›</button>
      </div>
      <div class="cal-grid">
        <span v-for="(w, i) in WD" :key="w" class="cal-wd" :class="{ sun: i === 0, sat: i === 6 }">{{ w }}</span>
        <button
          v-for="(c, i) in cells" :key="c.iso" type="button" class="cal-day"
          :class="{ out: !c.inMonth, sel: c.iso === modelValue, today: c.iso === today, sun: i % 7 === 0, sat: i % 7 === 6 }"
          :disabled="!inRange(c.iso, min, max)" :aria-label="c.iso" :aria-pressed="c.iso === modelValue"
          @click="pick(c.iso)"
        >{{ c.day }}</button>
      </div>
      <div class="cal-foot">
        <button type="button" class="btn-sub" :disabled="!inRange(today, min, max)" @click="pick(today)">오늘</button>
        <button type="button" class="btn-sub" @click="open = false">닫기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.date-input { position: relative; }
.date-input input { width: 100%; padding-right: 48px; }
.date-input input[aria-invalid='true'] { border-color: #c92a2a; }
.cal-btn {
  position: absolute; top: 6px; right: 6px; width: 38px; height: 38px; border: 0; border-radius: 8px;
  background: transparent; color: var(--muted); cursor: pointer; display: grid; place-items: center;
  -webkit-tap-highlight-color: transparent;
}
.cal-btn:hover, .cal-btn[aria-expanded='true'] { background: var(--accent-soft); color: var(--accent); }
.cal {
  position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; width: 300px; max-width: calc(100vw - 40px);
  background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
  box-shadow: 0 12px 32px rgba(0, 0, 0, .12); padding: 12px;
}
.cal-head { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
.cal-head select { flex: 1; width: auto; padding: 8px 6px; font-size: .95rem; }
.cal-nav { width: 34px; height: 38px; border: 1px solid var(--line); border-radius: 8px; background: #fff; cursor: pointer; font-size: 1.2rem; flex: none; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; }
.cal-wd { font-size: .78rem; color: var(--muted); padding: 4px 0; }
.cal-day { aspect-ratio: 1; border: 0; border-radius: 8px; background: none; cursor: pointer; font-size: .92rem; color: var(--text); }
.cal-day:hover:not(:disabled) { background: var(--accent-soft); }
.cal-day.out { color: #c4c2bb; }
.sun { color: #e03131; }
.sat { color: #1c7ed6; }
.cal-day.out.sun, .cal-day.out.sat { opacity: .45; }
.cal-day.today { box-shadow: inset 0 0 0 1.5px var(--accent); }
.cal-day.sel { background: var(--accent); color: #fff; font-weight: 700; }
.cal-day:disabled { opacity: .25; cursor: default; }
.cal-foot { display: flex; justify-content: space-between; margin-top: 8px; }
</style>
