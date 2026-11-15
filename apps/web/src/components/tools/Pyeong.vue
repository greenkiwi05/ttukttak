<script setup lang="ts">
// 평수 계산기 UI. 로직은 src/lib/pyeong.js — 한쪽을 입력하면 다른 쪽이 바로 바뀐다.
import { ref } from 'vue';
import { pyeongToM2, m2ToPyeong, parseArea, COMMON_M2 } from '../../lib/pyeong.js';

const pyeong = ref('');
const m2 = ref('');

function onPyeong() {
  const v = parseArea(pyeong.value);
  m2.value = v === null ? '' : String(pyeongToM2(v));
}
function onM2() {
  const v = parseArea(m2.value);
  pyeong.value = v === null ? '' : String(m2ToPyeong(v));
}
function pick(v: number) {
  m2.value = String(v);
  onM2();
}
</script>

<template>
  <div class="row">
    <div class="field">
      <label for="pyeong">평</label>
      <input id="pyeong" v-model="pyeong" type="text" inputmode="decimal" placeholder="예: 32" @input="onPyeong" />
    </div>
    <div class="field">
      <label for="m2">제곱미터(㎡)</label>
      <input id="m2" v-model="m2" type="text" inputmode="decimal" placeholder="예: 84" @input="onM2" />
    </div>
  </div>
  <p class="muted" style="margin: 10px 0 0">1평 = 3.3058㎡ · 1㎡ = 0.3025평</p>

  <div v-if="pyeong && m2" class="result" aria-live="polite">
    <div class="big">{{ m2 }}㎡ = {{ pyeong }}평</div>
  </div>

  <h3 style="margin: 22px 0 6px; font-size: 1rem">자주 찾는 면적</h3>
  <div class="table-wrap">
    <table class="table">
      <thead><tr><th>전용면적</th><th>평 환산</th><th></th></tr></thead>
      <tbody>
        <tr v-for="v in COMMON_M2" :key="v">
          <td>{{ v }}㎡</td><td>약 {{ m2ToPyeong(v, 1) }}평</td>
          <td><button type="button" class="btn-sub" @click="pick(v)">입력</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
