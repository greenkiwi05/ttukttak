<script setup lang="ts">
// 이미지 변환·크기 조절 UI. 크기 계산은 src/lib/resize.js, 그리기는 canvas. 파일은 서버로 보내지 않는다.
import { ref, computed, onBeforeUnmount } from 'vue';
import { filterFiles, uniqueNames } from '../../lib/files.js';
import { targetSize, renameExt, FORMATS } from '../../lib/resize.js';
import { formatBytes } from '../../lib/compress.js';
import { downloadBlob, downloadZip } from '../../lib/download.js';

type Fmt = keyof typeof FORMATS;
type Mode = 'percent' | 'width' | 'height' | 'box' | 'exact';
type Item = { file: File; w: number; h: number; out?: { blob: Blob; w: number; h: number }; error?: string };

const items = ref<Item[]>([]);
const rejected = ref<string[]>([]);
const format = ref<Fmt>('jpeg');
const quality = ref(0.9);
const mode = ref<Mode>('percent');
const percent = ref<number | ''>(50);
const width = ref<number | ''>(1080);
const height = ref<number | ''>(1080);
const noUpscale = ref(true);
const busy = ref(false);
const over = ref(false);

const MODES: [Mode, string][] = [['percent', '비율(%)'], ['width', '가로 고정'], ['height', '세로 고정'], ['box', '상자 안에 맞춤'], ['exact', '정확한 크기']];
const opts = computed(() => ({ mode: mode.value, percent: Number(percent.value), width: Number(width.value), height: Number(height.value), noUpscale: noUpscale.value }));
const preview = computed(() => (items.value[0] ? targetSize(items.value[0].w, items.value[0].h, opts.value) : null));
const outNames = computed(() => uniqueNames(items.value.map((i) => renameExt(i.file.name, FORMATS[format.value].ext))));
const done = computed(() => items.value.filter((i) => i.out));

async function add(list: FileList | null | undefined) {
  if (!list) return;
  const r = filterFiles([...list], { exts: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'], maxSize: 50 * 1024 * 1024, maxCount: 50, already: items.value.length });
  rejected.value = r.rejected.map((x: { file: File; reason: string }) => `${x.file.name}: ${x.reason}`);
  for (const file of r.accepted as File[]) {
    try {
      const b = await createImageBitmap(file);
      items.value.push({ file, w: b.width, h: b.height });
      b.close();
    } catch {
      rejected.value.push(`${file.name}: 이미지를 열지 못했어요`);
    }
  }
}

async function convertAll() {
  busy.value = true;
  const F = FORMATS[format.value];
  for (const it of items.value) {
    it.out = undefined; it.error = undefined;
    const size = targetSize(it.w, it.h, opts.value);
    if ('error' in size) { it.error = size.error; continue; }
    try {
      const bmp = await createImageBitmap(it.file);
      const c = document.createElement('canvas');
      c.width = size.w; c.height = size.h;
      const ctx = c.getContext('2d')!;
      if (format.value === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size.w, size.h); }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, size.w, size.h);
      bmp.close();
      const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error())), F.mime, F.lossy ? quality.value : undefined));
      if (blob.type !== F.mime) throw new Error(`이 브라우저는 ${F.label} 저장을 지원하지 않아요`);
      it.out = { blob, w: size.w, h: size.h };
    } catch (e) {
      it.error = (e as Error).message || '변환하지 못했어요';
    }
  }
  busy.value = false;
}

const saveOne = (i: number) => downloadBlob(items.value[i].out!.blob, outNames.value[i]);
const saveZip = () => downloadZip(items.value.map((it, i) => ({ it, name: outNames.value[i] })).filter((x) => x.it.out).map((x) => ({ name: x.name, blob: x.it.out!.blob })), 'images.zip');
onBeforeUnmount(() => (items.value = []));
</script>

<template>
  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; add($event.dataTransfer?.files)">
    <input type="file" accept="image/*" multiple @change="add(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>이미지를 끌어다 놓거나 눌러서 고르세요</strong><br />
    <small class="muted">JPG · PNG · WEBP 등, 여러 장 가능 · 서버로 올라가지 않아요</small>
  </label>
  <p v-for="r in rejected" :key="r" class="error" style="margin: 6px 0 0">{{ r }}</p>

  <div class="field" style="margin-top: 16px">
    <label>저장 형식</label>
    <div class="chips"><button v-for="(F, k) in FORMATS" :key="k" type="button" class="chip" :class="{ on: format === k }" @click="format = k">{{ F.label }}</button></div>
  </div>
  <div v-if="FORMATS[format].lossy" class="field" style="margin-top: 12px">
    <label for="q">품질: {{ Math.round(quality * 100) }}%</label>
    <input id="q" v-model.number="quality" type="range" min="0.4" max="1" step="0.05" style="width: 100%" />
  </div>
  <div class="field" style="margin-top: 14px">
    <label>크기</label>
    <div class="chips"><button v-for="[k, l] in MODES" :key="k" type="button" class="chip" :class="{ on: mode === k }" @click="mode = k">{{ l }}</button></div>
  </div>
  <div class="row" style="margin-top: 12px">
    <div v-if="mode === 'percent'" class="field"><label for="pc">비율 (%)</label><input id="pc" v-model.number="percent" type="number" min="1" max="1000" /></div>
    <div v-if="mode !== 'percent' && mode !== 'height'" class="field"><label for="w">가로 (px)</label><input id="w" v-model.number="width" type="number" min="1" /></div>
    <div v-if="mode !== 'percent' && mode !== 'width'" class="field"><label for="h">세로 (px)</label><input id="h" v-model.number="height" type="number" min="1" /></div>
  </div>
  <label v-if="mode !== 'exact'" class="check"><input v-model="noUpscale" type="checkbox" /> 원본보다 크게 늘리지 않기</label>
  <p v-if="preview && items[0]" class="muted" style="margin: 8px 0 0">
    <template v-if="'error' in preview">{{ preview.error }}</template>
    <template v-else>예: {{ items[0].w }}×{{ items[0].h }} → <b>{{ preview.w }}×{{ preview.h }}</b></template>
  </p>

  <template v-if="items.length">
    <ul class="file-list">
      <li v-for="(it, i) in items" :key="i">
        <span class="name">{{ it.file.name }}</span>
        <small class="muted">{{ it.w }}×{{ it.h }}</small>
        <small v-if="it.error" class="error" style="margin: 0">{{ it.error }}</small>
        <template v-else-if="it.out">
          <small class="muted">→ {{ it.out.w }}×{{ it.out.h }} · {{ formatBytes(it.out.blob.size) }}</small>
          <button type="button" class="btn-sub" @click="saveOne(i)">저장</button>
        </template>
      </li>
    </ul>
    <button class="btn" type="button" :disabled="busy" @click="convertAll">{{ busy ? '변환 중…' : `${items.length}장 변환하기` }}</button>
    <div style="display: flex; gap: 8px; margin-top: 10px">
      <button v-if="done.length > 1" type="button" class="btn-sub" @click="saveZip">전체 ZIP 저장 ({{ done.length }}장)</button>
      <button type="button" class="btn-sub" :disabled="busy" @click="items = []; rejected = []">목록 비우기</button>
    </div>
  </template>
</template>
