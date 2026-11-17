<script setup lang="ts">
// HWP·HWPX 뷰어 + PDF 저장. @ohah/hwpjs(WASM)를 이 페이지에서만 동적 import 한다. 파일은 서버로 보내지 않는다.
// PDF 저장: 뷰어가 그린 쪽을 한 장씩 이미지로 떠서(쪽 경계는 src/lib/pageScan.js) pdf-lib로 묶는다.
// 엔진이 모든 서식을 재현하지는 못하므로 페이지에 그 한계를 안내한다.
import { ref, shallowRef, onBeforeUnmount } from 'vue';
import { filterFiles } from '../../lib/files.js';
import { findRuns, findEdges, sameColor } from '../../lib/pageScan.js';
import { downloadBlob } from '../../lib/download.js';

const MAX = 50 * 1024 * 1024;
const BG = [232, 237, 242]; // 뷰어 배경색 (쪽 사이 틈)
const file = ref<File | null>(null);
const busy = ref<'' | 'open' | 'pdf'>('');
const progress = ref(0);
const error = ref('');
const over = ref(false);
const root = ref<HTMLElement | null>(null);
const pageCount = ref(0);
let editor: any = null;
let surface: any = null;

async function loadLib() {
  const [core, runtime, vanilla, worker, wasm] = await Promise.all([
    import('@ohah/hwpjs'),
    import('@ohah/hwpjs/runtime'),
    import('@ohah/hwpjs/vanilla'),
    import('@ohah/hwpjs/worker?url'),
    import('@ohah/hwpjs/wasm?url'),
  ]);
  return { core: core as any, runtime: runtime as any, vanilla: vanilla as any, workerURL: (worker as any).default as string, wasmURL: (wasm as any).default as string };
}

async function close() {
  try { await surface?.dispose?.(); } catch { /* 이미 정리됨 */ }
  try { await editor?.dispose?.(); } catch { /* 이미 정리됨 */ }
  surface = null; editor = null;
}

async function open(list: FileList | null | undefined) {
  error.value = '';
  const f = list?.[0];
  if (!f) return;
  const r = filterFiles([f], { exts: ['hwp', 'hwpx'], maxSize: MAX, maxCount: 1 });
  if (!r.accepted.length) { error.value = r.rejected[0].reason; return; }
  busy.value = 'open';
  await close();
  file.value = f;
  try {
    const { core, runtime, vanilla, workerURL, wasmURL } = await loadLib();
    const b = new Uint8Array(await f.arrayBuffer());
    const format = core.detectDocumentFormat(b);
    if (format !== 'hwp5' && format !== 'hwpx') throw new Error('format');
    editor = core.createEditor({ runtimeFactory: runtime.createWorkerRuntimeFactory({ workerURL, wasmURL }) });
    surface = vanilla.createCanvasSurface({ root: root.value!, editor });
    await editor.load(b, { format, editable: false });
    // 배포용 문서(복사·인쇄 제한)는 쪽 모양을 그릴 수 없어 문단 목록으로만 보인다 → 열지 않고 안내
    const content = editor.getEditorState?.()?.content;
    if (content?.primarySource === 'distribution_viewtext') throw new Error('distribution');
  } catch (e) {
    await close();
    file.value = null;
    const msg = String((e as Error)?.name ?? '') + String((e as Error)?.message ?? '');
    error.value = /distribution/.test(msg)
      ? '배포용 문서(복사·인쇄가 제한된 문서)는 열 수 없어요. 문서를 보낸 곳에 일반 HWP나 PDF로 다시 받아 주세요.'
      : /password|암호/i.test(msg)
      ? '암호가 걸린 문서는 열 수 없어요. 한글 프로그램에서 암호를 푼 뒤 다시 시도해 주세요.'
      : 'HWP 문서를 열지 못했어요. 파일이 손상되었거나 아직 지원하지 않는 형식일 수 있어요.';
  } finally {
    busy.value = '';
  }
}

// ── PDF 저장 (화면에 그려진 쪽을 캡처)
const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 캔버스 그림이 더 이상 바뀌지 않을 때까지 기다린다 */
async function settle(c: HTMLCanvasElement) {
  let prev = '';
  for (let i = 0; i < 30; i++) {
    await frame(); await sleep(50);
    const ctx = c.getContext('2d')!;
    const col = ctx.getImageData(Math.floor(c.width / 2), 0, 1, c.height).data;
    let h = c.width * 31 + c.height;
    for (let k = 0; k < col.length; k += 16) h = (h * 33 + col[k]) | 0;
    const sig = String(h);
    if (sig === prev) return;
    prev = sig;
  }
}
function scrollerOf(r: HTMLElement) {
  return [...r.querySelectorAll<HTMLElement>('div')].find((d) => /auto|scroll/.test(getComputedStyle(d).overflowY)) ?? null;
}

