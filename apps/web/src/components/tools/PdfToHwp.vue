<script setup lang="ts">
// PDF → 한글(HWPX) 변환 UI. 글자 정리는 src/lib/pdfToHwpx.js, 그림 꺼내기는 src/lib/pdfImages.js,
// HTML → HWPX는 hwp-convert(MIT), 압축은 fflate. 모두 이 페이지에서만 동적 import. 파일은 서버로 보내지 않는다.
import { ref, computed, onBeforeUnmount } from 'vue';
import { loadPdfjs, pdfOpenError } from '../../lib/pdfjs.js';
import { groupLines, toBlocks, buildHtml, insertPageBreaks, cleanPreview, hwpxOutName } from '../../lib/pdfToHwpx.js';
import { formatBytes } from '../../lib/compress.js';
import { filterFiles } from '../../lib/files.js';

const MAX = 100 * 1024 * 1024;
const MAX_PAGES = 300;
const file = ref<File | null>(null);
const withImages = ref(true);
const busy = ref(false);
const progress = ref(0);
const step = ref('');
const error = ref('');
const over = ref(false);
const out = ref<{ url: string; blob: Blob; pages: number; paras: number; images: number; scanned: number; preview: string } | null>(null);
let task: any = null;

function clearOut() { if (out.value) URL.revokeObjectURL(out.value.url); out.value = null; }

function setFile(list: FileList | null | undefined) {
  error.value = '';
  const f = list?.[0];
  if (!f) return;
  const r = filterFiles([f], { exts: ['pdf'], maxSize: MAX, maxCount: 1 });
  if (!r.accepted.length) { error.value = r.rejected[0].reason; return; }
  clearOut();
  file.value = f;
}

async function run() {
  if (!file.value || busy.value) return;
  busy.value = true; error.value = ''; clearOut(); progress.value = 0;
  try {
    step.value = 'PDF를 여는 중…';
    const pdfjs: any = await loadPdfjs();
    task = pdfjs.getDocument({ data: new Uint8Array(await file.value.arrayBuffer()) });
    let doc;
    try { doc = await task.promise; } catch (e) { throw Object.assign(new Error(pdfOpenError(e)), { user: true }); }
    if (doc.numPages > MAX_PAGES) throw Object.assign(new Error(`${MAX_PAGES}쪽까지 변환할 수 있어요. (이 PDF는 ${doc.numPages}쪽)`), { user: true });
    const imgs = withImages.value ? await import('../../lib/pdfImages.js') : null;
    // 1) 쪽마다 글자 줄 모으기 (본문 글자 크기는 전체 기준으로 정해 제목 판단을 일정하게)
    const pageLines: any[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      step.value = `글자 읽는 중… (${i}/${doc.numPages}쪽)`;
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      pageLines.push({ page, lines: groupLines(tc.items) });
      progress.value = (i / doc.numPages) * 0.4;
    }
    const sizes = pageLines.flatMap((p) => p.lines.map((l: any) => l.size)).sort((a: number, b: number) => a - b);
    const body = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 10;
    // 2) 문단·그림
    const pages: any[] = [];
    let paras = 0, images = 0, scanned = 0;
    for (let i = 0; i < pageLines.length; i++) {
      const { page, lines } = pageLines[i];
      step.value = withImages.value ? `문단·그림 정리 중… (${i + 1}/${pageLines.length}쪽)` : `문단 정리 중… (${i + 1}/${pageLines.length}쪽)`;
      const blocks = toBlocks(lines, body);
      let pi: any[] = [];
      if (!lines.length) {
        scanned++;
        if (imgs) pi = [await imgs.pageSnapshot(page)];
      } else if (imgs) pi = await imgs.pageImages(pdfjs, page);
      paras += blocks.length; images += pi.length;
      pages.push({ blocks, images: pi });
      progress.value = 0.4 + ((i + 1) / pageLines.length) * 0.45;
      page.cleanup?.();
    }
    if (!paras && !images) throw Object.assign(new Error('글자를 찾지 못했어요. 스캔한 PDF라면 "그림도 넣기"를 켜고 다시 변환하거나, 사진 글자 추출로 글자를 먼저 뽑아 보세요.'), { user: true });
    // 3) HTML → HWPX, 쪽 나눔 넣기
    step.value = '한글 문서로 만드는 중…';
    const [{ htmlToHwpx }, { unzipSync, zipSync, strFromU8, strToU8 }] = await Promise.all([import('hwp-convert'), import('fflate')]);
    const title = file.value.name.replace(/\.pdf$/i, '');
    const raw: Uint8Array = await htmlToHwpx(buildHtml(pages), { title, creator: '뚝딱' });
    const files: Record<string, Uint8Array> = unzipSync(raw);
    files['Contents/section0.xml'] = strToU8(insertPageBreaks(strFromU8(files['Contents/section0.xml'])).xml);
    if (files['Preview/PrvText.txt']) files['Preview/PrvText.txt'] = strToU8(cleanPreview(strFromU8(files['Preview/PrvText.txt'])));
    // mimetype은 맨 앞, 압축하지 않고 (HWPX 규칙)
    const ordered: Record<string, any> = { mimetype: [files.mimetype, { level: 0 }] };
    for (const [k, v] of Object.entries(files)) if (k !== 'mimetype') ordered[k] = v;
    const bytes = zipSync(ordered);
    const blob = new Blob([bytes as BlobPart], { type: 'application/hwp+zip' });
    const preview = pages.flatMap((p) => p.blocks.map((b: any) => b.text)).join('\n').slice(0, 400);
    out.value = { url: URL.createObjectURL(blob), blob, pages: pages.length, paras, images, scanned, preview };
    progress.value = 1;
  } catch (e: any) {
    error.value = e?.user ? e.message : '변환 중 문제가 생겼어요. 다른 PDF로 시도하거나 "그림 포함"을 끄고 다시 해 보세요.';
  } finally {
    busy.value = false; step.value = '';
    task?.destroy?.(); task = null;
  }
}
onBeforeUnmount(() => { task?.destroy?.(); clearOut(); });
const outName = computed(() => (file.value ? hwpxOutName(file.value.name) : '변환.hwpx'));
</script>

