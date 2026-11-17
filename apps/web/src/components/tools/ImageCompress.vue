<script setup lang="ts">
// 사진·이미지 용량 줄이기 UI. 목표 용량 탐색은 src/lib/compress.js, 인코딩은 브라우저 canvas.
// 여러 장을 같은 목표 용량으로 한 번에 줄인다. 파일은 서버로 보내지 않는다.
import { ref, computed, onBeforeUnmount } from 'vue';
import { searchTarget, formatBytes, toJpgName, TARGET_PRESETS } from '../../lib/compress.js';
import { filterFiles, uniqueNames } from '../../lib/files.js';
import { downloadBlob, downloadZip } from '../../lib/download.js';

const MAX_INPUT = 50 * 1024 * 1024;
const MAX_COUNT = 30;

type Out = { url: string; blob: Blob; size: number; w: number; h: number; fits: boolean; quality: number };
type Item = { file: File; w: number; h: number; status: 'wait' | 'busy' | 'done' | 'fail'; out?: Out };

const items = ref<Item[]>([]);
const rejected = ref<string[]>([]);
const targetKB = ref(500);
const busy = ref(false);
const over = ref(false);

const targetBytes = computed(() => Math.round(Number(targetKB.value) * 1024));
const outNames = computed(() => uniqueNames(items.value.map((i) => toJpgName(i.file.name, '_small'))));
const done = computed(() => items.value.filter((i) => i.out));
const single = computed(() => (items.value.length === 1 ? items.value[0] : null));
const totals = computed(() => ({
  before: done.value.reduce((s, i) => s + i.file.size, 0),
  after: done.value.reduce((s, i) => s + (i.out?.size ?? 0), 0),
}));

function clearOut(it: Item) {
  if (it.out) URL.revokeObjectURL(it.out.url);
  it.out = undefined;
}
function clearAll() {
  items.value.forEach(clearOut);
  items.value = [];
  rejected.value = [];
}

