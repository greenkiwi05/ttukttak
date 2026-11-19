<script setup lang="ts">
// 동영상 MP3 변환(소리 추출) UI. 계산은 src/lib/audioExtract.js, 변환은 브라우저 WebCodecs + mediabunny(동적 import).
// MP3 인코더는 @mediabunny/mp3-encoder(LAME, WASM)를 이 페이지에서만 불러온다. 파일은 서버로 보내지 않는다.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { FORMATS, BITRATES, INPUT_EXTS, trimRange, estimateBytes, audioOutName, fmtTime } from '../../lib/audioExtract.js';
import { formatBytes } from '../../lib/compress.js';
import { filterFiles } from '../../lib/files.js';

const MAX = 2 * 1024 * 1024 * 1024; // 2GB
const supported = ref(true);
const aacOk = ref(true);
const file = ref<File | null>(null);
const meta = ref<{ duration: number; sampleRate: number; channels: number; video: boolean } | null>(null);
const fmt = ref('mp3');
const kbps = ref(192);
const trimOn = ref(false);
const startText = ref('');
const endText = ref('');
const busy = ref<'' | 'read' | 'run'>('');
const progress = ref(0);
const error = ref('');
const over = ref(false);
const out = ref<{ url: string; blob: Blob; ext: string } | null>(null);
let conversion: any = null;

onMounted(async () => {
  supported.value = typeof (window as any).AudioDecoder !== 'undefined' && typeof WebAssembly !== 'undefined';
  if (!supported.value) return;
  try { const { canEncodeAudio } = await lib(); aacOk.value = await canEncodeAudio('aac'); } catch { aacOk.value = false; }
});

const lib = () => import('mediabunny');
let mp3Ready: Promise<void> | null = null;
const loadMp3 = () => (mp3Ready ??= import('@mediabunny/mp3-encoder').then((m) => m.registerMp3Encoder()));

const formats = computed(() => FORMATS.filter((f) => f.id !== 'm4a' || aacOk.value));
const cur = computed(() => FORMATS.find((f) => f.id === fmt.value)!);
const range = computed(() => (meta.value ? (trimOn.value ? trimRange(startText.value, endText.value, meta.value.duration) : trimRange('', '', meta.value.duration)) : null));
const rangeOk = computed(() => (range.value && !('error' in range.value) ? range.value : null));
const rangeErr = computed(() => (range.value && 'error' in range.value ? range.value.error : ''));
const estimate = computed(() => (meta.value && rangeOk.value ? estimateBytes({ format: fmt.value, kbps: kbps.value, seconds: rangeOk.value.length, sampleRate: meta.value.sampleRate, channels: Math.min(2, meta.value.channels) }) : 0));

function clearOut() {
  if (out.value) URL.revokeObjectURL(out.value.url);
  out.value = null;
}

async function setFile(list: FileList | null | undefined) {
  error.value = '';
  const f = list?.[0];
  if (!f) return;
  const r = filterFiles([f], { exts: INPUT_EXTS, maxSize: MAX, maxCount: 1 });
  if (!r.accepted.length) { error.value = r.rejected[0].reason.replace('2048MB', '2GB'); return; }
  clearOut();
  busy.value = 'read';
  try {
    const { Input, BlobSource, ALL_FORMATS } = await lib();
    const input = new Input({ source: new BlobSource(f), formats: ALL_FORMATS });
    const at = await input.getPrimaryAudioTrack();
    if (!at) throw new Error('no audio');
    meta.value = { duration: await input.computeDuration(), sampleRate: at.sampleRate, channels: at.numberOfChannels, video: !!(await input.getPrimaryVideoTrack()) };
    file.value = f;
    startText.value = ''; endText.value = '';
    input.dispose?.();
  } catch (e) {
    file.value = null; meta.value = null;
    error.value = /no audio/.test(String((e as Error)?.message))
      ? '이 파일에는 소리가 없어요.'
      : '이 파일을 열 수 없어요. MP4·MOV 등 동영상인지 확인하거나, 다른 브라우저(크롬·엣지·사파리 최신 버전)로 시도해 주세요.';
  } finally {
    busy.value = '';
  }
}

