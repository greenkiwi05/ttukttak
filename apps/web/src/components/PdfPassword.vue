<script setup lang="ts">
// PDF 비밀번호 입력 (PDF 도구 공용). 비밀번호는 화면 안에서만 쓰고 저장하거나 보내지 않는다.
import { ref, watch, nextTick, onMounted } from 'vue';

const props = defineProps<{ name: string; wrong: boolean; busy?: boolean; change?: boolean }>();
const emit = defineEmits<{ submit: [password: string]; cancel: [] }>();
const pw = ref('');
const show = ref(false);
const input = ref<HTMLInputElement | null>(null);

const focus = () => nextTick(() => { input.value?.focus(); input.value?.select(); });
onMounted(focus);
watch(() => props.name, () => { pw.value = ''; show.value = false; focus(); });
watch(() => props.busy, (b) => { if (!b && props.wrong) focus(); });
</script>

<template>
  <form class="pdf-pw" @submit.prevent="pw && !busy && emit('submit', pw)">
    <label for="pdf-pw">🔒 비밀번호가 걸린 PDF예요</label>
    <p class="muted name">{{ name }}</p>
    <div class="line">
      <input id="pdf-pw" ref="input" v-model="pw" :type="show ? 'text' : 'password'" autocomplete="off" autocapitalize="off" spellcheck="false" :placeholder="change ? '지금 비밀번호' : '비밀번호 입력'" :aria-invalid="wrong" />
      <button type="button" class="btn-sub" @click="show = !show">{{ show ? '숨기기' : '보기' }}</button>
    </div>
    <p v-if="wrong && !busy" class="error" role="alert">비밀번호가 맞지 않아요. 다시 확인해 주세요.</p>
    <div class="line acts">
      <button type="submit" class="btn" :disabled="!pw || busy">{{ busy ? '여는 중…' : '열기' }}</button>
      <button type="button" class="btn-sub" :disabled="busy" @click="emit('cancel')">취소</button>
    </div>
    <p class="muted note">비밀번호는 서버로 보내거나 저장하지 않아요. <template v-if="!change">새로 만든 파일에는 비밀번호가 걸리지 않으니 보관에 주의하세요. </template>비밀번호를 모르면 열 수 없어요.</p>
  </form>
</template>

<style scoped>
.pdf-pw { margin-top: 14px; padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--bg); }
.name { margin: 0 0 8px; overflow-wrap: anywhere; }
.line { display: flex; gap: 8px; }
.line input { flex: 1; min-width: 0; }
.line .btn-sub { flex: none; }
.acts { margin-top: 10px; }
.acts .btn { flex: 1; width: auto; margin-top: 0; }
.note { margin: 10px 0 0; font-size: .88rem; }
</style>
