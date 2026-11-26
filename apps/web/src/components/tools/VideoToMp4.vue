<script setup lang="ts">
// 동영상 MP4 변환 UI. 무엇을 할지는 src/lib/videoMp4.js, 변환은 브라우저 WebCodecs + mediabunny(동적 import).
// 영상은 서버로 보내지 않는다. H.264·AAC는 다시 압축하지 않고 MP4로 옮겨 담기만 한다.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { planMp4, mp4Name, extOf, codecName, VIDEO_EXTS } from '../../lib/videoMp4.js';
import { fmtDuration } from '../../lib/videoCompress.js';
import { formatBytes } from '../../lib/compress.js';
import { filterFiles } from '../../lib/files.js';

const MAX = 2 * 1024 * 1024 * 1024; // 2GB

const supported = ref(true);
const file = ref<File | null>(null);
const meta = ref<{ w: number; h: number; duration: number; video: string | null; audio: string | null } | null>(null);
const keepHevc = ref(false);
const busy = ref<'' | 'read' | 'run'>('');
const progress = ref(0);
const error = ref('');
const over = ref(false);
const out = ref<{ url: string; blob: Blob; copied: boolean } | null>(null);
let conversion: any = null;

onMounted(() => { supported.value = typeof (window as any).VideoEncoder !== 'undefined' && typeof (window as any).VideoDecoder !== 'undefined'; });

const lib = () => import('mediabunny');
const plan = computed(() => (meta.value && file.value ? planMp4({ video: meta.value.video, audio: meta.value.audio, ext: extOf(file.value.name) }, { keepHevc: keepHevc.value }) : null));

function clearOut() {
  if (out.value) URL.revokeObjectURL(out.value.url);
  out.value = null;
}

async function setFile(list: FileList | null | undefined) {
  error.value = '';
  const f = list?.[0];
  if (!f) return;
  if (extOf(f.name) === 'avi') { error.value = 'AVI 파일은 아직 열 수 없어요. MOV·MKV·WEBM 같은 다른 형식으로 시도해 주세요.'; return; }
  const r = filterFiles([f], { exts: VIDEO_EXTS, maxSize: MAX, maxCount: 1 });
  if (!r.accepted.length) { error.value = r.rejected[0].reason.replace('2048MB', '2GB'); return; }
  clearOut();
  keepHevc.value = false;
  busy.value = 'read';
  try {
    const { Input, BlobSource, ALL_FORMATS } = await lib();
    const input = new Input({ source: new BlobSource(f), formats: ALL_FORMATS });
    const vt = await input.getPrimaryVideoTrack();
    if (!vt) throw new Error('no video');
    const at = await input.getPrimaryAudioTrack();
    const duration = await input.computeDuration();
    meta.value = { w: vt.displayWidth, h: vt.displayHeight, duration, video: vt.codec, audio: at ? at.codec ?? 'unknown' : null };
    file.value = f;
    input.dispose?.();
  } catch {
    file.value = null; meta.value = null;
    error.value = '이 동영상을 열 수 없어요. MOV·MP4·MKV·WEBM 파일인지 확인하거나, 다른 브라우저(크롬·엣지·사파리 최신 버전)로 시도해 주세요.';
  } finally {
    busy.value = '';
  }
}

