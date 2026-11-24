<script setup lang="ts">
// QR코드·바코드 스캔 UI. 내용 해석·링크 주의점은 src/lib/qrRead.js, 인식은 zxing-wasm(MIT, 이 페이지에서만 동적 import).
// 카메라 영상과 사진은 브라우저 안에서만 처리한다. 링크는 자동으로 열지 않고, 주소를 먼저 보여 준 뒤 사용자가 눌러야 연다.
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { parseCode, cameraMessage, uniqueCodes, scanSizes } from '../../lib/qrRead.js';
import { filterFiles } from '../../lib/files.js';

const MAX = 30 * 1024 * 1024;
const EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'heic', 'heif'];
// 잘못 읽기 쉬운 형식(ITF 등)은 빼고 흔히 쓰는 것만
const FORMATS = ['QRCode', 'MicroQRCode', 'DataMatrix', 'EAN13', 'EAN8', 'UPCA', 'UPCE', 'Code128', 'Code39'] as const;
const MATRIX = new Set(['QRCode', 'DataMatrix']);

type Code = { text: string; barcode: boolean };
const codes = ref<Code[]>([]);
const error = ref('');
const camError = ref('');
const busy = ref(false);
const camera = ref<'off' | 'starting' | 'on'>('off');
const cams = ref<string[]>([]); // 카메라 장치 ID 목록 (2개 이상이면 전환 버튼)
const over = ref(false);
const shown = ref(false); // 와이파이 비밀번호 보이기
const copied = ref('');
const video = ref<HTMLVideoElement | null>(null);
const resultBox = ref<HTMLElement | null>(null);
let stream: MediaStream | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let session = 0; // 카메라를 껐다 켤 때 이전 작업이 끼어들지 않게
let fileRun = 0; // 사진을 연달아 넣으면 마지막 것만
let canvas: HTMLCanvasElement | null = null;

const items = computed(() => codes.value.map((c) => ({ ...c, info: parseCode(c.text, { barcode: c.barcode }) })));

let lib: Promise<typeof import('zxing-wasm/reader')> | null = null;
function loadLib() {
  lib ??= Promise.all([import('zxing-wasm/reader'), import('zxing-wasm/reader/zxing_reader.wasm?url')]).then(([m, wasm]) => {
    // 기본값은 외부 CDN이라 우리 사이트에 있는 파일을 쓰게 한다
    m.prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasm.default : prefix + path) } });
    return m;
  });
  lib.catch(() => { lib = null; }); // 실패하면 다음에 다시 시도
  return lib;
}

async function decode(src: CanvasImageSource, w: number, h: number, scale: number, hard: boolean): Promise<Code[]> {
  const m = await loadLib();
  canvas ??= document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff'; // 투명 배경 PNG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const r = await m.readBarcodes(data, { formats: [...FORMATS], tryHarder: hard, tryInvert: hard, maxNumberOfSymbols: hard ? 10 : 1 });
  return uniqueCodes(r.filter((x) => x.isValid).map((x) => ({ text: x.text, barcode: !MATRIX.has(x.symbology) })));
}

async function show(list: Code[]) {
  codes.value = list;
  shown.value = false;
  await nextTick();
  resultBox.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── 사진으로 읽기 ──
async function readFile(list: FileList | File[] | null | undefined) {
  const f = list?.[0];
  if (!f) return;
  stopCamera();
  const run = ++fileRun;
  error.value = '';
  camError.value = '';
  codes.value = [];
  const r = filterFiles([f], { exts: EXTS, maxSize: MAX, maxCount: 1 });
  if (!r.accepted.length) { error.value = r.rejected[0].reason; return; }
  busy.value = true;
  let bmp: ImageBitmap | null = null;
  try {
    try { bmp = await createImageBitmap(f); } catch { throw new Error('open'); }
    let found: Code[] = [];
    for (const s of scanSizes(bmp.width, bmp.height)) {
      found = await decode(bmp, bmp.width, bmp.height, s, true);
      if (found.length || run !== fileRun) break;
    }
    if (run !== fileRun) return;
    if (found.length) await show(found);
    else error.value = '사진에서 QR코드나 바코드를 찾지 못했어요. 코드가 크고 또렷하게 나온 사진을 쓰거나, 코드 주변만 잘라서 다시 올려 보세요.';
  } catch (e) {
    if (run !== fileRun) return;
    error.value = (e as Error).message === 'open'
      ? /\.hei[cf]$/i.test(f.name) ? '이 브라우저는 아이폰 HEIC 사진을 열지 못해요. HEIC JPG 변환 도구로 바꾸거나 화면을 캡처해서 올려 주세요.' : '이미지를 열지 못했어요. 다른 사진으로 다시 해 보세요.'
      : '인식 프로그램을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 해 보세요.';
  } finally {
    bmp?.close();
    if (run === fileRun) busy.value = false;
  }
}

// Ctrl+V로 캡처한 이미지 붙여넣기
function onPaste(e: ClipboardEvent) {
  const f = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))?.getAsFile();
  if (f) { e.preventDefault(); readFile([new File([f], `capture.${f.type.split('/')[1] || 'png'}`, { type: f.type })]); }
}

