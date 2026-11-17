<script setup lang="ts">
// 동영상 용량 줄이기 UI. 설정 계산은 src/lib/videoCompress.js, 인코딩은 브라우저 WebCodecs + mediabunny(동적 import).
// 영상은 서버로 보내지 않는다. 처리 속도는 기기 성능에 따라 다르다.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { RES_PRESETS, SIZE_PRESETS_MB, scaleDims, bitrateForTarget, retryBitrate, fmtDuration, videoOutName } from '../../lib/videoCompress.js';
import { formatBytes } from '../../lib/compress.js';
import { filterFiles } from '../../lib/files.js';

const MAX = 2 * 1024 * 1024 * 1024; // 2GB

const supported = ref(true);
const file = ref<File | null>(null);
const meta = ref<{ w: number; h: number; duration: number; audio: boolean } | null>(null);
const mode = ref<'quality' | 'target'>('quality');
const quality = ref<'high' | 'medium' | 'low'>('medium');
const targetMB = ref<number | ''>(25);
const res = ref('original');
const keepAudio = ref(true);
const busy = ref<'' | 'read' | 'run'>('');
const progress = ref(0);
const error = ref('');
const over = ref(false);
const out = ref<{ url: string; blob: Blob; w: number; h: number } | null>(null);
const retrying = ref(false); // 목표 용량을 넘겨서 다시 줄이는 중
const overTarget = ref(false);
let conversion: any = null;

onMounted(() => { supported.value = typeof (window as any).VideoEncoder !== 'undefined' && typeof (window as any).VideoDecoder !== 'undefined'; });

const lib = () => import('mediabunny');
const dims = computed(() => (meta.value ? scaleDims(meta.value.w, meta.value.h, RES_PRESETS.find((r) => r.id === res.value)!.short) : null));
const plan = computed(() => (meta.value && mode.value === 'target' ? bitrateForTarget(Number(targetMB.value) * 1024 * 1024, meta.value.duration, { keepAudio: keepAudio.value && meta.value.audio }) : null));
const planError = computed(() => (plan.value && 'error' in plan.value ? plan.value.error : ''));

function clearOut() {
  if (out.value) URL.revokeObjectURL(out.value.url);
  out.value = null;
}

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
    if (!vt) throw new Error('no video');
    const duration = await input.computeDuration();
    const audio = !!(await input.getPrimaryAudioTrack());
    meta.value = { w: vt.displayWidth, h: vt.displayHeight, duration, audio };
    file.value = f;
    input.dispose?.();
  } catch {
    file.value = null; meta.value = null;
    error.value = '이 동영상을 열 수 없어요. MP4·MOV 파일인지 확인하거나, 다른 브라우저(크롬·엣지·사파리 최신 버전)로 시도해 주세요.';
  } finally {
    busy.value = '';
  }
}

async function run() {
  if (!file.value || !meta.value || !dims.value) return;
  if (planError.value) { error.value = planError.value; return; }
  error.value = '';
  clearOut();
  busy.value = 'run';
  progress.value = 0;
  retrying.value = false;
  overTarget.value = false;
  try {
    const mb = await lib();
    const input = new mb.Input({ source: new mb.BlobSource(file.value), formats: mb.ALL_FORMATS });
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
    const { w, h } = dims.value;
    const vCodec = await mb.getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9', 'av1'], { width: w, height: h });
    if (!vCodec) throw new Error('no encoder');
    const aCodec = keepAudio.value && meta.value.audio ? await mb.getFirstEncodableAudioCodec(['aac', 'opus']) : null;
    const q = { high: mb.QUALITY_HIGH, medium: mb.QUALITY_MEDIUM, low: mb.QUALITY_LOW }[quality.value];
    const p = plan.value && !('error' in plan.value) ? plan.value : null;
    const targetBytes = p ? Number(targetMB.value) * 1024 * 1024 : 0;
    let videoBps: number | null = p ? p.videoBps : null;
    let blob: Blob | null = null;
    // 용량 모드: 인코더가 비트레이트를 정확히 지키지 않을 수 있어서, 넘치면 비율만큼 낮춰 최대 2번 다시 한다
    for (let attempt = 0; attempt < 3; attempt++) {
      const input = new mb.Input({ source: new mb.BlobSource(file.value), formats: mb.ALL_FORMATS });
      const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
      conversion = await mb.Conversion.init({
        input, output,
        video: { width: w, height: h, fit: 'contain', codec: vCodec, bitrate: videoBps ?? q, forceTranscode: true },
        audio: aCodec ? { codec: aCodec, bitrate: p ? p.audioBps || 128_000 : 128_000 } : { discard: true },
      });
      // 영상 트랙이 버려지면 소리만 남은 파일이 되므로 실패로 처리한다
      if (!conversion.isValid || conversion.discardedTracks.some((d: any) => d.track?.type === 'video')) throw new Error('undecodable');
      conversion.onProgress = (v: number) => (progress.value = (attempt + v) / (attempt + 1));
      await conversion.execute();
      blob = new Blob([(output.target as any).buffer as ArrayBuffer], { type: 'video/mp4' });
      if (!videoBps) break;
      const next = retryBitrate(videoBps, blob.size, targetBytes);
      if (next === null) break;
      videoBps = next;
      retrying.value = true;
    }
    out.value = { url: URL.createObjectURL(blob!), blob: blob!, w, h };
    overTarget.value = !!targetBytes && blob!.size > targetBytes;
  } catch (e) {
    if ((e as Error)?.name !== 'ConversionCanceledError' && conversion?.state !== 'canceled') {
      const m = String((e as Error)?.message);
      error.value = /undecodable/.test(m)
        ? '이 영상의 압축 방식은 지금 브라우저에서 읽을 수 없어요. 다른 브라우저(크롬·엣지·사파리 최신 버전)로 시도해 주세요.'
        : /no encoder/.test(m)
        ? '이 브라우저는 동영상 변환을 지원하지 않아요. 크롬·엣지·사파리 최신 버전에서 시도해 주세요.'
        : '변환 중 문제가 생겼어요. 해상도를 낮추거나 다른 브라우저로 시도해 주세요.';
    }
  } finally {
    conversion = null;
    busy.value = '';
  }
}
async function cancel() { await conversion?.cancel?.(); }
const pct = computed(() => (out.value && file.value ? Math.round((1 - out.value.blob.size / file.value.size) * 100) : 0));
onBeforeUnmount(() => { conversion?.cancel?.(); clearOut(); });
</script>

