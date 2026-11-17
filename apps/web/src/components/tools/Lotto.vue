<script setup lang="ts">
// 로또 번호 생성기 UI. 로직은 src/lib/lotto.js, 난수는 crypto 기반.
import { ref } from 'vue';
import { makeSets, parseNums, ballBand } from '../../lib/lotto.js';
import { cryptoRand } from '../../lib/ladder.js';

const COLORS = ['#fbc400', '#69c8f2', '#ff7272', '#aaaaaa', '#b0d840'];
const count = ref(5);
const fixedText = ref('');
const excludeText = ref('');
const sets = ref<number[][]>([]);
const error = ref('');
const copied = ref(false);
const spin = ref(0);

function run() {
  const r = makeSets({ count: count.value, fixed: parseNums(fixedText.value), exclude: parseNums(excludeText.value), rand: cryptoRand });
  if ('error' in r) { error.value = r.error; sets.value = []; return; }
  error.value = '';
  sets.value = r.sets;
  spin.value++;
}
async function copy() {
  const t = sets.value.map((s, i) => `${String.fromCharCode(65 + i)}: ${s.join(', ')}`).join('\n');
  try { await navigator.clipboard.writeText(t); } catch { /* 복사 불가 환경 */ }
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}
</script>

<template>
  <div class="field">
    <label>게임 수</label>
    <div class="chips"><button v-for="n in [1, 3, 5, 10]" :key="n" type="button" class="chip" :class="{ on: count === n }" @click="count = n">{{ n }}게임</button></div>
  </div>
  <div class="row" style="margin-top: 14px">
    <div class="field"><label for="fx">꼭 넣을 번호 (선택, 5개까지)</label><input id="fx" v-model="fixedText" type="text" inputmode="numeric" placeholder="예: 7, 23" /></div>
    <div class="field"><label for="ex">뺄 번호 (선택)</label><input id="ex" v-model="excludeText" type="text" inputmode="numeric" placeholder="예: 1, 45" /></div>
  </div>
  <button class="btn" type="button" @click="run">번호 뽑기</button>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <div v-if="sets.length" :key="spin" class="result lotto" aria-live="polite">
    <div v-for="(s, i) in sets" :key="i" class="lotto-row">
      <b class="lotto-label">{{ String.fromCharCode(65 + i) }}</b>
      <span v-for="(n, j) in s" :key="n" class="ball" :style="{ background: COLORS[ballBand(n)], animationDelay: (i * 6 + j) * 40 + 'ms' }">{{ n }}</span>
    </div>
    <button type="button" class="btn-sub" style="margin-top: 10px" @click="copy">{{ copied ? '복사됐어요' : '번호 복사' }}</button>
  </div>
  <p class="muted" style="margin: 10px 0 0">브라우저의 보안 난수로 뽑아요. 어떤 번호 조합이든 당첨 확률은 같아요.</p>
</template>

<style scoped>
.lotto-row { display: flex; align-items: center; gap: 6px; margin: 6px 0; flex-wrap: wrap; }
.lotto-label { width: 18px; color: var(--muted); }
.ball {
  width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 800;
  text-shadow: 0 1px 2px rgba(0, 0, 0, .35); box-shadow: inset -3px -4px 0 rgba(0, 0, 0, .12);
  animation: pop .35s ease-out both;
}
@keyframes pop { from { transform: scale(.2); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@media (max-width: 420px) { .ball { width: 34px; height: 34px; font-size: .9rem; } }
</style>
