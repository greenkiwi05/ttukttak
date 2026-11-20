<script setup lang="ts">
// 단어 수 세기 UI. 로직은 src/lib/charCount.js(wordStats·cutWords) — 입력한 글은 저장하지도, 서버로 보내지도 않는다.
import { ref, computed } from 'vue';
import { countText, wordStats, cutWords } from '../../lib/charCount.js';

const text = ref('');
const limit = ref<number | ''>('');
const LIMITS = [100, 250, 500, 1000];

const w = computed(() => wordStats(text.value));
const c = computed(() => countText(text.value));
const pct = computed(() => (limit.value ? Math.min(100, (w.value.words / Number(limit.value)) * 100) : 0));
const over = computed(() => (limit.value ? w.value.words - Number(limit.value) : 0));
const fmt = (n: number) => n.toLocaleString('ko-KR');
const read = computed(() => {
  const m = w.value.readMin;
  if (!w.value.words) return '0분';
  if (m < 1) return '1분 미만';
  return `약 ${Math.round(m)}분`;
});

const stats = computed(() => [
  ['단어', fmt(w.value.words)],
  ['서로 다른 단어', fmt(w.value.unique)],
  ['문장', fmt(w.value.sentences)],
  ['문단', fmt(c.value.paragraphs)],
  ['글자 (공백 포함)', fmt(c.value.chars)],
  ['글자 (공백 제외)', fmt(c.value.charsNoSpace)],
  ['평균 단어 길이', w.value.words ? `${w.value.avgLen.toFixed(1)}자` : '0자'],
  ['읽는 시간', read.value],
]);
</script>

<template>
  <div class="field">
    <label for="wtxt">글 입력</label>
    <textarea id="wtxt" v-model="text" rows="10" placeholder="Paste or type your essay here. 영어·한국어 모두 단어 수를 세요." class="textarea"></textarea>
  </div>

  <div class="stat-grid" aria-live="polite">
    <div v-for="[label, v] in stats" :key="label" class="stat">
      <small>{{ label }}</small>
      <b>{{ v }}</b>
    </div>
  </div>

  <div class="field" style="margin-top: 16px">
    <label for="wlimit">목표 단어 수</label>
    <input id="wlimit" v-model.number="limit" type="number" min="1" inputmode="numeric" placeholder="예: 250" />
    <div class="chips">
      <button v-for="n in LIMITS" :key="n" type="button" class="chip" :class="{ on: limit === n }" @click="limit = n">{{ fmt(n) }}단어</button>
    </div>
  </div>
  <template v-if="limit">
    <div class="progress" style="height: 8px"><div :style="{ width: pct + '%', background: over > 0 ? '#c92a2a' : undefined }"></div></div>
    <p class="muted" style="margin: 6px 0 0">
      <template v-if="over > 0"><b style="color: #c92a2a">{{ fmt(over) }}단어 초과</b> · </template>
      <template v-else>{{ fmt(-over) }}단어 남음 · </template>
      {{ fmt(w.words) }} / {{ fmt(Number(limit)) }}단어
      <button v-if="over > 0" type="button" class="btn-sub" style="margin-left: 8px; padding: 4px 10px" @click="text = cutWords(text, Number(limit))">초과분 자르기</button>
    </p>
  </template>

  <div v-if="w.top.length" class="field" style="margin-top: 16px">
    <label>자주 쓴 단어 <small class="muted">(2번 이상, the·and 같은 기능어 제외)</small></label>
    <div class="chips">
      <span v-for="[word, n] in w.top" :key="word" class="chip top">{{ word }} <b>{{ n }}</b></span>
    </div>
  </div>

  <div style="display: flex; gap: 8px; margin-top: 14px">
    <button type="button" class="btn-sub" @click="text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()">공백 정리</button>
    <button type="button" class="btn-sub" @click="text = ''">지우기</button>
  </div>
</template>

<style scoped>
.top { cursor: default; }
.top b { color: var(--accent); margin-left: 2px; }
</style>
