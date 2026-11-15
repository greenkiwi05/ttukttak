<script setup lang="ts">
// 증명사진 규격 맞추기 UI. 크롭 계산은 src/lib/idPhoto.js, 그리기는 canvas. 사진은 서버로 보내지 않는다.
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue';
import { PRESETS, cmToPx, cropRect, panCenter, isUpscaled } from '../../lib/idPhoto.js';
import { downloadBlob } from '../../lib/download.js';

const VIEW_W = 240; // 미리보기 너비(px)

const presetId = ref(PRESETS[0].id);
const customW = ref(3);
const customH = ref(4);
const zoom = ref(1);
const center = ref({ cx: 0, cy: 0 });
const error = ref('');
const over = ref(false);
const fileName = ref('');
const img = ref<ImageBitmap | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

const size = computed(() => {
  if (presetId.value === 'custom') return { w: cmToPx(Number(customW.value) || 3), h: cmToPx(Number(customH.value) || 4), wCm: customW.value, hCm: customH.value };
  const p = PRESETS.find((x) => x.id === presetId.value)!;
  return { w: p.w, h: p.h, wCm: p.wCm, hCm: p.hCm };
});
const aspect = computed(() => size.value.w / size.value.h);
const viewH = computed(() => Math.round(VIEW_W / aspect.value));
const rect = computed(() =>
  img.value ? cropRect({ imgW: img.value.width, imgH: img.value.height, aspect: aspect.value, zoom: zoom.value, cx: center.value.cx, cy: center.value.cy }) : null,
);
const upscaled = computed(() => (rect.value ? isUpscaled(rect.value, size.value.w) : false));

async function setFile(f: File | undefined) {
  error.value = '';
  if (!f) return;
  if (!f.type.startsWith('image/')) { error.value = 'JPG, PNG 같은 이미지 파일을 골라 주세요. 아이폰 HEIC는 먼저 JPG로 바꿔 주세요.'; return; }
  try {
    img.value?.close();
    img.value = await createImageBitmap(f);
    fileName.value = f.name;
    zoom.value = 1;
    center.value = { cx: img.value.width / 2, cy: img.value.height / 2 };
  } catch {
    error.value = '이미지를 열 수 없어요. 다른 파일로 시도해 주세요.';
  }
}

function draw() {
  const c = canvas.value, r = rect.value, b = img.value;
  if (!c || !r || !b) return;
  const dpr = window.devicePixelRatio || 1;
  c.width = VIEW_W * dpr;
  c.height = viewH.value * dpr;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(b, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  // 얼굴 위치 가이드(타원)
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.setLineDash([6 * dpr, 4 * dpr]);
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  ctx.ellipse(c.width / 2, c.height * 0.42, c.width * 0.3, c.height * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();
}
watch([rect, viewH], () => nextTick(draw));

// 드래그로 위치 옮기기 (마우스·터치 공통)
let last: { x: number; y: number } | null = null;
function down(e: PointerEvent) {
  last = { x: e.clientX, y: e.clientY };
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  if (!last || !rect.value) return;
  const p = panCenter(rect.value, VIEW_W, e.clientX - last.x, e.clientY - last.y);
  last = { x: e.clientX, y: e.clientY };
  center.value = p;
}
function up() { last = null; }
function wheel(e: WheelEvent) {
  zoom.value = Math.min(4, Math.max(1, zoom.value - e.deltaY * 0.002));
}

function save() {
  const r = rect.value, b = img.value;
  if (!r || !b) return;
  const c = document.createElement('canvas');
  c.width = size.value.w;
  c.height = size.value.h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(b, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  const base = fileName.value.replace(/\.[^.]+$/, '');
  c.toBlob((blob) => blob && downloadBlob(blob, `${base}_${size.value.wCm}x${size.value.hCm}cm.jpg`), 'image/jpeg', 0.95);
}

onBeforeUnmount(() => img.value?.close());
</script>

<template>
  <div class="field">
    <label>규격</label>
    <div class="chips">
      <button v-for="p in PRESETS" :key="p.id" type="button" class="chip" :class="{ on: presetId === p.id }" @click="presetId = p.id">{{ p.label }} {{ p.wCm }}×{{ p.hCm }}cm</button>
      <button type="button" class="chip" :class="{ on: presetId === 'custom' }" @click="presetId = 'custom'">직접 입력</button>
    </div>
  </div>
  <div v-if="presetId === 'custom'" class="row" style="margin-top: 12px">
    <div class="field"><label for="cw">가로 (cm)</label><input id="cw" v-model.number="customW" type="number" min="1" max="20" step="0.1" /></div>
    <div class="field"><label for="ch">세로 (cm)</label><input id="ch" v-model.number="customH" type="number" min="1" max="20" step="0.1" /></div>
  </div>

  <label class="drop" :class="{ over }" style="margin-top: 16px" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; setFile($event.dataTransfer?.files?.[0])">
    <input type="file" accept="image/*" @change="setFile(($event.target as HTMLInputElement).files?.[0])" />
    <strong>{{ fileName || '사진을 끌어다 놓거나 눌러서 고르세요' }}</strong><br />
    <small class="muted">정면을 보고 찍은 사진 · 서버로 올라가지 않아요</small>
  </label>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <template v-if="img">
    <div style="display: flex; flex-direction: column; align-items: center; margin-top: 16px">
      <canvas
        ref="canvas"
        :style="{ width: VIEW_W + 'px', height: viewH + 'px', touchAction: 'none', cursor: 'grab', borderRadius: '6px', boxShadow: '0 0 0 1px var(--line)' }"
        aria-label="크롭 미리보기. 끌어서 위치를 옮기세요"
        @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @wheel.prevent="wheel"
      ></canvas>
      <small class="muted" style="margin-top: 6px">사진을 끌어서 위치를, 아래 막대로 크기를 맞추세요. 점선 안에 얼굴을 맞추면 돼요.</small>
    </div>
    <div class="field" style="margin-top: 12px">
      <label for="zoom">확대 {{ zoom.toFixed(1) }}배</label>
      <input id="zoom" v-model.number="zoom" type="range" min="1" max="4" step="0.05" style="width: 100%" />
    </div>
    <p v-if="upscaled" class="error">원본 해상도가 낮아서 저장하면 흐릿할 수 있어요. 확대를 줄이거나 더 큰 사진을 써 보세요.</p>
    <button class="btn" type="button" @click="save">{{ size.w }}×{{ size.h }}px JPG 저장 (300dpi)</button>
  </template>
</template>
