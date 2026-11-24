<script setup lang="ts">
// PDF 합치기·나누기 UI. pdf-lib은 버튼을 누를 때 동적 import 한다. 파일은 서버로 보내지 않는다.
// 암호 PDF는 pdf-lib가 열지 못해서, 비밀번호를 받아 pdf.js로 암호 없는 사본을 만든 뒤 처리한다(암호 PDF일 때만 pdf.js를 불러온다).
import { ref } from 'vue';
import { filterFiles } from '../../lib/files.js';
import { parsePageRanges, splitFileName } from '../../lib/pageRange.js';
import { downloadBlob, downloadZip } from '../../lib/download.js';
import { loadPdfjs, decryptPdf, passwordState } from '../../lib/pdfjs.js';
import PdfPassword from '../PdfPassword.vue';

const MAX_SIZE = 100 * 1024 * 1024;
const tab = ref<'merge' | 'split'>('merge');
const busy = ref(false);
const error = ref('');
const over = ref(false);

const ask = ref<{ file: File; wrong: boolean; resume: () => Promise<void> } | null>(null); // 비밀번호를 물어볼 파일과 이어서 할 일
const passwords = new WeakMap<File, string>(); // 이 화면에서만 기억
class NeedPassword extends Error {
  constructor(public file: File, public wrong: boolean) { super('password'); }
}

const loadLib = () => import('pdf-lib');
/** PDF 열기. pages: 실제 쪽 수 (암호를 푼 사본에는 맨 뒤에 빈 쪽이 하나 더 있다) */
async function loadPdf(file: File) {
  const { PDFDocument } = await loadLib();
  const fail = () => new Error(`${file.name}: PDF를 읽지 못했어요.`);
  try {
    const doc = await PDFDocument.load(await file.arrayBuffer());
    return { doc, pages: doc.getPageCount() };
  } catch (e) {
    if (!/encrypt/i.test(String(e))) throw fail();
  }
  try {
    const pdfjs: any = await loadPdfjs();
    const b = await PDFDocument.create();
    b.addPage([10, 10]);
    const r = await decryptPdf(pdfjs, new Uint8Array(await file.arrayBuffer()), passwords.get(file), await b.save());
    return { doc: await PDFDocument.load(r.bytes), pages: r.pages };
  } catch (e) {
    const st = passwordState(e);
    if (st) { passwords.delete(file); throw new NeedPassword(file, st === 'wrong'); }
    if ((e as Error).name === 'RestrictedError') throw new Error(`${file.name}: 만든 사람이 편집을 막아 둔 PDF라 합치거나 나눌 수 없어요.`);
    throw fail();
  }
}
function onFail(e: unknown, resume: () => Promise<void>) {
  if (e instanceof NeedPassword) ask.value = { file: e.file, wrong: e.wrong, resume };
  else { ask.value = null; error.value = (e as Error).message; }
}
function submitPassword(p: string) {
  const a = ask.value;
  if (!a) return;
  passwords.set(a.file, p);
  a.resume();
}
const pdfBlob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: 'application/pdf' });

// ── 합치기
const files = ref<File[]>([]);
const rejected = ref<string[]>([]);
let dragIndex = -1;

function addFiles(list: FileList | null | undefined) {
  if (!list) return;
  const r = filterFiles([...list], { exts: ['pdf'], maxSize: MAX_SIZE, maxCount: 50, already: files.value.length });
  files.value.push(...r.accepted);
  rejected.value = r.rejected.map((x: { file: File; reason: string }) => `${x.file.name}: ${x.reason}`);
  error.value = '';
}
function move(i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= files.value.length) return;
  const a = files.value;
  [a[i], a[j]] = [a[j], a[i]];
}
function onDragOverItem(i: number) {
  if (dragIndex < 0 || dragIndex === i) return;
  const [f] = files.value.splice(dragIndex, 1);
  files.value.splice(i, 0, f);
  dragIndex = i;
}
async function merge() {
  error.value = '';
  busy.value = true;
  try {
    const { PDFDocument } = await loadLib();
    const out = await PDFDocument.create();
    for (const f of files.value) {
      const src = await loadPdf(f);
      const pages = await out.copyPages(src.doc, Array.from({ length: src.pages }, (_, i) => i));
      pages.forEach((p) => out.addPage(p));
    }
    ask.value = null;
    downloadBlob(pdfBlob(await out.save()), '합친_PDF.pdf');
  } catch (e) {
    onFail(e, merge);
  } finally {
    busy.value = false;
  }
}

// ── 나누기
const splitFile = ref<File | null>(null);
const pageCount = ref(0);
const range = ref('');
const splitMode = ref<'extract' | 'groups' | 'each'>('extract');