async function add(list: FileList | File[] | null | undefined) {
  if (!list) return;
  const r = filterFiles([...list], { exts: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'], maxSize: MAX_INPUT, maxCount: MAX_COUNT, already: items.value.length });
  rejected.value = r.rejected.map((x: { file: File; reason: string }) => `${x.file.name}: ${x.reason}`);
  if ([...list].some((f) => /\.hei[cf]$/i.test(f.name))) rejected.value.push('아이폰 HEIC 사진은 HEIC JPG 변환 도구로 먼저 바꿔 주세요.');
  for (const file of r.accepted as File[]) {
    try {
      const b = await createImageBitmap(file);
      items.value.push({ file, w: b.width, h: b.height, status: 'wait' });
      b.close();
    } catch {
      rejected.value.push(`${file.name}: 이미지를 열 수 없어요`);
    }
  }
}

function encoder(bitmap: ImageBitmap) {
  return (scale: number, quality: number): Promise<{ size: number; blob: Blob; w: number; h: number }> => {
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff'; // PNG 투명 배경은 흰색으로
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    return new Promise((resolve, reject) =>
      c.toBlob((blob) => (blob ? resolve({ size: blob.size, blob, w, h }) : reject(new Error('encode'))), 'image/jpeg', quality),
    );
  };
}

async function run() {
  if (!targetBytes.value) return;
  busy.value = true;
  for (const it of items.value) {
    clearOut(it);
    it.status = 'busy';
    let bmp: ImageBitmap | null = null;
    try {
      bmp = await createImageBitmap(it.file);
      const r = await searchTarget(encoder(bmp), targetBytes.value);
      const res = r.result as { blob: Blob; w: number; h: number };
      it.out = { url: URL.createObjectURL(res.blob), blob: res.blob, size: r.size, w: res.w, h: res.h, fits: r.fits, quality: r.quality };
      it.status = 'done';
    } catch {
      it.status = 'fail';
    } finally {
      bmp?.close();
    }
  }
  busy.value = false;
}

const saveOne = (i: number) => downloadBlob(items.value[i].out!.blob, outNames.value[i]);
const saveZip = () => downloadZip(items.value.map((it, i) => ({ it, name: outNames.value[i] })).filter((x) => x.it.out).map((x) => ({ name: x.name, blob: x.it.out!.blob })), 'photos_small.zip');
const pct = (a: number, b: number) => (b ? Math.round((1 - a / b) * 100) : 0);

onBeforeUnmount(clearAll);
</script>

<template>
  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; add($event.dataTransfer?.files)">
    <input type="file" accept="image/jpeg,image/png,image/webp" multiple @change="add(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>{{ single ? single.file.name : items.length ? `사진 ${items.length}장` : '사진을 끌어다 놓거나 눌러서 고르세요' }}</strong><br />
    <small class="muted" v-if="single">{{ formatBytes(single.file.size) }} · {{ single.w }}×{{ single.h }}</small>
    <small class="muted" v-else>JPG · PNG · WEBP, 여러 장 가능(최대 {{ MAX_COUNT }}장) · 서버로 올라가지 않아요</small>
  </label>
  <p v-for="r in rejected" :key="r" class="error" style="margin: 6px 0 0">{{ r }}</p>

  <div class="field" style="margin-top: 16px">
    <label for="target">목표 용량 (KB, 한 장당)</label>
    <input id="target" v-model.number="targetKB" type="number" min="10" step="10" />
    <div class="chips">
      <button v-for="p in TARGET_PRESETS" :key="p.label" type="button" class="chip" :class="{ on: targetBytes === p.bytes }" @click="targetKB = p.bytes / 1024">{{ p.label }} 이하</button>
    </div>
  </div>

  <button class="btn" type="button" :disabled="!items.length || busy" @click="run">
    {{ busy ? `줄이는 중… (${done.length}/${items.length})` : items.length > 1 ? `${items.length}장 용량 줄이기` : '용량 줄이기' }}
  </button>

  <!-- 한 장: 큰 미리보기 -->
  <div v-if="single?.out" class="result" aria-live="polite">
    <div class="sub">{{ formatBytes(single.file.size) }} → </div>
    <div class="big">{{ formatBytes(single.out.size) }}</div>
    <p class="sub" style="margin: 6px 0 12px">
      해상도 {{ single.w }}×{{ single.h }} → {{ single.out.w }}×{{ single.out.h }} · 품질 {{ Math.round(single.out.quality * 100) }}%
    </p>
    <p v-if="!single.out.fits" class="error">목표 용량까지 줄이지 못했어요. 가장 작게 만든 결과예요.</p>
    <img :src="single.out.url" alt="압축 결과 미리보기" style="max-width: 100%; border-radius: 8px; display: block" />
    <a class="btn" :href="single.out.url" :download="outNames[0]" style="text-align: center; text-decoration: none">JPG 다운로드</a>
  </div>

  <!-- 여러 장: 목록 + ZIP -->
  <template v-if="items.length > 1">
    <ul class="file-list">
      <li v-for="(it, i) in items" :key="i">
        <span class="name">{{ it.file.name }}</span>
        <small class="muted">{{ formatBytes(it.file.size) }}</small>
        <small v-if="it.status === 'busy'" class="muted">줄이는 중…</small>
        <small v-else-if="it.status === 'fail'" class="error" style="margin: 0">실패</small>
        <template v-else-if="it.out">
          <small :class="it.out.fits ? 'muted' : 'error'" :style="it.out.fits ? '' : 'margin:0'">→ {{ formatBytes(it.out.size) }}</small>
          <button type="button" class="btn-sub" @click="saveOne(i)">저장</button>
        </template>
      </li>
    </ul>
    <div v-if="done.length && !busy" class="result" aria-live="polite">
      <div class="sub">{{ done.length }}장 합계</div>
      <div class="big">{{ formatBytes(totals.before) }} → {{ formatBytes(totals.after) }}</div>
      <p class="sub" style="margin: 6px 0 0">{{ pct(totals.after, totals.before) }}% 줄었어요</p>
    </div>
    <div style="display: flex; gap: 8px; margin-top: 10px">
      <button v-if="done.length > 1" type="button" class="btn-sub" @click="saveZip">전체 ZIP 저장 ({{ done.length }}장)</button>
      <button type="button" class="btn-sub" :disabled="busy" @click="clearAll">목록 비우기</button>
    </div>
  </template>
  <button v-else-if="single && !busy" type="button" class="btn-sub" style="margin-top: 10px" @click="clearAll">다른 사진 고르기</button>
</template>
