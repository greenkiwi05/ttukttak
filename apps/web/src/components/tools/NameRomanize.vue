<script setup lang="ts">
// 한글 이름 영어 변환 UI. 로직은 src/lib/romanize.js (국어의 로마자 표기법 + 관례 성 표기)
import { ref, computed, watch } from 'vue';
import { romanizeName } from '../../lib/romanize.js';

const input = ref('');
const surnameSpelling = ref('');
const hyphen = ref(false);
const copied = ref('');

const r = computed(() => (input.value.trim() ? romanizeName(input.value, { surnameSpelling: surnameSpelling.value, hyphen: hyphen.value }) : null));
const ok = computed(() => (r.value && !('error' in r.value) ? r.value : null));
const error = computed(() => (r.value && 'error' in r.value ? r.value.error : ''));
// 다른 성을 입력하면 성 표기 선택을 처음으로
watch(() => ok.value?.surname, () => (surnameSpelling.value = ''));

const rows = computed(() => (ok.value ? [
  ['여권·서류 (성 먼저, 대문자)', ok.value.passport],
  ['영어권 순서 (이름 먼저)', ok.value.western],
  ['한국식 순서 (성 먼저)', ok.value.korean],
] : []));

async function copy(t: string) {
  try { await navigator.clipboard.writeText(t); } catch { /* 복사 불가 환경 */ }
  copied.value = t;
  setTimeout(() => (copied.value === t ? (copied.value = '') : 0), 1500);
}
</script>

<template>
  <div class="field">
    <label for="nm">한글 이름</label>
    <input id="nm" v-model="input" type="text" maxlength="10" placeholder="예: 홍길동 (복성은 '남궁 민수'처럼 띄어 써도 돼요)" autocomplete="off" />
  </div>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <template v-if="ok">
    <div class="field" style="margin-top: 14px">
      <label>성 표기 <small class="muted">({{ ok.surname }} 씨를 쓰는 흔한 표기)</small></label>
      <div class="chips">
        <button v-for="s in ok.surnameOptions" :key="s" type="button" class="chip" :class="{ on: ok.romanSurname === s }" @click="surnameSpelling = s">{{ s }}</button>
      </div>
    </div>
    <label class="check"><input v-model="hyphen" type="checkbox" /> 이름 음절 사이에 붙임표(-) 넣기 (예: Gil-dong)</label>

    <ul class="file-list" style="margin-top: 14px" aria-live="polite">
      <li v-for="[label, v] in rows" :key="label" style="align-items: center">
        <span style="flex: 1">
          <small class="muted" style="display: block">{{ label }}</small>
          <b style="font-size: 1.25rem; letter-spacing: .01em">{{ v }}</b>
        </span>
        <button type="button" class="btn-sub" @click="copy(v)">{{ copied === v ? '복사됨' : '복사' }}</button>
      </li>
    </ul>
    <p class="notice">이미 여권이나 해외 카드에 쓰는 영문 이름이 있다면 그 표기를 그대로 쓰는 게 좋아요. 여권 영문 이름은 한 번 정하면 바꾸기 어려워요.</p>
  </template>
</template>
