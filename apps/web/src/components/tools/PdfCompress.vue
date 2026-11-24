<script setup lang="ts">
// PDF 용량 줄이기 UI. 쪽마다 pdf.js로 그려 JPEG로 다시 담고 pdf-lib로 묶는다 (설정은 src/lib/pdfCompress.js).
// 파일은 서버로 보내지 않는다. 결과가 원본보다 크면 저장을 권하지 않고 안내한다.
import { ref, onBeforeUnmount } from 'vue';
import { filterFiles } from '../../lib/files.js';
import { COMPRESS_PRESETS, compareSize, compressedName, pagePixels } from '../../lib/pdfCompress.js';
import { renderScale } from '../../lib/pdfToImage.js';
import { formatBytes } from '../../lib/compress.js';
import { loadPdfjs, openPdf, pdfOpenError, passwordState } from '../../lib/pdfjs.js';
import PdfPassword from '../PdfPassword.vue';

const file = ref<File | null>(null);
const pages = ref(0);
const preset = ref('medium');
const busy = ref(false);
const progress = ref(0);
const error = ref('');
const over = ref(false);
const out = ref<{ url: string; blob: Blob } | null>(null);
let cancelled = false;
const ask = ref<{ file: File; wrong: boolean } | null>(null); // 비밀번호를 물어볼 파일
const opening = ref(false);
let password: string | undefined; // 연 파일의 비밀번호 (화면을 닫으면 사라짐)
let openRun = 0;

function clearOut() {
  if (out.value) URL.revokeObjectURL(out.value.url);
  out.value = null;
}

async function setFile(list: FileList | null | undefined) {
  error.value = '';
  const f = list?.[0];
  if (!f) return;
  const r = filterFiles([f], { exts: ['pdf'], maxSize: 200 * 1024 * 1024, maxCount: 1 });
  if (!r.accepted.length) { error.value = r.rejected[0].reason; return; }
  clearOut();
  ask.value = null;
  file.value = null;
  await openFile(f);
}

async function openFile(f: File, pw?: string) {
  const my = ++openRun;
  error.value = '';
  opening.value = true;
  let task: any = null;
  try {
    const pdfjs: any = await loadPdfjs();
    // pdf.js 6: 정리는 문서가 아니라 loadingTask.destroy()로 한다
    task = openPdf(pdfjs, new Uint8Array(await f.arrayBuffer()), pw);
    const doc = await task.promise;
    if (my !== openRun) return;
    pages.value = doc.numPages;
    password = pw;
    ask.value = null;
    file.value = f;
  } catch (e) {
    if (my !== openRun) return;
    const st = passwordState(e);
    if (st) ask.value = { file: f, wrong: st === 'wrong' };
    else { ask.value = null; error.value = pdfOpenError(e); }
  } finally {
    await task?.destroy();
    if (my === openRun) opening.value = false;
  }
}

async function run() {
  if (!file.value) return;
  error.value = '';
  clearOut();
  busy.value = true;
  cancelled = false;
  progress.value = 0;
  const p = COMPRESS_PRESETS.find((x) => x.id === preset.value)!;
  try {
    const [pdfjs, { PDFDocument }] = await Promise.all([loadPdfjs() as Promise<any>, import('pdf-lib')]);
    const task = openPdf(pdfjs, new Uint8Array(await file.value.arrayBuffer()), password);
    const src = await task.promise;
    const outDoc = await PDFDocument.create();
    for (let i = 1; i <= src.numPages; i++) {
      if (cancelled) throw new Error('cancel');
      const page = await src.getPage(i);
      const base = page.getViewport({ scale: 1 }); // 단위: pt
      const want = pagePixels(base.width, base.height, p.dpi);
      const s = renderScale(base.width, base.height, p.dpi); // 브라우저 한계 안으로
      const vp = page.getViewport({ scale: Math.min(s.scale, want.w / base.width) });
      const c = document.createElement('canvas');
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
      const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error())), 'image/jpeg', p.quality));
      const img = await outDoc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      outDoc.addPage([base.width, base.height]).drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      page.cleanup();
      progress.value = i / src.numPages;
    }
    await task.destroy();
    const blob = new Blob([(await outDoc.save()) as BlobPart], { type: 'application/pdf' });
    out.value = { url: URL.createObjectURL(blob), blob };
  } catch (e) {
    if (!cancelled) error.value = 'PDF를 줄이는 중 문제가 생겼어요. 다른 단계로 시도해 보세요.';
  } finally {
    busy.value = false;
  }
}

onBeforeUnmount(() => { cancelled = true; clearOut(); });
</script>

<template>
  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; setFile($event.dataTransfer?.files)">
    <input type="file" accept="application/pdf,.pdf" @change="setFile(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong role="status">{{ opening && !ask ? 'PDF 여는 중…' : file ? file.name : 'PDF 파일을 끌어다 놓거나 눌러서 고르세요' }}</strong><br />
    <small class="muted">{{ opening && !ask ? '처음에는 프로그램을 내려받느라 몇 초 걸릴 수 있어요' : file ? `${formatBytes(file.size)} · ${pages}쪽` : '최대 200MB · 서버로 올라가지 않아요' }}</small>
  </label>
  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <PdfPassword v-if="ask" :name="ask.file.name" :wrong="ask.wrong" :busy="opening" @submit="(p) => openFile(ask!.file, p)" @cancel="ask = null" />

  <template v-if="file">
    <div class="field" style="margin-top: 16px">
      <label>얼마나 줄일까요?</label>
      <div class="chips">
        <button v-for="p in COMPRESS_PRESETS" :key="p.id" type="button" class="chip" :class="{ on: preset === p.id }" @click="preset = p.id">{{ p.label }}</button>
      </div>
    </div>
    <template v-if="busy">
      <div class="progress"><div :style="{ width: progress * 100 + '%' }"></div></div>
      <p class="muted" style="margin: 6px 0 0">줄이는 중… {{ Math.round(progress * pages) }}/{{ pages }}쪽</p>
      <button type="button" class="btn-sub" style="margin-top: 10px" @click="cancelled = true">취소</button>
    </template>
    <button v-else class="btn" type="button" @click="run">PDF 용량 줄이기</button>
  </template>

  <div v-if="out && file" class="result" aria-live="polite">
    <div class="sub">{{ formatBytes(file.size) }} →</div>
    <div class="big">{{ formatBytes(out.blob.size) }}</div>
    <template v-if="compareSize(file.size, out.blob.size).smaller">
      <p class="sub" style="margin: 6px 0 12px">{{ compareSize(file.size, out.blob.size).pct }}% 줄었어요</p>
      <a class="btn" :href="out.url" :download="compressedName(file.name)" style="text-align: center; text-decoration: none">PDF 다운로드</a>
    </template>
    <p v-else class="error" style="margin: 8px 0 0">
      이 PDF는 글자 위주라 이미 작아서 더 줄지 않았어요. 원본을 그대로 쓰는 게 좋아요.
      <a :href="out.url" :download="compressedName(file.name)">그래도 받기</a>
    </p>
  </div>
  <p class="notice">쪽마다 그림으로 다시 담아 용량을 줄여요. 그래서 결과 PDF의 글자는 검색·복사가 안 돼요. 스캔한 문서나 사진이 많은 PDF에서 가장 많이 줄어요.</p>
</template>