<template>
  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; setFile($event.dataTransfer?.files)">
    <input type="file" accept="application/pdf,.pdf" @change="setFile(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>{{ file ? file.name : 'PDF를 끌어다 놓거나 눌러서 고르세요' }}</strong><br />
    <small class="muted">{{ file ? formatBytes(file.size) : `최대 100MB · ${MAX_PAGES}쪽 · 서버로 올라가지 않아요` }}</small>
  </label>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <template v-if="file">
    <label class="check"><input v-model="withImages" type="checkbox" :disabled="busy" /> 그림도 넣기 <small class="muted">(글자가 없는 스캔 쪽은 쪽 전체를 그림으로)</small></label>
    <template v-if="busy">
      <div class="progress" style="height: 8px; margin-top: 12px"><div :style="{ width: progress * 100 + '%' }"></div></div>
      <p class="muted" style="margin: 6px 0 0">{{ step }} {{ Math.round(progress * 100) }}%</p>
    </template>
    <button v-else class="btn" type="button" @click="run">한글(HWPX)로 변환하기</button>
  </template>

  <div v-if="out && file" class="result" aria-live="polite">
    <div class="sub">{{ out.pages }}쪽 · 문단 {{ out.paras }}개 · 그림 {{ out.images }}개<template v-if="out.scanned"> · 글자 없는 쪽 {{ out.scanned }}개</template></div>
    <div class="big">{{ formatBytes(out.blob.size) }}</div>
    <p v-if="out.scanned && !withImages" class="sub" style="margin: 6px 0 0">글자가 없는 쪽(스캔)은 비어 있어요. "그림도 넣기"를 켜면 쪽 전체가 그림으로 들어가요.</p>
    <a class="btn" :href="out.url" :download="outName" style="text-align: center; text-decoration: none">HWPX 다운로드</a>
    <details style="margin-top: 12px">
      <summary class="muted">뽑은 글 미리보기</summary>
      <pre class="preview">{{ out.preview }}{{ out.preview.length >= 400 ? '…' : '' }}</pre>
    </details>
  </div>
  <p class="muted" style="margin: 12px 0 0">글자와 문단 순서를 중심으로 옮겨요. 표·여러 단·글상자처럼 복잡한 배치는 단순해질 수 있어요. 한글에서 열어 HWP로 다시 저장할 수 있어요.</p>
</template>

<style scoped>
.check { display: inline-flex; gap: 6px; align-items: center; margin-top: 14px; font-weight: 500; flex-wrap: wrap; }
.preview { white-space: pre-wrap; word-break: keep-all; background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 10px; font: inherit; font-size: .9rem; max-height: 240px; overflow: auto; margin: 8px 0 0; }
</style>