// ── 카메라로 스캔 ──
async function startCamera(deviceId?: string) {
  stopCamera();
  const my = ++session;
  fileRun++;
  busy.value = false;
  error.value = ''; camError.value = '';
  codes.value = [];
  if (!navigator.mediaDevices?.getUserMedia) { camError.value = cameraMessage('Unsupported'); return; }
  camera.value = 'starting';
  try {
    const st = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }), width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    if (my !== session) { st.getTracks().forEach((t) => t.stop()); return; }
    stream = st;
    st.getVideoTracks()[0]?.addEventListener('ended', () => { if (my === session) { stopCamera(); camError.value = cameraMessage('NotReadableError'); } });
    camera.value = 'on';
    await nextTick();
    if (!video.value || my !== session) return;
    video.value.srcObject = st;
    await video.value.play();
    cams.value = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput' && d.deviceId).map((d) => d.deviceId);
    await loadLib();
    tick(my);
  } catch (e) {
    if (my !== session) return;
    stopCamera();
    const name = (e as DOMException).name;
    camError.value = name === 'TypeError' || name === 'Error' ? '인식 프로그램을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 해 보세요.' : cameraMessage(name);
  }
}

async function tick(my: number) {
  if (my !== session || camera.value !== 'on') return;
  const v = video.value;
  let found: Code[] = [];
  if (v && v.readyState >= 2 && v.videoWidth) {
    try { found = await decode(v, v.videoWidth, v.videoHeight, Math.min(1, 1000 / Math.max(v.videoWidth, v.videoHeight)), false); } catch { /* 다음 장면에서 다시 */ }
  }
  if (my !== session) return;
  if (found.length) {
    stopCamera();
    navigator.vibrate?.(80);
    await show(found);
    return;
  }
  timer = setTimeout(() => tick(my), 150);
}

function stopCamera() {
  session++;
  if (timer) { clearTimeout(timer); timer = null; }
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  if (video.value) video.value.srcObject = null;
  camera.value = 'off';
}

function switchCamera() {
  const now = stream?.getVideoTracks()[0]?.getSettings().deviceId;
  const i = cams.value.indexOf(now ?? '');
  startCamera(cams.value[(i + 1) % cams.value.length]);
}

// 다른 탭으로 가면 카메라를 끈다
const onHide = () => { if (document.hidden && camera.value !== 'off') stopCamera(); };

async function copy(text: string, key: string) {
  try { await navigator.clipboard.writeText(text); copied.value = key; setTimeout(() => { if (copied.value === key) copied.value = ''; }, 1500); } catch { /* 복사 불가 환경 */ }
}

onMounted(() => { window.addEventListener('paste', onPaste); document.addEventListener('visibilitychange', onHide); });
onBeforeUnmount(() => { window.removeEventListener('paste', onPaste); document.removeEventListener('visibilitychange', onHide); fileRun++; stopCamera(); });
</script>