<template>
  <p v-if="!supported" class="notice">이 브라우저는 동영상 변환 기능을 지원하지 않아요. 크롬·엣지·사파리 최신 버전에서 열어 주세요.</p>

  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; setFile($event.dataTransfer?.files)">
    <input type="file" accept="video/*,.mov,.mkv" @change="setFile(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>{{ file ? file.name : '동영상을 끌어다 놓거나 눌러서 고르세요' }}</strong><br />
    <small class="muted" v-if="file && meta">{{ formatBytes(file.size) }} · {{ meta.w }}×{{ meta.h }} · {{ fmtDuration(meta.duration) }}</small>
    <small class="muted" v-else>{{ busy === 'read' ? '영상 정보를 읽는 중…' : 'MP4 · MOV 등, 최대 2GB · 서버로 올라가지 않아요' }}</small>
  </label>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <template v-if="file && meta">
    <div class="tabs" role="tablist" style="margin-top: 16px">
      <button type="button" role="tab" :aria-selected="mode === 'quality'" @click="mode = 'quality'">화질로 정하기</button>
      <button type="button" role="tab" :aria-selected="mode === 'target'" @click="mode = 'target'">용량으로 정하기</button>
    </div>
    <div v-if="mode === 'quality'" class="field">
      <label>화질</label>
      <div class="chips">
        <button v-for="[k, l] in [['high', '높음 (조금 줄이기)'], ['medium', '보통 (추천)'], ['low', '낮음 (많이 줄이기)']]" :key="k" type="button" class="chip" :class="{ on: quality === k }" @click="quality = k as any">{{ l }}</button>
      </div>
    </div>
    <div v-else class="field">
      <label for="tmb">목표 용량 (MB)</label>
      <input id="tmb" v-model.number="targetMB" type="number" min="1" step="1" inputmode="numeric" />
      <div class="chips"><button v-for="m in SIZE_PRESETS_MB" :key="m" type="button" class="chip" :class="{ on: targetMB === m }" @click="targetMB = m">{{ m }}MB 이하</button></div>
      <p v-if="planError" class="error" style="margin: 6px 0 0">{{ planError }}</p>
    </div>
    <div class="field" style="margin-top: 14px">
      <label>해상도</label>
      <div class="chips">
        <button v-for="r in RES_PRESETS" :key="r.id" type="button" class="chip" :class="{ on: res === r.id }" :disabled="!!r.short && Math.min(meta.w, meta.h) <= r.short" @click="res = r.id">{{ r.label }}</button>
      </div>
      <small class="muted">결과 크기 {{ dims?.w }}×{{ dims?.h }} · 해상도를 낮추면 용량이 크게 줄어요</small>
    </div>
    <label v-if="meta.audio" class="check"><input v-model="keepAudio" type="checkbox" /> 소리 유지 (끄면 소리 없는 영상이 돼요)</label>

    <template v-if="busy === 'run'">
      <div class="progress" style="height: 8px"><div :style="{ width: progress * 100 + '%' }"></div></div>
      <p class="muted" style="margin: 6px 0 0">{{ retrying ? '목표 용량에 맞추려고 한 번 더 줄이는 중…' : '줄이는 중…' }} {{ Math.round(progress * 100) }}% · 이 창을 닫지 마세요</p>
      <button type="button" class="btn-sub" style="margin-top: 10px" @click="cancel">취소</button>
    </template>
    <button v-else class="btn" type="button" :disabled="!!busy || !supported || !!planError" @click="run">동영상 용량 줄이기</button>
  </template>

  <div v-if="out && file" class="result" aria-live="polite">
    <div class="sub">{{ formatBytes(file.size) }} → </div>
    <div class="big">{{ formatBytes(out.blob.size) }}</div>
    <p class="sub" style="margin: 6px 0 12px">
      <template v-if="pct > 0">{{ pct }}% 줄었어요</template>
      <template v-else>원본보다 작아지지 않았어요. 화질을 낮추거나 해상도를 줄여 보세요.</template>
      · {{ out.w }}×{{ out.h }}
    </p>
    <p v-if="overTarget" class="error" style="margin: 0 0 10px">목표 용량보다 조금 커요. 해상도를 낮추거나 목표 용량을 줄여서 다시 시도해 보세요.</p>
    <video :src="out.url" controls playsinline style="width: 100%; max-height: 420px; border-radius: 8px; background: #000"></video>
    <a class="btn" :href="out.url" :download="videoOutName(file.name)" style="text-align: center; text-decoration: none">MP4 다운로드</a>
  </div>
</template>
