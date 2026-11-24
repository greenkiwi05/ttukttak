<script setup lang="ts">
// PDF 비밀번호 걸기 UI. 검사는 src/lib/pdfLock.js, 암호화(AES-256)는 qpdf(WASM)를 작업자(src/lib/qpdf.worker.js)에서 돌린다.
// 파일과 비밀번호는 브라우저 안에서만 쓰고 저장하거나 보내지 않는다.
import { ref, computed, onBeforeUnmount } from 'vue';
import { filterFiles } from '../../lib/files.js';
import { formatBytes } from '../../lib/compress.js';
import { downloadBlob } from '../../lib/download.js';
import { checkPassword, lockedName } from '../../lib/pdfLock.js';
import { loadPdfjs, openPdf, pdfOpenError, passwordState, canRearrange } from '../../lib/pdfjs.js';
import PdfPassword from '../PdfPassword.vue';

const MAX = 100 * 1024 * 1024;
const file = ref<File | null>(null);
const pages = ref(0);
const changing = ref(false); // 이미 비밀번호가 걸린 PDF → 새 비밀번호로 바꾸기
const ask = ref<{ file: File; wrong: boolean } | null>(null);
const opening = ref(false);
const busy = ref(false);
const pw = ref('');
const again = ref('');
const show = ref(false);
const error = ref('');
const over = ref(false);
const done = ref<{ blob: Blob; name: string } | null>(null);
let current: string | undefined; // 지금 걸려 있는 비밀번호 (화면을 닫으면 사라짐)
let openRun = 0;
let worker: Worker | null = null;

const check = computed(() => checkPassword(pw.value, again.value));

function stopWorker() { worker?.terminate(); worker = null; busy.value = false; }

async function setFile(list: FileList | null | undefined) {
  error.value = '';
  const f = list?.[0];
  if (!f) return;
  const r = filterFiles([f], { exts: ['pdf'], maxSize: MAX, maxCount: 1 });
  if (!r.accepted.length) { error.value = r.rejected[0].reason; return; }
  stopWorker();
  done.value = null; ask.value = null; file.value = null;
  await openFile(f);
}

async function openFile(f: File, password?: string) {
  const my = ++openRun;
  error.value = '';
  opening.value = true;
  let task: any = null;
  try {
    const pdfjs: any = await loadPdfjs();
    task = openPdf(pdfjs, new Uint8Array(await f.arrayBuffer()), password);
    const doc = await task.promise;
    const perm = await doc.getPermissions();
    if (my !== openRun) return;
    ask.value = null;
    if (!canRearrange(perm)) { error.value = '만든 사람이 편집을 막아 둔 PDF라 비밀번호를 걸거나 바꿀 수 없어요.'; return; }
    pages.value = doc.numPages;
    changing.value = !!password;
    current = password;
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

async function lock() {
  const f = file.value;
  if (!f || !check.value.ok || busy.value) return;
  error.value = '';
  done.value = null;
  busy.value = true;
  const bytes = await f.arrayBuffer();
  if (file.value !== f) return;
  const w = (worker = new Worker(new URL('../../lib/qpdf.worker.js', import.meta.url), { type: 'module' }));
  const fail = (m: string) => { if (worker === w) { stopWorker(); error.value = m; } };
  w.onmessage = ({ data }) => {
    if (worker !== w) return;
    if (data.error) {
      fail(data.error === 'load' ? '잠그는 프로그램을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 해 보세요.' : data.error === 'verify' ? '비밀번호가 제대로 걸렸는지 확인하지 못해서 파일을 만들지 않았어요. 다른 비밀번호로 다시 해 보세요.' : '이 PDF에는 비밀번호를 걸지 못했어요. 파일이 손상되었을 수 있어요.');
      return;
    }
    stopWorker();
    done.value = { blob: new Blob([data.bytes], { type: 'application/pdf' }), name: lockedName(f.name) };
  };
  w.onerror = () => fail('비밀번호를 거는 중 문제가 생겼어요. 파일이 너무 크면 나눠서 해 보세요.');
  w.postMessage({ bytes, password: pw.value, current }, [bytes]);
}

function edited() { done.value = null; error.value = ''; }
onBeforeUnmount(() => { openRun++; stopWorker(); });
</script>

<template>
  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; setFile($event.dataTransfer?.files)">
    <input type="file" accept="application/pdf,.pdf" @change="setFile(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong role="status">{{ opening && !ask ? 'PDF 여는 중…' : file ? file.name : '비밀번호를 걸 PDF를 끌어다 놓거나 눌러서 고르세요' }}</strong><br />
    <small class="muted">{{ opening && !ask ? '처음에는 프로그램을 내려받느라 몇 초 걸릴 수 있어요' : file ? `${formatBytes(file.size)} · ${pages}쪽` : '최대 100MB · 서버로 올라가지 않아요' }}</small>
  </label>
  <PdfPassword v-if="ask" :name="ask.file.name" :wrong="ask.wrong" :busy="opening" change @submit="(p) => openFile(ask!.file, p)" @cancel="ask = null" />

  <form v-if="file" class="lock" @submit.prevent="lock">
    <p v-if="changing" class="notice" style="margin-top: 14px">이미 비밀번호가 걸린 PDF예요. 새 비밀번호로 바꿔 드려요.</p>
    <div class="row" style="margin-top: 16px">
      <div class="field"><label for="lk-pw">새 비밀번호</label><input id="lk-pw" v-model="pw" :type="show ? 'text' : 'password'" autocomplete="off" autocapitalize="off" spellcheck="false" :disabled="busy" @input="edited" /></div>
      <div class="field"><label for="lk-again">한 번 더 입력</label><input id="lk-again" v-model="again" :type="show ? 'text' : 'password'" autocomplete="off" autocapitalize="off" spellcheck="false" :disabled="busy" @input="edited" /></div>
    </div>
    <label class="check"><input v-model="show" type="checkbox" /> 비밀번호 보기</label>
    <p v-if="check.error" class="error" role="alert">{{ check.error }}</p>
    <ul v-else-if="check.hints.length" class="hints"><li v-for="h in check.hints" :key="h">{{ h }}</li></ul>
    <button class="btn" type="submit" :disabled="!check.ok || busy">{{ busy ? '비밀번호 거는 중…' : changing ? '비밀번호 바꾸기' : '비밀번호 걸기' }}</button>
  </form>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <div v-if="done" class="result" aria-live="polite">
    <div class="sub">이제 비밀번호를 알아야 열 수 있어요</div>
    <div class="big done">{{ done.name }}</div>
    <p class="sub" style="margin: 6px 0 0">{{ formatBytes(done.blob.size) }}</p>
    <button type="button" class="btn" @click="downloadBlob(done.blob, done.name)">PDF 다운로드</button>
    <p class="sub" style="margin: 10px 0 0"><b>비밀번호를 잊으면 누구도 열 수 없어요.</b> 원본 PDF는 따로 보관하세요.</p>
  </div>
</template>

<style scoped>
.hints { margin: 10px 0 0; padding-left: 20px; color: var(--muted); font-size: .92rem; }
.hints li + li { margin-top: 4px; }
.done { font-size: 1.3rem; overflow-wrap: anywhere; }
</style>
