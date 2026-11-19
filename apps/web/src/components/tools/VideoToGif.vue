<script setup lang="ts">
// 동영상 GIF 만들기 UI. 설정 계산은 src/lib/gif.js. 프레임은 mediabunny(CanvasSink)로 읽고 gifenc(MIT)로 GIF를 만든다.
// 둘 다 이 페이지에서만 동적 import. 영상은 서버로 보내지 않는다.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { WIDTHS, FPS, MAX_SECONDS, gifDims, frameTimes, estimateGifBytes, gifOutName } from '../../lib/gif.js';
import { trimRange, fmtTime } from '../../lib/audioExtract.js';
import { formatBytes } from '../../lib/compress.js';
import { filterFiles } from '../../lib/files.js';

const MAX = 2 * 1024 * 1024 * 1024;
const supported = ref(true);
const file = ref<File | null>(null);
const meta = ref<{ w: number; h: number; duration: number } | null>(null);
const width = ref(480);
const fps = ref(10);
const startText = ref('0:00');
const endText = ref('');
const busy = ref<'' | 'read' | 'run'>('');
const progress = ref(0);
const error = ref('');
const over = ref(false);
const out = ref<{ url: string; blob: Blob; w: number; h: number; frames: number } | null>(null);
let cancelled = false;

onMounted(() => { supported.value = typeof (window as any).VideoDecoder !== 'undefined'; });
const lib = () => import('mediabunny');

const range = computed(() => (meta.value ? trimRange(startText.value, endText.value, meta.value.duration) : null));
const rangeOk = computed(() => (range.value && !('error' in range.value) ? range.value : null));
const plan = computed(() => (rangeOk.value ? frameTimes({ start: rangeOk.value.start, end: rangeOk.value.end, fps: fps.value }) : null));
const planOk = computed(() => (plan.value && !('error' in plan.value) ? plan.value : null));
const planErr = computed(() => (range.value && 'error' in range.value ? range.value.error : plan.value && 'error' in plan.value ? plan.value.error : ''));
const dims = computed(() => (meta.value ? gifDims(meta.value.w, meta.value.h, width.value) : null));
const estimate = computed(() => (dims.value && planOk.value ? estimateGifBytes(dims.value.w, dims.value.h, planOk.value.times.length) : 0));

function clearOut() { if (out.value) URL.revokeObjectURL(out.value.url); out.value = null; }

async function setFile(list: FileList | null | undefined) {
  error.value = '';
  const f = list?.[0];
  if (!f) return;
  const r = filterFiles([f], { exts: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', '3gp'], maxSize: MAX, maxCount: 1 });
  if (!r.accepted.length) { error.value = r.rejected[0].reason.replace('2048MB', '2GB'); return; }
  clearOut();
  busy.value = 'read';
  try {
    const { Input, BlobSource, ALL_FORMATS } = await lib();
    const input = new Input({ source: new BlobSource(f), formats: ALL_FORMATS });
    const vt = await input.getPrimaryVideoTrack();
    if (!vt || !(await vt.canDecode())) throw new Error('no video');
    meta.value = { w: vt.displayWidth, h: vt.displayHeight, duration: await input.computeDuration() };
    file.value = f;
    startText.value = '0:00';
    endText.value = fmtTime(Math.min(meta.value.duration, 5));
    input.dispose?.();
  } catch {
    file.value = null; meta.value = null;
    error.value = '이 동영상을 열 수 없어요. MP4·MOV 파일인지 확인하거나, 다른 브라우저(크롬·엣지·사파리 최신 버전)로 시도해 주세요.';
  } finally {
    busy.value = '';
  }
}

async function run() {
  if (!file.value || !planOk.value || !dims.value) return;
  error.value = '';
  clearOut();
  busy.value = 'run';
  progress.value = 0;
  cancelled = false;
  try {
    const [mb, { GIFEncoder, quantize, applyPalette }] = await Promise.all([lib(), import('gifenc')]);
    const input = new mb.Input({ source: new mb.BlobSource(file.value), formats: mb.ALL_FORMATS });
    const vt = await input.getPrimaryVideoTrack();
    if (!vt) throw new Error('no video');
    const { w, h } = dims.value;
    const sink = new mb.CanvasSink(vt, { width: w, height: h, fit: 'contain' });
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const gif = GIFEncoder();
    const { times, delay } = planOk.value;
    let i = 0;
    for await (const wc of sink.canvasesAtTimestamps(times)) {
      if (cancelled) throw new Error('canceled');
      if (wc) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); ctx.drawImage(wc.canvas as CanvasImageSource, 0, 0, w, h); }
      const { data } = ctx.getImageData(0, 0, w, h);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), w, h, { palette, delay });
      i++;
      progress.value = i / times.length;
      if (i % 5 === 0) await new Promise((r) => setTimeout(r)); // 화면이 멈추지 않게 잠깐 양보
    }
    gif.finish();
    input.dispose?.();
    const blob = new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
    out.value = { url: URL.createObjectURL(blob), blob, w, h, frames: times.length };
  } catch (e) {
    if (!cancelled) error.value = 'GIF를 만드는 중 문제가 생겼어요. 구간을 줄이거나 크기를 작게 해서 다시 시도해 주세요.';
  } finally {
    busy.value = '';
  }
}
function cancel() { cancelled = true; }
onBeforeUnmount(() => { cancelled = true; clearOut(); });
</script>

