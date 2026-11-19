<script setup lang="ts">
// 돌림판 UI. 로직은 src/lib/wheel.js. 결과는 보안 난수로 먼저 정하고, 판이 그 칸에 멈추게 돌린다.
// 입력한 항목은 이 기기에만 기억한다(편의). 서버로 보내지 않는다.
import { ref, computed, watch, onMounted } from 'vue';
import { PRESETS, MAX_ITEMS, colorFor, pickIndex, spinTo, slicePath, labelPos, parseItems, shortLabel } from '../../lib/wheel.js';
import { cryptoRand } from '../../lib/ladder.js';
import { wheelText } from '../../lib/shareText.js';
import { shareOrCopy } from '../../lib/share.js';

const text = ref(PRESETS[0].items.join('\n'));
const parsed = computed(() => parseItems(text.value));
const items = computed(() => parsed.value.items);
const n = computed(() => items.value.length);

const rotation = ref(0);
const spinning = ref(false);
const result = ref<string | null>(null);
const history = ref<string[]>([]);
const removeWinner = ref(false);
const reduce = ref(false);
const DURATION = 4200;

const KEY = 'ttukttak:wheel';
onMounted(() => {
  reduce.value = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  try { const s = localStorage.getItem(KEY); if (s) text.value = s; } catch { /* 저장 불가 */ }
});
let keepResult = false; // 뽑힌 항목을 뺄 때는 결과를 그대로 보여 준다
watch(text, (v) => {
  try { localStorage.setItem(KEY, v); } catch { /* 저장 불가 */ }
  if (!keepResult) result.value = null;
  keepResult = false;
});

