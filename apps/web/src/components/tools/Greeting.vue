<script setup lang="ts">
// 경조사 문구 생성기 UI. 문구 데이터와 조합 로직은 src/lib/greeting.js (외부 API 없음)
import { ref, computed } from 'vue';
import { makeGreetings, SITUATIONS, RELATIONS, TONES, ENVELOPE } from '../../lib/greeting.js';

type S = keyof typeof SITUATIONS;
type R = keyof typeof RELATIONS;
type T = keyof typeof TONES;

const situation = ref<S>('wedding');
const relation = ref<R>('colleague');
const tone = ref<T>('formal');
const name = ref('');
const copied = ref(-1);

const list = computed(() => makeGreetings({ situation: situation.value, relation: relation.value, tone: tone.value, name: name.value }));
const envelope = computed(() => ENVELOPE[situation.value]);

async function copy(text: string, i: number) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  copied.value = i;
  setTimeout(() => (copied.value === i ? (copied.value = -1) : 0), 1500);
}
</script>

<template>
  <div class="field">
    <label>상황</label>
    <div class="chips">
      <button v-for="(label, k) in SITUATIONS" :key="k" type="button" class="chip" :class="{ on: situation === k }" @click="situation = k">{{ label }}</button>
    </div>
  </div>
  <div class="field" style="margin-top: 14px">
    <label>받는 사람</label>
    <div class="chips">
      <button v-for="(label, k) in RELATIONS" :key="k" type="button" class="chip" :class="{ on: relation === k }" @click="relation = k">{{ label }}</button>
    </div>
  </div>
  <div class="row" style="margin-top: 14px">
    <div class="field">
      <label>말투</label>
      <div class="chips">
        <button v-for="(label, k) in TONES" :key="k" type="button" class="chip" :class="{ on: tone === k }" @click="tone = k">{{ label }}</button>
      </div>
    </div>
    <div class="field">
      <label for="name">받는 사람 이름 (선택)</label>
      <input id="name" v-model="name" type="text" maxlength="20" placeholder="예: 김민수, 박부장" />
    </div>
  </div>

  <ul class="file-list" style="margin-top: 18px" aria-live="polite">
    <li v-for="(t, i) in list" :key="t" style="align-items: flex-start">
      <span style="flex: 1">{{ t }}</span>
      <button type="button" class="btn-sub" @click="copy(t, i)">{{ copied === i ? '복사됨' : '복사' }}</button>
    </li>
  </ul>

  <div v-if="envelope.length" class="notice">
    <b>봉투·리본 문구</b> · {{ envelope.join(' · ') }}
  </div>
</template>
