<script setup lang="ts">
// 사진 합치기 UI. 배치 계산은 src/lib/imageMerge.js, 그리기는 canvas. 사진은 서버로 보내지 않는다.
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { filterFiles } from '../../lib/files.js';
import { mergeLayout } from '../../lib/imageMerge.js';
import { formatBytes } from '../../lib/compress.js';
import { downloadBlob } from '../../lib/download.js';

type Item = { file: File; url: string; bmp: ImageBitmap };
const items = ref<Item[]>([]);
const rejected = ref<string[]>([]);
const dir = ref<'vertical' | 'horizontal'>('vertical');
const fit = ref<'match' | 'original'>('match');
const gap = ref(0);
const bg = ref('#ffffff');
const format = ref<'jpeg' | 'png'>('jpeg');
const over = ref(false);
const preview = ref<HTMLCanvasElement | null>(null);
const saving = ref(false);
let dragIndex = -1;

const layout = computed(() => mergeLayout(items.value.map((i) => ({ w: i.bmp.width, h: i.bmp.height })), { dir: dir.value, gap: gap.value, fit: fit.value }));

async function add(list: FileList | null | undefined) {
  if (!list) return;
  const r = filterFiles([...list], { exts: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'], maxSize: 50 * 1024 * 1024, maxCount: 30, already: items.value.length });
  rejected.value = r.rejected.map((x: { file: File; reason: string }) => `${x.file.name}: ${x.reason}`);
  for (const file of r.accepted as File[]) {
    try { items.value.push({ file, url: URL.createObjectURL(file), bmp: await createImageBitmap(file) }); }
    catch { rejected.value.push(`${file.name}: 이미지를 열지 못했어요`); }
  }
}
function remove(i: number) {
  const [x] = items.value.splice(i, 1);
  URL.revokeObjectURL(x.url); x.bmp.close();
}
function move(i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= items.value.length) return;
  const a = items.value; [a[i], a[j]] = [a[j], a[i]];
}
function onDragOverItem(i: number) {
  if (dragIndex < 0 || dragIndex === i) return;
  const [x] = items.value.splice(dragIndex, 1); items.value.splice(i, 0, x); dragIndex = i;
}

function draw(c: HTMLCanvasElement, k: number) {
  const L = layout.value;
  c.width = Math.max(1, Math.round(L.W * k)); c.height = Math.max(1, Math.round(L.H * k));
  const ctx = c.getContext('2d')!;
  if (format.value === 'jpeg' || bg.value) { ctx.fillStyle = bg.value; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.imageSmoothingQuality = 'high';
  items.value.forEach((it, i) => { const r = L.rects[i]; ctx.drawImage(it.bmp, r.x * k, r.y * k, r.w * k, r.h * k); });
}
function redraw() {
  const c = preview.value, L = layout.value;
  if (!c || !L.W) return;
  draw(c, Math.min(1, 600 / Math.max(L.W, L.H)));
}
watch([layout, bg, format, items], () => nextTick(redraw), { deep: true });

async function save() {
  saving.value = true;
  const c = document.createElement('canvas');
  draw(c, 1);
  const blob: Blob | null = await new Promise((res) => c.toBlob(res, `image/${format.value}`, 0.92));
  saving.value = false;
  if (blob) downloadBlob(blob, `합친사진.${format.value === 'png' ? 'png' : 'jpg'}`);
}
onBeforeUnmount(() => items.value.forEach((i) => { URL.revokeObjectURL(i.url); i.bmp.close(); }));
</script>

<template>
  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; add($event.dataTransfer?.files)">
    <input type="file" accept="image/*" multiple @change="add(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>합칠 사진들을 끌어다 놓거나 눌러서 고르세요</strong><br />
    <small class="muted">2장 이상, 최대 30장 · 서버로 올라가지 않아요</small>
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

  <div class="row" style="margin-top: 16px">
    <div class="field">
      <label>방향</label>
      <div class="chips">
        <button type="button" class="chip" :class="{ on: dir === 'vertical' }" @click="dir = 'vertical'">세로로 (위→아래)</button>
        <button type="button" class="chip" :class="{ on: dir === 'horizontal' }" @click="dir = 'horizontal'">가로로 (왼→오)</button>
      </div>
    </div>
    <div class="field">
      <label>크기</label>
      <div class="chips">
        <button type="button" class="chip" :class="{ on: fit === 'match' }" @click="fit = 'match'">{{ dir === 'vertical' ? '너비' : '높이' }} 맞추기</button>
        <button type="button" class="chip" :class="{ on: fit === 'original' }" @click="fit = 'original'">원본 크기</button>
      </div>
    </div>
  </div>
  <div class="row" style="margin-top: 12px">
    <div class="field"><label for="gap">간격: {{ gap }}px</label><input id="gap" v-model.number="gap" type="range" min="0" max="80" step="2" style="width: 100%" /></div>
    <div class="field"><label for="bg">배경색</label><input id="bg" v-model="bg" type="color" style="width: 100%; height: 44px" /></div>
  </div>
  <div class="field" style="margin-top: 12px">
    <label>저장 형식</label>
    <div class="chips">
      <button type="button" class="chip" :class="{ on: format === 'jpeg' }" @click="format = 'jpeg'">JPG (용량 작음)</button>
      <button type="button" class="chip" :class="{ on: format === 'png' }" @click="format = 'png'">PNG (글자 선명)</button>
    </div>
  </div>

  <template v-if="items.length >= 2">
    <div class="result" style="text-align: center">
      <canvas ref="preview" style="max-width: 100%; max-height: 480px; border-radius: 6px; box-shadow: 0 0 0 1px var(--line)" aria-label="합친 사진 미리보기"></canvas>
      <p class="sub" style="margin: 8px 0 0">결과 크기 {{ layout.W }}×{{ layout.H }}px<template v-if="layout.scaled"> (너무 커서 줄였어요)</template></p>
    </div>
    <button class="btn" type="button" :disabled="saving" @click="save">{{ saving ? '만드는 중…' : '합친 사진 저장' }}</button>
  </template>
  <p v-else-if="items.length === 1" class="muted" style="margin: 12px 0 0">사진을 한 장 더 넣어 주세요.</p>
</template>