function spin() {
  if (spinning.value || n.value < 2) return;
  const index = pickIndex(n.value, cryptoRand);
  result.value = null;
  spinning.value = true;
  rotation.value = spinTo({ current: rotation.value, index, n: n.value, jitter: cryptoRand(), turns: reduce.value ? 1 : 6 });
  const winner = items.value[index];
  setTimeout(() => {
    spinning.value = false;
    result.value = winner;
    history.value = [winner, ...history.value].slice(0, 10);
  }, reduce.value ? 600 : DURATION);
}
// 뽑힌 항목 빼고 다시: 목록에서 한 번만 지운다
function dropWinner() {
  if (!result.value) return;
  const list = [...items.value];
  const i = list.indexOf(result.value);
  if (i >= 0) list.splice(i, 1);
  keepResult = true;
  text.value = list.join('\n');
}
function preset(p: (typeof PRESETS)[number]) { text.value = p.items.join('\n'); }
function shuffleOrder() {
  const a = [...items.value];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(cryptoRand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  text.value = a.join('\n');
}
const copied = ref(false);
async function share() {
  if (!result.value) return;
  if ((await shareOrCopy({ title: '돌림판 결과', text: wheelText(result.value, items.value) })) !== 'copied') return;
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}
const fontSize = computed(() => (n.value <= 4 ? 11 : n.value <= 8 ? 9.5 : n.value <= 16 ? 7.5 : 5.5));
watch(result, (r) => { if (r && removeWinner.value) setTimeout(dropWinner, 1200); });
</script>

<template>
  <div class="wheel-box">
    <div class="pointer" aria-hidden="true"></div>
    <div class="disc"><svg viewBox="0 0 200 200" class="wheel" role="img" :aria-label="`돌림판, 항목 ${n}개`"
         :style="{ transform: `rotate(${rotation}deg)`, transitionDuration: (reduce ? 600 : DURATION) + 'ms' }">
      <g v-if="n">
        <path v-for="(it, i) in items" :key="i" :d="slicePath(i, n, 98)" :fill="colorFor(i, n)" stroke="#fff" stroke-width="1.2" />
        <text v-for="(it, i) in items" :key="'t' + i" :x="labelPos(i, n, 98).x" :y="labelPos(i, n, 98).y" :font-size="fontSize"
              text-anchor="middle" dominant-baseline="central" :transform="`rotate(${labelPos(i, n, 98).rotate} ${labelPos(i, n, 98).x} ${labelPos(i, n, 98).y})`">{{ shortLabel(it, n) }}</text>
      </g>
      <circle v-else cx="100" cy="100" r="98" fill="#f1f3f5" />
      <circle cx="100" cy="100" r="98" fill="none" stroke="#fff" stroke-width="3" />
    </svg></div>
    <button type="button" class="hub" :disabled="spinning || n < 2" @click="spin">{{ spinning ? '…' : '돌리기' }}</button>
  </div>

  <div class="result-line" aria-live="polite">
    <template v-if="result"><span class="muted">결과</span> <b>{{ result }}</b></template>
    <template v-else-if="spinning">두구두구…</template>
    <template v-else-if="n < 2">항목을 2개 이상 넣어 주세요.</template>
    <template v-else>가운데 버튼을 누르면 돌아가요.</template>
  </div>
  <div v-if="result" class="chips" style="justify-content: center">
    <button type="button" class="chip" @click="share">{{ copied ? '복사됐어요' : '결과 공유·복사' }}</button>
    <button v-if="!removeWinner && n > 2" type="button" class="chip" @click="dropWinner">이 항목 빼기</button>
  </div>

  <div class="field" style="margin-top: 18px">
    <label for="wh-items">항목 <small class="muted">(한 줄에 하나, 또는 쉼표로 구분 · 최대 {{ MAX_ITEMS }}개)</small></label>
    <textarea id="wh-items" v-model="text" rows="6" class="textarea" :disabled="spinning"></textarea>
    <small class="muted">{{ n }}개<template v-if="parsed.cut"> · {{ parsed.cut }}개는 넘쳐서 뺐어요</template></small>
    <div class="chips">
      <button v-for="p in PRESETS" :key="p.id" type="button" class="chip" :disabled="spinning" @click="preset(p)">{{ p.label }}</button>
      <button type="button" class="chip" :disabled="spinning || n < 2" @click="shuffleOrder">순서 섞기</button>
    </div>
    <label class="check"><input v-model="removeWinner" type="checkbox" /> 뽑힌 항목은 빼고 계속 돌리기</label>
  </div>

  <p v-if="history.length" class="muted" style="margin: 12px 0 0">최근 결과: {{ history.join(' → ') }}</p>
  <p class="muted" style="margin: 8px 0 0">결과는 브라우저의 보안 난수로 정해서 모든 칸이 나올 확률이 같아요.</p>
</template>

<style scoped>
.wheel-box { position: relative; width: min(100%, 380px); margin: 4px auto 0; aspect-ratio: 1; }
/* 돌아가는 판은 둥근 틀 안에서만 보이게 — 기울어진 사각형 영역이 화면 밖으로 넘쳐 가로 스크롤이 생기지 않도록 */
.disc { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; box-shadow: 0 4px 14px rgba(0, 0, 0, .14); }
.wheel { width: 100%; height: 100%; display: block; transition-property: transform; transition-timing-function: cubic-bezier(.12, .7, .1, 1); }
.wheel text { fill: #1a1a18; font-weight: 700; pointer-events: none; }
.pointer { position: absolute; top: -6px; left: 50%; transform: translateX(-50%); width: 0; height: 0; z-index: 2;
  border-left: 14px solid transparent; border-right: 14px solid transparent; border-top: 26px solid var(--text); filter: drop-shadow(0 2px 2px rgba(0, 0, 0, .25)); }
.hub { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 26%; aspect-ratio: 1; border-radius: 50%;
  border: 4px solid #fff; background: var(--accent); color: #fff; font-weight: 800; font-size: 1rem; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, .2); }
.hub:disabled { opacity: .85; cursor: default; }
.result-line { text-align: center; margin-top: 14px; font-size: 1.05rem; min-height: 1.6em; }
.result-line b { font-size: 1.6rem; color: var(--accent); margin-left: 4px; }
.check { display: inline-flex; gap: 6px; align-items: center; margin-top: 10px; font-weight: 500; }
@media (prefers-reduced-motion: reduce) { .wheel { transition-timing-function: ease-out; } }
</style>
