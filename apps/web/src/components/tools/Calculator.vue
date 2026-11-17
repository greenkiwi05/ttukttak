<script setup lang="ts">
// 공학용 계산기 UI. 수식 해석은 src/lib/calcExpr.js (eval 사용 안 함). 키보드로 바로 입력해도 된다.
import { ref, computed } from 'vue';
import { evaluate, fmtResult } from '../../lib/calcExpr.js';

const expr = ref('');
const deg = ref(true);
const history = ref<{ expr: string; result: string }[]>([]);
const inputEl = ref<HTMLInputElement | null>(null);
const shownError = ref('');

const preview = computed(() => {
  if (!expr.value.trim()) return '';
  const r = evaluate(expr.value, { deg: deg.value });
  return 'error' in r ? '' : fmtResult(r.value);
});

const KEYS: [string, string, string?][] = [
  ['sin', 'sin('], ['cos', 'cos('], ['tan', 'tan('], ['(', '('], [')', ')'],
  ['ln', 'ln('], ['log', 'log('], ['√', '√('], ['xʸ', '^'], ['n!', '!'],
  ['7', '7'], ['8', '8'], ['9', '9'], ['÷', '÷', 'op'], ['⌫', 'back', 'fn'],
  ['4', '4'], ['5', '5'], ['6', '6'], ['×', '×', 'op'], ['AC', 'clear', 'fn'],
  ['1', '1'], ['2', '2'], ['3', '3'], ['−', '−', 'op'], ['π', 'π'],
  ['0', '0'], ['.', '.'], ['%', '%'], ['+', '+', 'op'], ['=', 'eq', 'eq'],
];

function press(v: string) {
  shownError.value = '';
  if (v === 'clear') expr.value = '';
  else if (v === 'back') expr.value = expr.value.slice(0, -1);
  else if (v === 'eq') return calc();
  else expr.value += v;
  inputEl.value?.focus();
}
function calc() {
  const r = evaluate(expr.value, { deg: deg.value });
  if ('error' in r) { shownError.value = r.error; return; }
  const out = fmtResult(r.value);
  history.value.unshift({ expr: expr.value, result: out });
  history.value = history.value.slice(0, 6);
  expr.value = String(r.value);
}
function useHistory(h: { expr: string }) { expr.value = h.expr; inputEl.value?.focus(); }
</script>

<template>
  <div class="calc">
    <div class="calc-screen">
      <div class="calc-mode">
        <button type="button" :class="{ on: deg }" @click="deg = true">DEG</button>
        <button type="button" :class="{ on: !deg }" @click="deg = false">RAD</button>
      </div>
      <input ref="inputEl" v-model="expr" class="calc-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false"
             aria-label="수식" placeholder="0" @keydown.enter.prevent="calc" @input="shownError = ''" />
      <div class="calc-preview" aria-live="polite">{{ shownError || (preview ? '= ' + preview : ' ') }}</div>
    </div>
    <div class="calc-keys">
      <button v-for="[label, val, kind] in KEYS" :key="label" type="button" :class="['ck', kind]" :aria-label="label === '⌫' ? '지우기' : label" @click="press(val)">{{ label }}</button>
    </div>
  </div>
  <ul v-if="history.length" class="file-list" style="margin-top: 12px">
    <li v-for="(h, i) in history" :key="i" style="cursor: pointer" @click="useHistory(h)">
      <span class="name" style="color: var(--muted)">{{ h.expr }}</span><b>= {{ h.result }}</b>
    </li>
  </ul>
  <p class="muted" style="margin: 10px 0 0">키보드로 바로 입력하고 Enter를 눌러도 돼요. 각도는 DEG(도)·RAD(라디안) 중에 고르세요.</p>
</template>

<style scoped>
.calc { max-width: 440px; margin: 0 auto; }
.calc-screen { background: #1f1f1d; color: #fff; border-radius: 14px; padding: 12px 16px 14px; }
.calc-mode { display: flex; gap: 4px; }
.calc-mode button { border: 0; border-radius: 6px; padding: 3px 8px; font-size: .75rem; background: #3a3a37; color: #bbb; cursor: pointer; }
.calc-mode button.on { background: var(--accent); color: #fff; }
.calc-input { width: 100%; background: transparent; border: 0; outline: 0; color: #fff; font: inherit; font-size: 1.9rem; text-align: right; padding: 8px 0 0; }
.calc-input::placeholder { color: #777; }
.calc-preview { text-align: right; color: #aaa; min-height: 1.4em; font-size: 1rem; }
.calc-keys { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 10px; }
.ck { border: 1px solid var(--line); background: #fff; border-radius: 12px; padding: 14px 0; font: inherit; font-size: 1.05rem; cursor: pointer; color: var(--text); -webkit-tap-highlight-color: transparent; }
.ck:active { transform: scale(.97); }
.ck.op { background: var(--accent-soft); color: var(--accent); font-weight: 700; }
.ck.fn { background: #efeee8; }
.ck.eq { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 700; }
</style>
