<script setup lang="ts">
// 이미지 용량 줄이기 UI. 탐색 로직은 src/lib/compress.js, 인코딩은 브라우저 canvas.
// 파일은 서버로 보내지 않는다.
import { ref, computed, onBeforeUnmount } from 'vue';
import { searchTarget, formatBytes, toJpgName, TARGET_PRESETS } from '../../lib/compress.js';

const MAX_INPUT = 50 * 1024 * 1024;

const file = ref<File | null>(null);
const srcInfo = ref<{ w: number; h: number } | null>(null);
const targetKB = ref(500);
const busy = ref(false);
const error = ref('');
const over = ref(false);
const out = ref<{ url: string; size: number; w: number; h: number; fits: boolean; quality: number } | null>(null);
let bitmap: ImageBitmap | null = null;

const targetBytes = computed(() => Math.round(Number(targetKB.value) * 1024));

function reset() {
  if (out.value) URL.revokeObjectURL(out.value.url);
  out.value = null;
  error.value = '';
}

async function setFile(f: File | undefined) {
  reset();
  if (!f) return;
  if (!f.type.startsWith('image/')) { error.value = '이미지 파일(JPG, PNG, WEBP)만 올려 주세요. HEIC는 HEIC JPG 변환 도구를 먼저 써 주세요.'; return; }
  if (f.size > MAX_INPUT) { error.value = '50MB 이하 파일만 처리할 수 있어요.'; return; }
  try {
    bitmap?.close();
    bitmap = await createImageBitmap(f);
    file.value = f;
    srcInfo.value = { w: bitmap.width, h: bitmap.height };
  } catch {
    error.value = '이미지를 열 수 없어요. 다른 파일로 시도해 주세요.';
  }
}

function encode(scale: number, quality: number): Promise<{ size: number; blob: Blob; w: number; h: number }> {
  const b = bitmap!;
  const w = Math.max(1, Math.round(b.width * scale));
  const h = Math.max(1, Math.round(b.height * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff'; // PNG 투명 배경은 흰색으로
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(b, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    c.toBlob((blob) => (blob ? resolve({ size: blob.size, blob, w, h }) : reject(new Error('encode'))), 'image/jpeg', quality),
  );
}

async function run() {
  if (!bitmap || !targetBytes.value) return;
  reset();
  busy.value = true;
  try {
    const r = await searchTarget(encode, targetBytes.value);
    const res = r.result as { blob: Blob; w: number; h: number };
    out.value = { url: URL.createObjectURL(res.blob), size: r.size, w: res.w, h: res.h, fits: r.fits, quality: r.quality };
  } catch {
    error.value = '압축 중 문제가 생겼어요. 다른 이미지로 시도해 주세요.';
  } finally {
    busy.value = false;
  }
}

function onDrop(e: DragEvent) {
  over.value = false;
  setFile(e.dataTransfer?.files?.[0]);
}

onBeforeUnmount(() => { reset(); bitmap?.close(); });
</script>

<template>
  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="onDrop">
    <input type="file" accept="image/jpeg,image/png,image/webp" @change="setFile(($event.target as HTMLInputElement).files?.[0])" />
    <strong>{{ file ? file.name : '이미지를 끌어다 놓거나 눌러서 고르세요' }}</strong><br />
    <small class="muted" v-if="file && srcInfo">{{ formatBytes(file.size) }} · {{ srcInfo.w }}×{{ srcInfo.h }}</small>
    <small class="muted" v-else>JPG · PNG · WEBP, 서버로 올라가지 않아요</small>
  </label>

  <div class="field" style="margin-top: 16px">
    <label for="target">목표 용량 (KB)</label>
    <input id="target" v-model.number="targetKB" type="number" min="10" step="10" />
    <div class="chips">
      <button v-for="p in TARGET_PRESETS" :key="p.label" type="button" class="chip" :class="{ on: targetBytes === p.bytes }" @click="targetKB = p.bytes / 1024">{{ p.label }} 이하</button>
    </div>
  </div>

  <button class="btn" type="button" :disabled="!file || busy" @click="run">{{ busy ? '압축하는 중…' : '용량 줄이기' }}</button>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <div v-if="out && file && srcInfo" class="result" aria-live="polite">
    <div class="sub">{{ formatBytes(file.size) }} → </div>
    <div class="big">{{ formatBytes(out.size) }}</div>
    <p class="sub" style="margin: 6px 0 12px">
      해상도 {{ srcInfo.w }}×{{ srcInfo.h }} → {{ out.w }}×{{ out.h }} · 품질 {{ Math.round(out.quality * 100) }}%
    </p>
    <p v-if="!out.fits" class="error">목표 용량까지 줄이지 못했어요. 가장 작게 만든 결과예요.</p>
    <img :src="out.url" alt="압축 결과 미리보기" style="max-width: 100%; border-radius: 8px; display: block" />
    <a class="btn" :href="out.url" :download="toJpgName(file.name, '_small')" style="text-align: center; text-decoration: none">JPG 다운로드</a>
  </div>
</template>
