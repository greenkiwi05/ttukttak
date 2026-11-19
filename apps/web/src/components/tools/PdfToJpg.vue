<script setup lang="ts">
// PDF → JPG UI. pdf.js(pdfjs-dist)를 이 페이지에서만 동적 import 한다. 파일은 서버로 보내지 않는다.
import { ref, shallowRef, onBeforeUnmount } from 'vue';
import { filterFiles } from '../../lib/files.js';
import { parsePageRanges } from '../../lib/pageRange.js';
import { renderScale, pageImageName, DPI_PRESETS } from '../../lib/pdfToImage.js';
import { downloadBlob, downloadZip } from '../../lib/download.js';
import { loadPdfjs, openPdf, pdfOpenError } from '../../lib/pdfjs.js';

const file = ref<File | null>(null);
const pageCount = ref(0);
const dpi = ref(150);
const format = ref<'jpeg' | 'png'>('jpeg');
const range = ref('');
const busy = ref(false);
const progress = ref(0);
const error = ref('');
const notice = ref('');
const over = ref(false);
const outputs = ref<{ name: string; blob: Blob; url: string }[]>([]);
const doc = shallowRef<any>(null);
let task: any = null; // pdf.js 6: 정리는 loadingTask.destroy()

const lib = loadPdfjs as () => Promise<any>;
function clearOut() {
  outputs.value.forEach((o) => URL.revokeObjectURL(o.url));
  outputs.value = [];
}

async function setFile(list: FileList | null | undefined) {
  error.value = ''; notice.value = '';
  const f = list?.[0];
  if (!f) return;
  const r = filterFiles([f], { exts: ['pdf'], maxSize: 100 * 1024 * 1024, maxCount: 1 });
  if (!r.accepted.length) { error.value = r.rejected[0].reason; return; }
  clearOut();
  busy.value = true;
  try {
    const pdfjs = await lib();
    await task?.destroy();
    task = openPdf(pdfjs, new Uint8Array(await f.arrayBuffer()));
    doc.value = await task.promise;
    file.value = f;
    pageCount.value = doc.value.numPages;
    range.value = pageCount.value > 1 ? `1-${pageCount.value}` : '1';
  } catch (e) {
    error.value = pdfOpenError(e);
  } finally {
    busy.value = false;
  }
}

async function convert() {
  if (!doc.value || !file.value) return;
  error.value = ''; notice.value = '';
  const r = parsePageRanges(range.value, pageCount.value);
  if ('error' in r) { error.value = r.error; return; }
  clearOut();
  busy.value = true;
  progress.value = 0;
  const ext = format.value === 'png' ? 'png' : 'jpg';
  try {
    for (const [i, p] of r.pages.entries()) {
      const page = await doc.value.getPage(p);
      const base = page.getViewport({ scale: 1 });
      const s = renderScale(base.width, base.height, dpi.value);
      if (s.reduced) notice.value = '페이지가 커서 일부는 해상도를 낮춰 변환했어요.';
      const vp = page.getViewport({ scale: s.scale });
      const c = document.createElement('canvas');
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
      const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error())), `image/${format.value}`, 0.92));
      outputs.value.push({ name: pageImageName(file.value.name, p, pageCount.value, ext), blob, url: URL.createObjectURL(blob) });
      page.cleanup();
      progress.value = (i + 1) / r.pages.length;
    }
  } catch {
    error.value = '변환 중 문제가 생겼어요. 페이지 수를 줄이거나 해상도를 낮춰 보세요.';
  } finally {
    busy.value = false;
  }
}
const saveZip = () => downloadZip(outputs.value, (file.value?.name ?? 'pdf').replace(/\.pdf$/i, '') + '_images.zip');
onBeforeUnmount(() => { clearOut(); task?.destroy(); });
</script>

<template>
  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; setFile($event.dataTransfer?.files)">
    <input type="file" accept="application/pdf,.pdf" @change="setFile(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>{{ file ? file.name : 'PDF 파일을 끌어다 놓거나 눌러서 고르세요' }}</strong><br />
    <small class="muted">{{ file ? `전체 ${pageCount}쪽` : '서버로 올라가지 않아요' }}</small>
  </label>

  <template v-if="file">
    <div class="field" style="margin-top: 16px">
      <label>해상도</label>
      <div class="chips"><button v-for="d in DPI_PRESETS" :key="d.dpi" type="button" class="chip" :class="{ on: dpi === d.dpi }" @click="dpi = d.dpi">{{ d.label }}</button></div>
    </div>
    <div class="row" style="margin-top: 14px">
      <div class="field">
        <label>형식</label>
        <div class="chips">
          <button type="button" class="chip" :class="{ on: format === 'jpeg' }" @click="format = 'jpeg'">JPG</button>
          <button type="button" class="chip" :class="{ on: format === 'png' }" @click="format = 'png'">PNG</button>
        </div>
      </div>
      <div class="field"><label for="rg">페이지</label><input id="rg" v-model="range" type="text" placeholder="예: 1-3, 5" /></div>
    </div>
    <div v-if="busy" class="progress"><div :style="{ width: progress * 100 + '%' }"></div></div>
    <button class="btn" type="button" :disabled="busy" @click="convert">{{ busy ? '변환 중…' : '이미지로 변환' }}</button>
  </template>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <p v-if="notice" class="notice">{{ notice }}</p>

  <template v-if="outputs.length">
    <div class="thumbs">
      <button v-for="o in outputs" :key="o.name" type="button" class="thumb" style="padding: 0" :title="`${o.name} 저장`" @click="downloadBlob(o.blob, o.name)">
        <img :src="o.url" :alt="o.name" style="object-fit: contain; background: #fff" />
        <span class="no">{{ o.name.match(/_(\d+)\./)?.[1] }}쪽</span>
      </button>
    </div>
    <p class="muted" style="margin: 8px 0 0">미리보기를 누르면 한 장씩 저장돼요.</p>
    <button v-if="outputs.length > 1" type="button" class="btn" @click="saveZip">전체 ZIP 저장 ({{ outputs.length }}장)</button>
  </template>
</template>
