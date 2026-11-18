<script setup lang="ts">
// 사다리타기 UI. 사다리 생성·추적은 src/lib/ladder.js, 그리기는 SVG. 난수는 crypto 기반.
import { ref, computed, watch } from 'vue';
import { makeLadder, trace, cryptoRand } from '../../lib/ladder.js';
import { ladderText } from '../../lib/shareText.js';
import { shareOrCopy } from '../../lib/share.js';

const ROWS = 10;
const COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f08c00', '#0c8599', '#e03131', '#5c7cfa', '#66a80f', '#d6336c', '#495057', '#7048e8'];

const count = ref(4);
const names = ref<string[]>(['', '', '', '']);
const results = ref<string[]>(['당첨', '꽝', '꽝', '꽝']);
const ladder = ref<ReturnType<typeof makeLadder> | null>(null);
const shown = ref<number[]>([]); // 공개된 출발점
const animating = ref<number | null>(null);

watch(count, (n) => {
  n = Math.min(12, Math.max(2, Math.round(n) || 2));
  names.value = Array.from({ length: n }, (_, i) => names.value[i] ?? '');
  results.value = Array.from({ length: n }, (_, i) => results.value[i] ?? (i === 0 ? '당첨' : '꽝'));
  ladder.value = null;
  shown.value = [];
});

const label = (i: number) => names.value[i]?.trim() || `${i + 1}번`;
const W = computed(() => count.value * 100); // viewBox 너비 (화면에서는 100%로 늘어남)
const H = 300;
const x = (c: number) => (W.value / count.value) * (c + 0.5);
const y = (r: number) => 10 + (r / ROWS) * (H - 20);

function start() {
  ladder.value = makeLadder(count.value, ROWS, cryptoRand);
  shown.value = [];
}
const paths = computed(() => (ladder.value ? Array.from({ length: count.value }, (_, i) => trace(ladder.value!, i)) : []));
const pathD = (i: number) => paths.value[i].path.map((p, k) => `${k ? 'L' : 'M'}${x(p.col)},${y(p.row)}`).join(' ');

function reveal(i: number) {
  if (!ladder.value || shown.value.includes(i)) return;
  shown.value.push(i);
  animating.value = i;
  setTimeout(() => (animating.value === i ? (animating.value = null) : 0), 1200);
}
const copied = ref(false);
async function share() {
  const text = ladderText(Array.from({ length: count.value }, (_, i) => label(i)), results.value, paths.value.map((p) => p.end));
  if ((await shareOrCopy({ title: '사다리타기 결과', text })) !== 'copied') return;
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}
const revealAll = () => { for (let i = 0; i < count.value; i++) if (!shown.value.includes(i)) shown.value.push(i); };
</script>

<template>
  <div class="field">
    <label for="cnt">참가 인원: {{ count }}명</label>
    <input id="cnt" v-model.number="count" type="range" min="2" max="12" style="width: 100%" />
  </div>
  <div class="ladder-inputs" :style="{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }">
    <input v-for="(_, i) in names" :key="'n' + i" v-model="names[i]" type="text" :placeholder="`${i + 1}번`" :aria-label="`${i + 1}번 참가자 이름`" />
  </div>

  <div v-if="ladder" class="ladder-wrap"><div class="ladder-inner" :style="{ minWidth: count * 56 + 'px' }">
    <div class="ladder-names" :style="{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }">
      <button v-for="i in count" :key="i" type="button" class="chip" :class="{ on: shown.includes(i - 1) }" :style="shown.includes(i - 1) ? { background: COLORS[i - 1], borderColor: COLORS[i - 1] } : {}" @click="reveal(i - 1)">{{ label(i - 1) }}</button>
    </div>
    <svg width="100%" :height="H" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img" aria-label="사다리">
      <line v-for="c in count" :key="'v' + c" :x1="x(c - 1)" :x2="x(c - 1)" :y1="y(0)" :y2="y(ROWS)" stroke="#ced4da" stroke-width="3" vector-effect="non-scaling-stroke" />
      <template v-for="(row, r) in ladder.rungs" :key="'r' + r">
        <line v-for="(on, c) in row" v-show="on" :key="c" :x1="x(c)" :x2="x(c + 1)" :y1="y(r + 0.5)" :y2="y(r + 0.5)" stroke="#ced4da" stroke-width="3" vector-effect="non-scaling-stroke" />
      </template>
      <path v-for="i in shown" :key="'p' + i" :d="pathD(i)" fill="none" :stroke="COLORS[i]" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"
            pathLength="1" :class="{ draw: animating === i }" />
    </svg>
    <div class="ladder-names" :style="{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }">
      <span v-for="(res, c) in results" :key="'res' + c" class="ladder-res">
        <template v-for="i in shown" :key="i"><b v-if="paths[i].end === c" :style="{ color: COLORS[i] }">{{ label(i) }}<br /></b></template>
        {{ res || '-' }}
      </span>
    </div>
  </div></div>

  <div class="ladder-inputs" :style="{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, marginTop: '10px' }">
    <input v-for="(_, i) in results" :key="'r' + i" v-model="results[i]" type="text" :aria-label="`${i + 1}번째 결과`" />
  </div>

  <button class="btn" type="button" @click="start">{{ ladder ? '사다리 다시 만들기' : '사다리 만들기' }}</button>
  <button v-if="ladder && shown.length < count" type="button" class="btn-sub" style="width: 100%; margin-top: 8px" @click="revealAll">결과 한 번에 보기</button>
  <button v-if="ladder && shown.length === count" type="button" class="btn-sub" style="width: 100%; margin-top: 8px" @click="share">{{ copied ? '복사됐어요' : '결과 공유·복사 (카톡 등)' }}</button>
  <p v-if="ladder" class="muted" style="margin: 8px 0 0">위쪽 이름을 누르면 한 명씩 사다리를 타요.</p>
</template>

<style scoped>
.ladder-inputs { display: grid; gap: 6px; }
.ladder-inputs input { padding: 8px 6px; font-size: .9rem; text-align: center; min-width: 0; }
.ladder-wrap { overflow-x: auto; margin-top: 14px; }
.ladder-names { display: grid; gap: 6px; }
.ladder-names .chip { padding: 6px 4px; font-size: .85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ladder-wrap svg { display: block; margin: 4px 0; }
.ladder-res { text-align: center; font-size: .9rem; word-break: break-all; }
.draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1.2s ease-out forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
</style>