async function run() {
  if (!file.value || !meta.value || !plan.value) return;
  if (plan.value.video === 'unsupported') { error.value = '이 영상의 압축 방식은 변환할 수 없어요.'; return; }
  error.value = '';
  clearOut();
  busy.value = 'run';
  progress.value = 0;
  const p = plan.value;
  try {
    const mb = await lib();
    const input = new mb.Input({ source: new mb.BlobSource(file.value), formats: mb.ALL_FORMATS });
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
    if (p.video === 'encode' && !(await mb.canEncodeVideo('avc', { width: meta.value.w, height: meta.value.h }))) throw new Error('no encoder');
    // 소리: AAC가 기본, 브라우저가 AAC를 못 만들면 Opus
    const aCodec = p.audio === 'encode' ? await mb.getFirstEncodableAudioCodec(['aac', 'opus']) : null;
    conversion = await mb.Conversion.init({
      input, output,
      // 같은 코덱이면 mediabunny가 다시 압축하지 않고 그대로 옮긴다
      video: p.video === 'copy' ? {} : { codec: 'avc', bitrate: mb.QUALITY_HIGH },
      audio: p.audio === 'none' ? { discard: true } : p.audio === 'copy' ? {} : aCodec ? { codec: aCodec, bitrate: 160_000 } : { discard: true },
    });
    if (!conversion.isValid || conversion.discardedTracks.some((d: any) => d.track?.type === 'video')) throw new Error('undecodable');
    conversion.onProgress = (v: number) => (progress.value = v);
    await conversion.execute();
    const blob = new Blob([(output.target as any).buffer as ArrayBuffer], { type: 'video/mp4' });
    out.value = { url: URL.createObjectURL(blob), blob, copied: p.video === 'copy' };
  } catch (e) {
    if ((e as Error)?.name !== 'ConversionCanceledError' && conversion?.state !== 'canceled') {
      const m = String((e as Error)?.message);
      error.value = /undecodable/.test(m)
        ? meta.value.video === 'hevc' && !keepHevc.value
          ? '이 브라우저는 HEVC 영상을 읽지 못해요. 아래 "다시 압축하지 않고 그대로 담기"를 켜고 다시 시도하거나, 다른 브라우저로 열어 주세요.'
          : '이 영상의 압축 방식은 지금 브라우저에서 읽을 수 없어요. 다른 브라우저(크롬·엣지·사파리 최신 버전)로 시도해 주세요.'
        : /no encoder/.test(m)
        ? '이 브라우저는 동영상 변환을 지원하지 않아요. 크롬·엣지·사파리 최신 버전에서 시도해 주세요.'
        : '변환 중 문제가 생겼어요. 다른 브라우저로 시도해 주세요.';
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
  <p v-if="!supported" class="notice">이 브라우저는 동영상 변환 기능을 지원하지 않아요. 크롬·엣지·사파리 최신 버전에서 열어 주세요.</p>

  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; setFile($event.dataTransfer?.files)">
    <input type="file" accept="video/*,.mov,.mkv,.webm,.ts,.mts,.m2ts" @change="setFile(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>{{ file ? file.name : '동영상을 끌어다 놓거나 눌러서 고르세요' }}</strong><br />
    <small class="muted" v-if="file && meta">{{ formatBytes(file.size) }} · {{ meta.w }}×{{ meta.h }} · {{ fmtDuration(meta.duration) }}</small>
    <small class="muted" v-else>{{ busy === 'read' ? '영상 정보를 읽는 중…' : 'MOV · MKV · WEBM 등, 최대 2GB · 서버로 올라가지 않아요' }}</small>
  </label>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <template v-if="file && meta && plan">
    <div class="stat-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr))">
      <div class="stat"><small>영상</small><b>{{ codecName(meta.video) }}</b></div>
      <div class="stat"><small>소리</small><b>{{ meta.audio === 'unknown' ? '알 수 없음' : codecName(meta.audio, 'audio') }}</b></div>
    </div>
    <p v-if="plan.already" class="notice">이미 어디서나 재생되는 MP4예요. 그래도 변환하면 다시 압축 없이 새 MP4로 저장돼요.</p>
    <p v-else-if="plan.fast" class="muted" style="margin: 10px 0 0">다시 압축하지 않고 MP4로 옮겨 담기만 해요. 몇 초면 끝나고 화질도 그대로예요.</p>
    <p v-else class="muted" style="margin: 10px 0 0">
      <template v-if="plan.video === 'encode'">어디서나 재생되는 H.264로 다시 만들어요. 영상 길이와 기기 성능에 따라 시간이 걸려요.</template>
      <template v-else>영상은 그대로 두고 소리만 AAC로 바꿔요.</template>
    </p>
    <label v-if="meta.video === 'hevc'" class="check">
      <input v-model="keepHevc" type="checkbox" /> 다시 압축하지 않고 그대로 담기 (빠르지만 일부 윈도우 PC·오래된 기기에서는 재생 안 될 수 있어요)
    </label>

    <template v-if="busy === 'run'">
      <div class="progress" style="height: 8px"><div :style="{ width: progress * 100 + '%' }"></div></div>
      <p class="muted" style="margin: 6px 0 0">변환 중… {{ Math.round(progress * 100) }}% · 이 창을 닫지 마세요</p>
      <button type="button" class="btn-sub" style="margin-top: 10px" @click="cancel">취소</button>
    </template>
    <button v-else class="btn" type="button" :disabled="!!busy || !supported || plan.video === 'unsupported'" @click="run">MP4로 변환</button>
    <p v-if="plan.video === 'unsupported'" class="error">이 영상의 압축 방식({{ codecName(meta.video) }})은 변환할 수 없어요.</p>
  </template>

  <div v-if="out && file" class="result" aria-live="polite">
    <div class="sub">변환 완료 · {{ out.copied ? '영상 화질 그대로' : 'H.264로 다시 만듦' }}</div>
    <div class="big">{{ formatBytes(out.blob.size) }}</div>
    <p class="sub" style="margin: 6px 0 12px">{{ mp4Name(file.name) }}</p>
    <video :src="out.url" controls playsinline style="width: 100%; max-height: 420px; border-radius: 8px; background: #000"></video>
    <a class="btn" :href="out.url" :download="mp4Name(file.name)" style="text-align: center; text-decoration: none">MP4 다운로드</a>
  </div>
</template>