<template>
  <p v-if="!supported" class="notice">이 브라우저는 동영상 읽기 기능을 지원하지 않아요. 크롬·엣지·사파리 최신 버전에서 열어 주세요.</p>

  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; setFile($event.dataTransfer?.files)">
    <input type="file" accept="video/*,.mov,.mkv" @change="setFile(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>{{ file ? file.name : '동영상을 끌어다 놓거나 눌러서 고르세요' }}</strong><br />
    <small class="muted" v-if="file && meta">{{ formatBytes(file.size) }} · {{ meta.w }}×{{ meta.h }} · {{ fmtTime(meta.duration) }}</small>
    <small class="muted" v-else>{{ busy === 'read' ? '영상 정보를 읽는 중…' : 'MP4 · MOV · WEBM 등, 최대 2GB · 서버로 올라가지 않아요' }}</small>
  </label>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <template v-if="file && meta">
    <div class="row" style="margin-top: 16px">
      <div class="field"><label for="gf-s">시작</label><input id="gf-s" v-model="startText" type="text" inputmode="decimal" placeholder="0:00" /></div>
      <div class="field"><label for="gf-e">끝 <small class="muted">(최대 {{ MAX_SECONDS }}초)</small></label><input id="gf-e" v-model="endText" type="text" inputmode="decimal" placeholder="0:05" /></div>
    </div>
    <div class="row" style="margin-top: 12px">
      <div class="field">
        <label>가로 크기</label>
        <div class="chips" style="margin-top: 0"><button v-for="x in WIDTHS" :key="x" type="button" class="chip" :class="{ on: width === x }" @click="width = x">{{ x }}px</button></div>
      </div>
      <div class="field">
        <label>초당 프레임</label>
        <div class="chips" style="margin-top: 0"><button v-for="x in FPS" :key="x" type="button" class="chip" :class="{ on: fps === x }" @click="fps = x">{{ x }}{{ x === 10 ? ' (가볍게)' : x === 20 ? ' (부드럽게)' : '' }}</button></div>
      </div>
    </div>
    <p v-if="planErr" class="error" role="alert">{{ planErr }}</p>
    <p v-else-if="planOk && dims" class="muted" style="margin: 8px 0 0">{{ dims.w }}×{{ dims.h }} · {{ planOk.times.length }}장 · 예상 약 {{ formatBytes(estimate) }} (장면에 따라 달라요)</p>

    <template v-if="busy === 'run'">
      <div class="progress" style="height: 8px"><div :style="{ width: progress * 100 + '%' }"></div></div>
      <p class="muted" style="margin: 6px 0 0">GIF 만드는 중… {{ Math.round(progress * 100) }}%</p>
      <button type="button" class="btn-sub" style="margin-top: 10px" @click="cancel">취소</button>
    </template>
    <button v-else class="btn" type="button" :disabled="!!busy || !supported || !planOk" @click="run">GIF 만들기</button>
  </template>

  <div v-if="out && file" class="result" aria-live="polite">
    <div class="sub">{{ out.w }}×{{ out.h }} · {{ out.frames }}장</div>
    <div class="big">{{ formatBytes(out.blob.size) }}</div>
    <img :src="out.url" alt="만든 GIF 미리보기" style="display: block; max-width: 100%; margin: 10px auto 0; border-radius: 8px" />
    <p v-if="out.blob.size > 10 * 1024 * 1024" class="muted" style="margin: 8px 0 0">10MB가 넘어서 메신저에 올라가지 않을 수 있어요. 크기나 초당 프레임을 낮춰 보세요.</p>
    <a class="btn" :href="out.url" :download="gifOutName(file.name)" style="text-align: center; text-decoration: none">GIF 다운로드</a>
  </div>
</template>
