<script setup lang="ts">
// JPG → PDF UI. 배치 계산은 src/lib/pdfLayout.js, PDF 생성은 pdf-lib(동적 import). 파일은 서버로 보내지 않는다.
// 사진 회전 정보를 반영하려고 createImageBitmap → canvas → JPEG로 한 번 그려서 넣는다.
import { ref, onBeforeUnmount } from 'vue';
import { filterFiles } from '../../lib/files.js';
import { pageLayout, PAGE_SIZES } from '../../lib/pdfLayout.js';
import { downloadBlob } from '../../lib/download.js';

type Item = { file: File; url: string };
const items = ref<Item[]>([]);
const rejected = ref<string[]>([]);
const page = ref<'a4' | 'letter' | 'fit'>('a4');
const orientation = ref<'auto' | 'portrait' | 'landscape'>('auto');
const margin = ref(10);
const busy = ref(false);
const progress = ref(0);
const error = ref('');
const over = ref(false);
let dragIndex = -1;

function add(list: FileList | null | undefined) {
  if (!list) return;
  const r = filterFiles([...list], { exts: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'], maxSize: 50 * 1024 * 1024, maxCount: 100, already: items.value.length });
  items.value.push(...r.accepted.map((file: File) => ({ file, url: URL.createObjectURL(file) })));
  rejected.value = r.rejected.map((x: { file: File; reason: string }) => `${x.file.name}: ${x.reason}`);
}
function remove(i: number) {
  URL.revokeObjectURL(items.value[i].url);
  items.value.splice(i, 1);
}
function move(i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= items.value.length) return;
  const a = items.value;
  [a[i], a[j]] = [a[j], a[i]];
}
function onDragOverItem(i: number) {
  if (dragIndex < 0 || dragIndex === i) return;
  const [x] = items.value.splice(dragIndex, 1);
  items.value.splice(i, 0, x);
  dragIndex = i;
}

async function toJpeg(file: File) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error())), 'image/jpeg', 0.92));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height };
}

async function make() {
  error.value = '';
  busy.value = true;
  progress.value = 0;
  try {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    for (const [i, it] of items.value.entries()) {
      let img;
      try { img = await toJpeg(it.file); } catch { throw new Error(`${it.file.name}: 이미지를 열지 못했어요.`); }
      const L = pageLayout(img.w, img.h, { page: page.value, orientation: orientation.value, marginMm: margin.value });
      const p = doc.addPage([L.pageW, L.pageH]);
      p.drawImage(await doc.embedJpg(img.bytes), { x: L.x, y: L.y, width: L.w, height: L.h });
      progress.value = (i + 1) / items.value.length;
    }
    downloadBlob(new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' }), '사진.pdf');
  } catch (e) {
    error.value = (e as Error).message || 'PDF를 만들지 못했어요.';
  } finally {
    busy.value = false;
  }
}
onBeforeUnmount(() => items.value.forEach((i) => URL.revokeObjectURL(i.url)));
</script>

<template>
  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; add($event.dataTransfer?.files)">
    <input type="file" accept="image/*" multiple @change="add(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>사진을 끌어다 놓거나 눌러서 고르세요</strong><br />
    <small class="muted">JPG · PNG · WEBP, 여러 장 가능 · 서버로 올라가지 않아요</small>
  </label>
  <p v-for="r in rejected" :key="r" class="error" style="margin: 6px 0 0">{{ r }}</p>

  <div v-if="items.length" class="thumbs">
    <div v-for="(it, i) in items" :key="it.url" class="thumb" draggable="true" @dragstart="dragIndex = i" @dragover.prevent="onDragOverItem(i)" @dragend="dragIndex = -1">
      <img :src="it.url" :alt="it.file.name" />
      <span class="no">{{ i + 1 }}</span>
      <div class="thumb-btns">
        <button type="button" aria-label="앞으로" :disabled="i === 0" @click="move(i, -1)">‹</button>
        <button type="button" aria-label="빼기" @click="remove(i)">✕</button>
        <button type="button" aria-label="뒤로" :disabled="i === items.length - 1" @click="move(i, 1)">›</button>
      </div>
    </div>
  </div>

  <div class="field" style="margin-top: 16px">
    <label>용지</label>
    <div class="chips">
      <button v-for="(s, k) in PAGE_SIZES" :key="k" type="button" class="chip" :class="{ on: page === k }" @click="page = k">{{ s.label }}</button>
      <button type="button" class="chip" :class="{ on: page === 'fit' }" @click="page = 'fit'">사진 크기 그대로</button>
    </div>
  </div>
  <div v-if="page !== 'fit'" class="row" style="margin-top: 14px">
    <div class="field">
      <label>방향</label>
      <div class="chips">
        <button v-for="o in [['auto', '자동'], ['portrait', '세로'], ['landscape', '가로']]" :key="o[0]" type="button" class="chip" :class="{ on: orientation === o[0] }" @click="orientation = o[0] as any">{{ o[1] }}</button>
      </div>
    </div>
    <div class="field">
      <label for="mg">여백: {{ margin }}mm</label>
      <input id="mg" v-model.number="margin" type="range" min="0" max="30" step="1" style="width: 100%" />
    </div>
  </div>

  <div v-if="busy" class="progress"><div :style="{ width: progress * 100 + '%' }"></div></div>
  <button class="btn" type="button" :disabled="!items.length || busy" @click="make">
    {{ busy ? 'PDF 만드는 중…' : items.length ? `사진 ${items.length}장으로 PDF 만들기` : '사진을 넣어 주세요' }}
  </button>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
</template>