<template>
  <div v-if="camera !== 'off'" class="cam">
    <video ref="video" playsinline muted autoplay aria-label="카메라 화면"></video>
    <div class="cam-frame" aria-hidden="true"></div>
  </div>
  <p v-if="camera !== 'off'" class="cam-msg" role="status">{{ camera === 'starting' ? '카메라를 켜는 중… 권한을 물으면 허용을 눌러 주세요' : 'QR코드나 바코드를 화면 가운데에 비춰 주세요' }}</p>
  <div v-if="camera !== 'off'" class="cam-btns">
    <button type="button" class="btn-sub" @click="stopCamera">카메라 끄기</button>
    <button v-if="cams.length > 1 && camera === 'on'" type="button" class="btn-sub" @click="switchCamera">카메라 전환</button>
  </div>
  <button v-else type="button" class="btn cam-start" @click="startCamera()">{{ codes.length ? '다시 스캔하기' : '카메라로 스캔하기' }}</button>
  <p v-if="camError" class="error" role="alert">{{ camError }}</p>

  <label class="drop" :class="{ over }" style="margin-top: 14px" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; readFile($event.dataTransfer?.files)">
    <input type="file" accept="image/*" @change="readFile(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>{{ busy ? '코드를 찾는 중…' : '사진·캡처에서 QR코드 찾기' }}</strong><br />
    <small class="muted">눌러서 고르거나 끌어다 놓기 · PC는 Ctrl+V 붙여넣기 · 서버로 올라가지 않아요</small>
  </label>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <div ref="resultBox" aria-live="polite">
    <p v-if="items.length > 1" class="muted" style="margin: 16px 0 0">코드 {{ items.length }}개를 찾았어요.</p>
    <div v-for="(it, i) in items" :key="it.text" class="result code">
      <div class="sub">{{ it.info.label }}</div>
      <div v-if="it.info.url" class="big host">{{ it.info.url.host }}</div>
      <dl>
        <template v-for="r in it.info.rows" :key="r.label">
          <dt>{{ r.label }}</dt>
          <dd>
            <template v-if="r.secret && !shown">••••••••</template><template v-else>{{ r.value }}</template>
            <button v-if="r.secret" type="button" class="mini" @click="shown = !shown">{{ shown ? '숨기기' : '보기' }}</button>
          </dd>
        </template>
      </dl>
      <ul v-if="it.info.url?.warnings.length" class="warn">
        <li v-for="w in it.info.url.warnings" :key="w">{{ w }}</li>
      </ul>
      <p v-if="it.info.kind === 'scheme'" class="sub" style="margin: 8px 0 0">웹사이트 주소가 아니라서 여기서는 열지 않아요. 휴대폰 기본 카메라나 해당 앱에서 열어 주세요.</p>
      <p v-if="it.info.kind === 'danger'" class="error">웹사이트 주소가 아니라 프로그램으로 실행될 수 있는 내용이에요. 주소창에 붙여 넣지 마세요.</p>
      <div class="acts">
        <a v-if="it.info.href" class="btn" :href="it.info.href" :target="it.info.kind === 'url' ? '_blank' : undefined" rel="noopener noreferrer nofollow">{{ it.info.action }}</a>
        <button type="button" :class="it.info.href ? 'btn-sub' : 'btn'" @click="copy(it.info.copy, String(i))">{{ copied === String(i) ? '복사했어요' : it.info.kind === 'wifi' && it.info.rows.some((r) => r.secret) ? '비밀번호 복사' : '복사' }}</button>
      </div>
      <p v-if="it.info.kind === 'url'" class="sub tip">열기 전에 위의 사이트 이름이 맞는지 확인하세요. 모르는 사이트라면 개인정보나 카드 번호를 넣지 마세요.</p>
    </div>
  </div>
</template>

<style scoped>
.cam { position: relative; border-radius: 12px; overflow: hidden; background: #1c1b19; aspect-ratio: 4 / 3; max-height: 60vh; width: 100%; }
.cam video { width: 100%; height: 100%; object-fit: cover; display: block; }
.cam-frame { position: absolute; inset: 0; margin: auto; height: 62%; aspect-ratio: 1; border: 3px solid #fff; border-radius: 18px; box-shadow: 0 0 0 999px rgba(0, 0, 0, .35); }
.cam-msg { margin: 10px 0 0; text-align: center; font-size: .95rem; color: var(--muted); }
@media (max-width: 520px) { .cam { aspect-ratio: 1; } }
.cam-btns { display: flex; gap: 8px; margin-top: 10px; }
.cam-btns > * { flex: 1; }
.cam-start { margin-top: 0; }
.code .host { word-break: break-all; font-size: 1.5rem; }
.code dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 14px; margin: 8px 0 0; }
.code dt { color: var(--muted); white-space: nowrap; }
.code dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.mini { border: 1px solid var(--line); border-radius: 8px; background: #fff; padding: 2px 10px; margin-left: 8px; font-size: .85rem; cursor: pointer; }
.warn { margin: 12px 0 0; padding: 10px 12px 10px 28px; border-radius: 10px; background: #fff; color: #c92a2a; font-size: .92rem; }
.warn li + li { margin-top: 4px; }
.acts { display: flex; gap: 8px; margin-top: 14px; }
.acts > * { flex: 1; width: auto; margin-top: 0; text-align: center; text-decoration: none; }
.tip { margin: 10px 0 0; font-size: .88rem; }
</style>