async function setSplitFile(list: FileList | null | undefined) {
  error.value = '';
  const f = list?.[0];
  if (!f) return;
  const r = filterFiles([f], { exts: ['pdf'], maxSize: MAX_SIZE, maxCount: 1 });
  if (!r.accepted.length) { error.value = r.rejected[0].reason; return; }
  ask.value = null;
  splitFile.value = null;
  await openSplit(f);
}
let openRun = 0; // 파일을 연달아 고르면 마지막 것만
async function openSplit(f: File) {
  const my = ++openRun;
  error.value = '';
  try {
    busy.value = true;
    const { pages } = await loadPdf(f);
    if (my !== openRun) return;
    ask.value = null;
    splitFile.value = f;
    pageCount.value = pages;
    range.value = `1-${pageCount.value}`;
  } catch (e) {
    if (my === openRun) onFail(e, () => openSplit(f));
  } finally {
    if (my === openRun) busy.value = false;
  }
}
async function split() {
  if (!splitFile.value) return;
  error.value = '';
  let groups: number[][];
  if (splitMode.value === 'each') {
    groups = Array.from({ length: pageCount.value }, (_, i) => [i + 1]);
  } else {
    const r = parsePageRanges(range.value, pageCount.value);
    if ('error' in r) { error.value = r.error; return; }
    groups = splitMode.value === 'extract' ? [r.pages] : r.groups;
  }
  busy.value = true;
  try {
    const { PDFDocument } = await loadLib();
    const src = (await loadPdf(splitFile.value)).doc;
    const outputs: { name: string; blob: Blob }[] = [];
    for (const g of groups) {
      const out = await PDFDocument.create();
      const pages = await out.copyPages(src, g.map((p) => p - 1));
      pages.forEach((p) => out.addPage(p));
      outputs.push({ name: splitFileName(splitFile.value.name, g), blob: pdfBlob(await out.save()) });
    }
    if (outputs.length === 1) downloadBlob(outputs[0].blob, outputs[0].name);
    else await downloadZip(outputs, splitFile.value.name.replace(/\.pdf$/i, '') + '_나누기.zip');
  } catch (e) {
    onFail(e, split);
  } finally {
    busy.value = false;
  }
}
const mb = (n: number) => (n / 1024 / 1024).toFixed(1) + 'MB';
</script>

<template>
  <div class="tabs" role="tablist">
    <button type="button" role="tab" :aria-selected="tab === 'merge'" @click="tab = 'merge'; error = ''; ask = null">PDF 합치기</button>
    <button type="button" role="tab" :aria-selected="tab === 'split'" @click="tab = 'split'; error = ''; ask = null">PDF 나누기·추출</button>
  </div>

  <template v-if="tab === 'merge'">
    <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; addFiles($event.dataTransfer?.files)">
      <input type="file" accept="application/pdf,.pdf" multiple @change="addFiles(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
      <strong>합칠 PDF 파일들을 끌어다 놓거나 눌러서 고르세요</strong><br />
      <small class="muted">순서는 아래에서 바꿀 수 있어요 · 서버로 올라가지 않아요</small>
    </label>
    <p v-for="r in rejected" :key="r" class="error" style="margin: 6px 0 0">{{ r }}</p>
    <ul v-if="files.length" class="file-list">
      <li v-for="(f, i) in files" :key="f.name + f.size + f.lastModified" draggable="true"
          @dragstart="dragIndex = i" @dragover.prevent="onDragOverItem(i)" @dragend="dragIndex = -1" style="cursor: grab">
        <span aria-hidden="true">☰</span>
        <span class="name">{{ i + 1 }}. {{ f.name }}</span>
        <small class="muted">{{ mb(f.size) }}</small>
        <button type="button" class="btn-sub" :disabled="i === 0" aria-label="위로" @click="move(i, -1)">↑</button>
        <button type="button" class="btn-sub" :disabled="i === files.length - 1" aria-label="아래로" @click="move(i, 1)">↓</button>
        <button type="button" class="btn-sub" aria-label="빼기" @click="files.splice(i, 1); ask = null">✕</button>
      </li>
    </ul>
    <button v-if="!ask" class="btn" type="button" :disabled="files.length < 2 || busy" @click="merge">
      {{ busy ? '합치는 중…' : files.length < 2 ? 'PDF를 2개 이상 넣어 주세요' : `${files.length}개 합쳐서 저장` }}
    </button>
  </template>

  <template v-else>
    <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; setSplitFile($event.dataTransfer?.files)">
      <input type="file" accept="application/pdf,.pdf" @change="setSplitFile(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
      <strong>{{ splitFile ? splitFile.name : '나눌 PDF 파일 하나를 고르세요' }}</strong><br />
      <small class="muted">{{ splitFile ? `전체 ${pageCount}쪽` : '서버로 올라가지 않아요' }}</small>
    </label>
    <template v-if="splitFile">
      <div class="chips" style="margin-top: 14px">
        <button type="button" class="chip" :class="{ on: splitMode === 'extract' }" @click="splitMode = 'extract'">선택한 페이지만 한 파일로</button>
        <button type="button" class="chip" :class="{ on: splitMode === 'groups' }" @click="splitMode = 'groups'">범위마다 따로 파일로</button>
        <button type="button" class="chip" :class="{ on: splitMode === 'each' }" @click="splitMode = 'each'">모든 페이지 한 장씩</button>
      </div>
      <div v-if="splitMode !== 'each'" class="field" style="margin-top: 14px">
        <label for="range">페이지 범위</label>
        <input id="range" v-model="range" type="text" placeholder="예: 1-3, 5, 8-" />
        <small class="muted">쉼표로 구분 · "8-"은 8쪽부터 끝까지<template v-if="splitMode === 'groups'"> · 쉼표로 나눈 묶음마다 파일이 하나씩 생겨요</template></small>
      </div>
      <button class="btn" type="button" :disabled="busy" @click="split">{{ busy ? '처리 중…' : '나눠서 저장' }}</button>
    </template>
  </template>

  <PdfPassword v-if="ask" :name="ask.file.name" :wrong="ask.wrong" :busy="busy" @submit="submitPassword" @cancel="ask = null" />
  <p v-if="error" class="error" role="alert">{{ error }}</p>
</template>
