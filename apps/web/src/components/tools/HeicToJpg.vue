<script setup lang="ts">
// HEIC → JPG 변환 UI. heic2any는 이 페이지에서만 동적 import 한다 (홈 JS에 포함되지 않음).
// 파일은 서버로 보내지 않는다.
import { ref, computed, onBeforeUnmount } from 'vue';
import { filterFiles, uniqueNames } from '../../lib/files.js';
import { toJpgName } from '../../lib/compress.js';
import { downloadBlob, downloadZip } from '../../lib/download.js';

const MAX_SIZE = 50 * 1024 * 1024;
const MAX_COUNT = 30;

type Item = { file: File; status: 'wait' | 'busy' | 'done' | 'fail'; url?: string; blob?: Blob; reason?: string };
const items = ref<Item[]>([]);
const rejected = ref<string[]>([]);
const quality = ref(0.9);
const busy = ref(false);
const over = ref(false);

const doneCount = computed(() => items.value.filter((i) => i.status === 'done' || i.status === 'fail').length);
const done = computed(() => items.value.filter((i) => i.status === 'done'));
const outNames = computed(() => uniqueNames(items.value.map((i) => toJpgName(i.file.name))));

function add(list: FileList | File[] | undefined | null) {
  if (!list) return;
  const r = filterFiles([...list], { exts: ['heic', 'heif'], maxSize: MAX_SIZE, maxCount: MAX_COUNT, already: items.value.length });
  items.value.push(...r.accepted.map((file: File) => ({ file, status: 'wait' as const })));
  rejected.value = r.rejected.map((x: { file: File; reason: string }) => `${x.file.name}: ${x.reason}`);
}

async function convert() {
  busy.value = true;
  const { default: heic2any } = await import('heic2any');
  for (const it of items.value) {
    if (it.status === 'done') continue;
    it.status = 'busy';
    try {
      const out = await heic2any({ blob: it.file, toType: 'image/jpeg', quality: quality.value });
      const blob = Array.isArray(out) ? out[0] : out;
      it.blob = blob;
      it.url = URL.createObjectURL(blob);
      it.status = 'done';
    } catch {
      it.status = 'fail';
      it.reason = 'HEIC 형식을 읽지 못했어요 (손상되었거나 지원하지 않는 형식)';
    }
  }
  busy.value = false;
}

function clear() {
  items.value.forEach((i) => i.url && URL.revokeObjectURL(i.url));
  items.value = [];
  rejected.value = [];
}

function zipAll() {
  const entries = items.value.map((it, i) => ({ it, name: outNames.value[i] })).filter((x) => x.it.blob).map((x) => ({ name: x.name, blob: x.it.blob! }));
  downloadZip(entries, 'heic_to_jpg.zip');
}

function onDrop(e: DragEvent) {
  over.value = false;
  add(e.dataTransfer?.files);
}
onBeforeUnmount(clear);
</script>

<template>
  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="onDrop">
    <input type="file" accept=".heic,.heif,image/heic,image/heif" multiple @change="add(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>HEIC 사진을 끌어다 놓거나 눌러서 고르세요</strong><br />
    <small class="muted">여러 장 가능 (최대 {{ MAX_COUNT }}장, 장당 50MB) · 서버로 올라가지 않아요</small>
  </label>
  <p v-for="r in rejected" :key="r" class="error" style="margin: 6px 0 0">{{ r }}</p>

  <div class="field" style="margin-top: 16px">
    <label for="q">JPG 품질: {{ Math.round(quality * 100) }}%</label>
    <input id="q" v-model.number="quality" type="range" min="0.5" max="1" step="0.05" style="width: 100%" />
  </div>

  <template v-if="items.length">
    <ul class="file-list">
      <li v-for="(it, i) in items" :key="i">
        <span class="name">{{ it.file.name }}</span>
        <small v-if="it.status === 'wait'" class="muted">대기</small>
        <small v-else-if="it.status === 'busy'" class="muted">변환 중…</small>
        <small v-else-if="it.status === 'fail'" class="error" style="margin: 0">{{ it.reason }}</small>
        <button v-else type="button" class="btn-sub" @click="downloadBlob(it.blob!, outNames[i])">JPG 저장</button>
      </li>
    </ul>
    <div v-if="busy" class="progress" aria-label="진행률"><div :style="{ width: (doneCount / items.length) * 100 + '%' }"></div></div>
    <button class="btn" type="button" :disabled="busy || done.length === items.length" @click="convert">
      {{ busy ? `변환 중… (${doneCount}/${items.length})` : `JPG로 변환 (${items.length}장)` }}
    </button>
    <div style="display: flex; gap: 8px; margin-top: 10px">
      <button v-if="done.length > 1" type="button" class="btn-sub" @click="zipAll">전체 ZIP 다운로드 ({{ done.length }}장)</button>
      <button type="button" class="btn-sub" :disabled="busy" @click="clear">목록 비우기</button>
    </div>
  </template>
</template>
