<script setup lang="ts">
// 사진 글자 추출(OCR) UI. 정리 로직은 src/lib/ocr.js, 인식은 tesseract.js (브라우저 안 WASM, 이 페이지에서만 동적 import).
// 사진은 서버로 보내지 않는다. 인식 엔진과 언어 데이터는 처음 한 번 CDN에서 내려받아 브라우저에 저장된다.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { LANGS, IMAGE_EXTS, cleanText, statusKo, charCount } from '../../lib/ocr.js';
import { filterFiles } from '../../lib/files.js';

const MAX = 20 * 1024 * 1024;
const lang = ref('kor+eng');
const file = ref<File | null>(null);
const preview = ref('');
const busy = ref(false);
const status = ref('');
const progress = ref(0);
const raw = ref('');
const text = ref('');
const joinLines = ref(false);
const confidence = ref<number | null>(null);
const error = ref('');
const over = ref(false);
const copied = ref(false);
let worker: any = null;
let workerLang = '';

function setPreview(f: File) {
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = URL.createObjectURL(f);
}

async function setFile(list: FileList | File[] | null | undefined) {
  error.value = '';
  const f = list?.[0];
  if (!f) return;
  const r = filterFiles([f], { exts: IMAGE_EXTS, maxSize: MAX, maxCount: 1 });
  if (!r.accepted.length) { error.value = r.rejected[0].reason; return; }
  file.value = f;
  setPreview(f);
  await run();
}

// Ctrl+V로 캡처한 이미지 붙여넣기
function onPaste(e: ClipboardEvent) {
  const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
  const f = item?.getAsFile();
  if (f) { e.preventDefault(); setFile([new File([f], `캡처.${f.type.split('/')[1] || 'png'}`, { type: f.type })]); }
}
onMounted(() => window.addEventListener('paste', onPaste));
onBeforeUnmount(() => { window.removeEventListener('paste', onPaste); worker?.terminate?.(); if (preview.value) URL.revokeObjectURL(preview.value); });

async function getWorker() {
  if (worker && workerLang === lang.value) return worker;
  await worker?.terminate?.();
  const { createWorker } = await import('tesseract.js');
  worker = await createWorker(lang.value, 1, {
    logger: (m: { status: string; progress: number }) => { status.value = statusKo(m.status); progress.value = m.progress ?? 0; },
  });
  workerLang = lang.value;
  return worker;
}

async function run() {
  if (!file.value || busy.value) return;
  busy.value = true;
  error.value = '';
  raw.value = ''; text.value = ''; confidence.value = null;
  status.value = statusKo('loading');
  progress.value = 0;
  try {
    const w = await getWorker();
    const { data } = await w.recognize(file.value);
    raw.value = data.text ?? '';
    confidence.value = typeof data.confidence === 'number' ? Math.round(data.confidence) : null;
    text.value = cleanText(raw.value, { joinLines: joinLines.value });
    if (!charCount(text.value)) error.value = '글자를 찾지 못했어요. 글자가 크고 또렷하게 나온 사진으로 다시 시도해 보세요.';
  } catch {
    error.value = '글자를 읽지 못했어요. 인터넷 연결을 확인하고(처음 한 번 인식 엔진을 내려받아요) 다시 시도해 주세요.';
    await worker?.terminate?.(); worker = null;
  } finally {
    busy.value = false;
  }
}
function reformat() { text.value = cleanText(raw.value, { joinLines: joinLines.value }); }
async function copy() {
  try { await navigator.clipboard.writeText(text.value); } catch { /* 복사 불가 */ }
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}
const count = computed(() => charCount(text.value));
</script>

<template>
  <div class="field">
    <label>인식할 글자</label>
    <div class="chips" style="margin-top: 0">
      <button v-for="l in LANGS" :key="l.id" type="button" class="chip" :class="{ on: lang === l.id }" :disabled="busy" @click="lang = l.id; file && run()">{{ l.label }}</button>
    </div>
  </div>

  <label class="drop" style="margin-top: 12px" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; setFile($event.dataTransfer?.files)">
    <input type="file" accept="image/*" @change="setFile(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>{{ file ? file.name : '사진을 끌어다 놓거나 눌러서 고르세요' }}</strong><br />
    <small class="muted">JPG · PNG · WEBP, 캡처한 이미지는 Ctrl+V로 바로 붙여 넣어도 돼요 · 서버로 올라가지 않아요</small>
  </label>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <div v-if="file" class="ocr-grid">
    <img :src="preview" alt="고른 사진" class="ocr-img" />
    <div>
      <template v-if="busy">
        <div class="progress" style="height: 8px"><div :style="{ width: progress * 100 + '%' }"></div></div>
        <p class="muted" style="margin: 6px 0 0">{{ status }} {{ Math.round(progress * 100) }}%</p>
      </template>
      <template v-else-if="text">
        <div class="field">
          <label for="ocr-text">추출한 글자 <small class="muted">({{ count.toLocaleString() }}자<template v-if="confidence !== null"> · 인식 정확도 약 {{ confidence }}%</template>)</small></label>
          <textarea id="ocr-text" v-model="text" rows="12" class="textarea"></textarea>
        </div>
        <label class="check"><input v-model="joinLines" type="checkbox" @change="reformat" /> 문단 안의 줄바꿈 합치기</label>
        <button type="button" class="btn" @click="copy">{{ copied ? '복사됐어요' : '글자 복사하기' }}</button>
      </template>
    </div>
  </div>
  <p class="muted" style="margin: 12px 0 0">틀린 글자는 결과 칸에서 바로 고친 뒤 복사하세요. 손글씨나 흐린 사진은 잘 안 읽힐 수 있어요.</p>
</template>

<style scoped>
.ocr-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 14px; margin-top: 14px; align-items: start; }
.ocr-img { width: 100%; max-height: 420px; object-fit: contain; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
.check { display: inline-flex; gap: 6px; align-items: center; margin: 8px 0 4px; font-weight: 500; }
@media (max-width: 640px) { .ocr-grid { grid-template-columns: 1fr; } .ocr-img { max-height: 240px; } }
</style>
