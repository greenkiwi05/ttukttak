<script setup lang="ts">
// 로또 공 하나. 색은 번호 구간별(1~10 노랑, 11~20 파랑, 21~30 빨강, 31~40 회색, 41~45 초록)
import { ballBand } from '../lib/lotto.js';

const props = withDefaults(defineProps<{ n: number; size?: 'sm' | 'md' }>(), { size: 'md' });
const COLORS = ['#fbc400', '#69c8f2', '#ff7272', '#aaaaaa', '#b0d840'];
</script>

<template>
  <span class="lball" :class="props.size" :style="{ background: COLORS[ballBand(props.n)] }">{{ props.n }}</span>
</template>

<style scoped>
.lball {
  display: inline-grid; place-items: center; border-radius: 50%; color: #fff; font-weight: 800; flex: none;
  text-shadow: 0 1px 2px rgba(0, 0, 0, .35); box-shadow: inset -3px -4px 0 rgba(0, 0, 0, .12);
}
.md { width: 40px; height: 40px; font-size: 1rem; }
.sm { width: 30px; height: 30px; font-size: .82rem; }
@media (max-width: 420px) { .md { width: 36px; height: 36px; font-size: .92rem; } }
</style>
