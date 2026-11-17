<script setup lang="ts">
// 글자수 세기 UI. 로직은 src/lib/charCount.js — 입력한 글은 저장하지도, 서버로 보내지도 않는다.
import { ref, computed } from 'vue';
import { countText, cutTo } from '../../lib/charCount.js';

const text = ref('');
const limit = ref<number | ''>('');
const LIMITS = [500, 1000, 1500, 2000];

const r = computed(() => countText(text.value));
const pct = computed(() => (limit.value ? Math.min(100, (r.value.chars / Number(limit.value)) * 100) : 0));
const over = computed(() => (limit.value ? r.value.chars - Number(limit.value) : 0));
const fmt = (n: number) => n.toLocaleString('ko-KR');

const stats = computed(() => [
  ['공백 포함', r.value.chars],
  ['공백 제외', r.value.charsNoSpace],
  ['바이트 (한글 2)', r.value.bytesKr],
  ['바이트 (한글 3)', r.value.bytesUtf8],
  ['단어', r.value.words],
  ['줄', r.value.lines],
  ['문단', r.value.paragraphs],
  ['원고지 (200자)', r.value.manuscript],
]);
</script>

<template>
  <div class="field">
    <label for="txt">글 입력</label>
    <textarea id="txt" v-model="text" rows="10" placeholder="여기에 글을 붙여 넣거나 입력하세요." class="textarea"></textarea>
  </div>

  <div class="stat-grid" aria-live="polite">
    <div v-for="[label, n] in stats" :key="label" class="stat">
      <small>{{ label }}</small>
      <b>{{ fmt(n as number) }}</b>
    </div>
  </div>

  <div class="field" style="margin-top: 16px">
    <label for="limit">목표 글자수 (공백 포함)</label>
    <input id="limit" v-model.number="limit" type="number" min="1" inputmode="numeric" placeholder="예: 1000" />
    <div class="chips">
      <button v-for="n in LIMITS" :key="n" type="button" class="chip" :class="{ on: limit === n }" @click="limit = n">{{ fmt(n) }}자</button>
    </div>
  </div>
  <template v-if="limit">
    <div class="progress" style="height: 8px"><div :style="{ width: pct + '%', background: over > 0 ? '#c92a2a' : undefined }"></div></div>
    <p class="muted" style="margin: 6px 0 0">
      <template v-if="over > 0"><b style="color: #c92a2a">{{ fmt(over) }}자 초과</b> · </template>
      <template v-else>{{ fmt(-over) }}자 남음 · </template>
      {{ fmt(r.chars) }} / {{ fmt(Number(limit)) }}자
      <button v-if="over > 0" type="button" class="btn-sub" style="margin-left: 8px; padding: 4px 10px" @click="text = cutTo(text, Number(limit))">초과분 자르기</button>
    </p>
  </template>

  <div style="display: flex; gap: 8px; margin-top: 14px">
    <button type="button" class="btn-sub" @click="text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()">공백 정리</button>
    <button type="button" class="btn-sub" @click="text = ''">지우기</button>
  </div>
</template>