async function run() {
  if (!file.value || !meta.value || !rangeOk.value) return;
  error.value = '';
  clearOut();
  busy.value = 'run';
  progress.value = 0;
  try {
    const mb = await lib();
    if (fmt.value === 'mp3') await loadMp3();
    const input = new mb.Input({ source: new mb.BlobSource(file.value), formats: mb.ALL_FORMATS });
    const format = fmt.value === 'mp3' ? new mb.Mp3OutputFormat() : fmt.value === 'wav' ? new mb.WavOutputFormat() : new mb.Mp4OutputFormat({ fastStart: 'in-memory' });
    const output = new mb.Output({ format, target: new mb.BufferTarget() });
    const r = rangeOk.value;
    conversion = await mb.Conversion.init({
      input, output,
      video: { discard: true },
      audio: {
        codec: cur.value.codec as any,
        ...(fmt.value !== 'wav' ? { bitrate: kbps.value * 1000 } : {}),
        numberOfChannels: Math.min(2, meta.value.channels),
        forceTranscode: true,
      },
      ...(r.whole ? {} : { trim: { start: r.start, end: r.end } }),
    });
    if (!conversion.isValid || conversion.discardedTracks.some((d: any) => d.track?.type === 'audio')) throw new Error('undecodable');
    conversion.onProgress = (v: number) => (progress.value = v);
    await conversion.execute();
    const blob = new Blob([(output.target as any).buffer as ArrayBuffer], { type: cur.value.mime });
    out.value = { url: URL.createObjectURL(blob), blob, ext: cur.value.ext };
  } catch (e) {
    if ((e as Error)?.name !== 'ConversionCanceledError' && conversion?.state !== 'canceled') {
      error.value = /undecodable/.test(String((e as Error)?.message))
        ? '이 파일의 소리 형식은 지금 브라우저에서 읽을 수 없어요. 다른 브라우저(크롬·엣지·사파리 최신 버전)로 시도해 주세요.'
        : '변환 중 문제가 생겼어요. 다른 형식(WAV 등)을 고르거나 다른 브라우저로 시도해 주세요.';
    }
  } finally {
    conversion = null;
    busy.value = '';
  }
}
async function cancel() { await conversion?.cancel?.(); }
onBeforeUnmount(() => { conversion?.cancel?.(); clearOut(); });
</script>

<template>
  <p v-if="!supported" class="notice">이 브라우저는 소리 변환 기능을 지원하지 않아요. 크롬·엣지·사파리 최신 버전에서 열어 주세요.</p>

  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; setFile($event.dataTransfer?.files)">
    <input type="file" accept="video/*,audio/*,.mov,.mkv" @change="setFile(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>{{ file ? file.name : '동영상을 끌어다 놓거나 눌러서 고르세요' }}</strong><br />
    <small class="muted" v-if="file && meta">{{ formatBytes(file.size) }} · {{ fmtTime(meta.duration) }} · {{ meta.channels === 1 ? '모노' : '스테레오' }} {{ (meta.sampleRate / 1000).toFixed(1) }}kHz</small>
    <small class="muted" v-else>{{ busy === 'read' ? '파일 정보를 읽는 중…' : 'MP4 · MOV · WEBM 등 동영상이나 오디오, 최대 2GB · 서버로 올라가지 않아요' }}</small>
  </label>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <template v-if="file && meta">
    <div class="field" style="margin-top: 16px">
      <label>저장 형식</label>
      <div class="chips" style="margin-top: 0">
        <button v-for="f in formats" :key="f.id" type="button" class="chip" :class="{ on: fmt === f.id }" @click="fmt = f.id">{{ f.label }}</button>
      </div>
      <small class="muted">{{ cur.note }}</small>
    </div>
    <div v-if="fmt !== 'wav'" class="field" style="margin-top: 12px">
      <label>음질</label>
      <div class="chips" style="margin-top: 0">
        <button v-for="b in BITRATES" :key="b" type="button" class="chip" :class="{ on: kbps === b }" @click="kbps = b">{{ b }}kbps{{ b === 192 ? ' (추천)' : b === 320 ? ' (최고)' : '' }}</button>
      </div>
    </div>

    <label class="check"><input v-model="trimOn" type="checkbox" /> 원하는 구간만 자르기 (벨소리 만들기 등)</label>
    <div v-if="trimOn" class="row" style="margin-top: 8px">
      <div class="field"><label for="ae-s">시작</label><input id="ae-s" v-model="startText" type="text" inputmode="decimal" placeholder="0:00" /></div>
      <div class="field"><label for="ae-e">끝</label><input id="ae-e" v-model="endText" type="text" inputmode="decimal" :placeholder="fmtTime(meta.duration)" /></div>
    </div>
    <p v-if="rangeErr" class="error" role="alert">{{ rangeErr }}</p>
    <p v-else-if="rangeOk" class="muted" style="margin: 8px 0 0">{{ fmtTime(rangeOk.length) }} 길이 · 예상 용량 약 {{ formatBytes(estimate) }}</p>

    <template v-if="busy === 'run'">
      <div class="progress" style="height: 8px"><div :style="{ width: progress * 100 + '%' }"></div></div>
      <p class="muted" style="margin: 6px 0 0">{{ fmt === 'mp3' && progress === 0 ? 'MP3 변환기를 준비하는 중…' : '변환하는 중…' }} {{ Math.round(progress * 100) }}% · 이 창을 닫지 마세요</p>
      <button type="button" class="btn-sub" style="margin-top: 10px" @click="cancel">취소</button>
    </template>
    <button v-else class="btn" type="button" :disabled="!!busy || !supported || !rangeOk" @click="run">{{ cur.label.split(' ')[0] }}로 변환하기</button>
  </template>

  <div v-if="out && file" class="result" aria-live="polite">
    <div class="sub">{{ cur.label }} 변환 완료</div>
    <div class="big">{{ formatBytes(out.blob.size) }}</div>
    <audio :src="out.url" controls style="width: 100%; margin-top: 10px"></audio>
    <a class="btn" :href="out.url" :download="audioOutName(file.name, out.ext)" style="text-align: center; text-decoration: none">{{ out.ext.toUpperCase() }} 다운로드</a>
  </div>
</template>

<style scoped>
.check { display: inline-flex; gap: 6px; align-items: center; margin-top: 14px; font-weight: 500; }
</style>