async function savePdf() {
  const r = root.value, f = file.value;
  if (!r || !f) return;
  const sc = scrollerOf(r), canvas = r.querySelector('canvas');
  if (!sc || !canvas) { error.value = 'PDF를 만들 수 없어요. 문서를 다시 열어 주세요.'; return; }
  error.value = '';
  busy.value = 'pdf';
  progress.value = 0;
  const saved = { w: r.style.width, h: r.style.height, top: sc.scrollTop };
  try {
    // 1) 쪽 전체 너비가 보이게 넓히고, 한 번에 볼 높이를 정한다
    r.style.width = `${sc.scrollWidth + (r.offsetWidth - sc.clientWidth) + 2}px`;
    r.style.height = '1600px';
    await settle(canvas);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const k = canvas.height / sc.clientHeight; // 화면 1px = 캔버스 k px (고해상도 화면)
    // 2) 쪽 가로 끝 찾기
    let left = Infinity, right = -1;
    for (let y = 0; y < canvas.height; y += 40) {
      const row = ctx.getImageData(0, y, canvas.width, 1).data;
      const isBg = Array.from({ length: canvas.width }, (_, x) => sameColor(row[x * 4], row[x * 4 + 1], row[x * 4 + 2], BG));
      const e = findEdges(isBg);
      if (e && e.right - e.left > canvas.width * 0.3) { left = Math.min(left, e.left); right = Math.max(right, e.right); }
    }
    if (right < 0) throw new Error('no page');
    // 3) 위에서 아래로 훑으며 쪽 경계 찾기 (화면 px 단위)
    const total = sc.scrollHeight, view = sc.clientHeight, x = left + 3;
    const isBg: boolean[] = new Array(total).fill(true);
    for (let y0 = 0; y0 < total; y0 += view) {
      sc.scrollTop = y0;
      await settle(canvas);
      const st = sc.scrollTop;
      const col = ctx.getImageData(x, 0, 1, canvas.height).data;
      for (let yy = 0; yy < view && st + yy < total; yy++) {
        const p = Math.min(canvas.height - 1, Math.round(yy * k)) * 4;
        isBg[st + yy] = sameColor(col[p], col[p + 1], col[p + 2], BG);
      }
      progress.value = Math.min(0.3, (y0 / total) * 0.3);
    }
    // 쪽 테두리(1px)가 PDF 가장자리에 줄로 남지 않게 사방 1px씩 안쪽만 쓴다
    const pages = findRuns(isBg, { minGap: 6, minPage: 100 }).map((p) => ({ top: p.top + 1, bottom: p.bottom - 1 }));
    if (!pages.length) throw new Error('no page');
    // 4) 쪽마다 캡처해서 PDF로
    const tallest = Math.max(...pages.map((p) => p.bottom - p.top + 1));
    if (tallest + 10 > view) { r.style.height = `${tallest + 20}px`; await settle(canvas); }
    const kk = canvas.height / sc.clientHeight;
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    const inset = Math.round(kk);
    const x0 = left + inset, w = right - left + 1 - inset * 2;
    for (const [i, p] of pages.entries()) {
      sc.scrollTop = p.top;
      await settle(canvas);
      const off = p.top - sc.scrollTop; // 끝쪽은 더 내려가지 않을 수 있음
      const hCss = p.bottom - p.top + 1;
      const out = document.createElement('canvas');
      out.width = w; out.height = Math.round(hCss * kk);
      out.getContext('2d')!.drawImage(canvas, x0, Math.round(off * kk), w, out.height, 0, 0, w, out.height);
      const blob: Blob = await new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error())), 'image/jpeg', 0.92));
      const img = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const ptW = (w / kk) * 0.75, ptH = hCss * 0.75; // 화면 96dpi 기준 → PDF 72pt
      pdf.addPage([ptW, ptH]).drawImage(img, { x: 0, y: 0, width: ptW, height: ptH });
      progress.value = 0.3 + ((i + 1) / pages.length) * 0.7;
    }
    pageCount.value = pages.length;
    downloadBlob(new Blob([(await pdf.save()) as BlobPart], { type: 'application/pdf' }), f.name.replace(/\.hwpx?$/i, '') + '.pdf');
  } catch {
    error.value = 'PDF를 만들지 못했어요. 문서가 너무 크거나 아직 지원하지 않는 내용이 있을 수 있어요.';
  } finally {
    r.style.width = saved.w; r.style.height = saved.h;
    sc.scrollTop = saved.top;
    busy.value = '';
  }
}

onBeforeUnmount(close);
</script>

<template>
  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; open($event.dataTransfer?.files)">
    <input type="file" accept=".hwp,.hwpx" @change="open(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>{{ file ? file.name : 'HWP·HWPX 파일을 끌어다 놓거나 눌러서 고르세요' }}</strong><br />
    <small class="muted">{{ busy === 'open' ? '문서를 여는 중… (처음엔 엔진을 불러오느라 조금 걸려요)' : '설치 없이 열려요 · 서버로 올라가지 않아요' }}</small>
  </label>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <div class="hwp-wrap" :class="{ capturing: busy === 'pdf' }">
    <div v-show="file" ref="root" class="hwp-view" aria-label="문서 미리보기"></div>
    <div v-if="busy === 'pdf'" class="hwp-cover">PDF 만드는 중… {{ Math.round(progress * 100) }}%</div>
  </div>

  <template v-if="file && busy !== 'open'">
    <div v-if="busy === 'pdf'" class="progress"><div :style="{ width: progress * 100 + '%' }"></div></div>
    <button class="btn" type="button" :disabled="!!busy" @click="savePdf">{{ busy === 'pdf' ? 'PDF 만드는 중…' : 'PDF로 저장' }}</button>
    <p v-if="pageCount && !busy" class="muted" style="margin: 8px 0 0">{{ pageCount }}쪽짜리 PDF를 저장했어요.</p>
    <p class="notice">미리보기 화면 그대로 PDF로 저장돼요. 쪽을 그림으로 담기 때문에 PDF 속 글자는 검색·복사가 안 돼요. 복잡한 표·도형·글상자나 특수한 글꼴은 원본과 다르게 보일 수 있으니, 중요한 서류는 결과를 꼭 확인하세요.</p>
  </template>
</template>

<style scoped>
.hwp-wrap { position: relative; overflow: hidden; }
.hwp-view { height: 70vh; min-height: 420px; margin-top: 14px; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: #e9ecef; position: relative; }
.hwp-cover { position: absolute; inset: 14px 0 0; display: grid; place-items: center; background: rgba(255, 255, 255, .85); font-weight: 700; border-radius: 10px; }
</style>
