<script setup lang="ts">
// 도장 만들기 UI. 글자 배치는 src/lib/stamp.js, 그리기는 canvas(투명 PNG). 글꼴은 이 페이지에서만 불러온다.
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import '@fontsource/song-myung/400.css';
import '@fontsource/nanum-myeongjo/800.css';
import { layoutChars, stampChars, LAYOUTS } from '../../lib/stamp.js';
import { downloadBlob } from '../../lib/download.js';

const SIZE = 600;
const FONTS = [{ id: 'Song Myung', label: '붓글씨체', weight: 400 }, { id: 'Nanum Myeongjo', label: '명조체', weight: 800 }];
const COLORS = [{ v: '#d4291f', label: '인주 빨강' }, { v: '#a3131a', label: '진한 빨강' }, { v: '#1d1d1b', label: '검정' }, { v: '#1c4fa1', label: '파랑' }];

const name = ref('');
const addIn = ref(true);
const shape = ref<'circle' | 'square'>('circle');
const layout = ref<'auto' | 'row' | 'col' | 'grid'>('auto');
const font = ref(FONTS[0].id);
const color = ref(COLORS[0].v);
const border = ref(5);
const texture = ref(true);
const canvas = ref<HTMLCanvasElement | null>(null);

const prep = computed(() => stampChars(name.value, addIn.value));
const error = computed(() => (name.value.trim() && 'error' in prep.value ? prep.value.error : ''));
const chars = computed(() => ('chars' in prep.value ? prep.value.chars : []));

/** 이름으로 정해지는 난수 (같은 이름이면 같은 번짐 무늬) */
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 2 ** 32;
}

async function draw() {
  const c = canvas.value;
  if (!c) return;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, SIZE, SIZE);
  if (!chars.value.length) return;
  const f = FONTS.find((x) => x.id === font.value)!;
  try { await document.fonts.load(`${f.weight} 100px "${f.id}"`, chars.value.join('')); } catch { /* 글꼴 실패 시 기본 글꼴 */ }
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = ctx.strokeStyle = color.value;
  const bw = (border.value / 100) * SIZE * 0.4;
  ctx.lineWidth = bw;
  const m = bw / 2 + 6;
  ctx.beginPath();
  if (shape.value === 'circle') ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - m, 0, Math.PI * 2);
  else ctx.roundRect(m, m, SIZE - m * 2, SIZE - m * 2, SIZE * 0.05);
  ctx.stroke();
  const cells = layoutChars(chars.value, layout.value, shape.value === 'circle' ? 0.2 : 0.13);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const cell of cells) {
    const w = cell.w * SIZE, h = cell.h * SIZE, base = Math.min(w, h);
    const sx = Math.min(w / base, 1.45), sy = Math.min(h / base, 1.7);
    ctx.save();
    ctx.translate(cell.cx * SIZE, cell.cy * SIZE);
    ctx.scale(sx, sy);
    ctx.font = `${f.weight} ${Math.round(base * 0.92)}px "${f.id}", serif`;
    ctx.fillText(cell.ch, 0, base * 0.04);
    ctx.restore();
  }
  if (texture.value) {
    // 인주가 덜 묻은 듯한 번짐: 작은 점과 결을 지운다
    const r = rng(chars.value.join('') + shape.value);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 900; i++) {
      ctx.globalAlpha = 0.25 + r() * 0.6;
      ctx.beginPath();
      ctx.arc(r() * SIZE, r() * SIZE, 0.6 + r() * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 14; i++) {
      ctx.lineWidth = 1 + r() * 3;
      ctx.beginPath();
      const y = r() * SIZE;
      ctx.moveTo(0, y); ctx.lineTo(SIZE, y + (r() - 0.5) * 80);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
watch([chars, shape, layout, font, color, border, texture], () => nextTick(draw));
onMounted(draw);

function save() {
  canvas.value?.toBlob((b) => b && downloadBlob(b, `도장_${chars.value.join('')}.png`), 'image/png');
}
</script>

<template>
  <div class="field">
    <label for="sn">이름 (한글·한자 1~4자)</label>
    <input id="sn" v-model="name" type="text" maxlength="4" placeholder="예: 홍길동" autocomplete="off" />
  </div>
  <label class="check"><input v-model="addIn" type="checkbox" /> 끝에 '인' 넣기 (3글자 이하일 때)</label>
  <p v-if="error" class="error" role="alert">{{ error }}</p>

  <div class="stamp-wrap">
    <canvas ref="canvas" :width="SIZE" :height="SIZE" class="stamp-canvas" aria-label="도장 미리보기"></canvas>
    <div class="stamp-opts">
      <div class="field"><label>모양</label><div class="chips">
        <button type="button" class="chip" :class="{ on: shape === 'circle' }" @click="shape = 'circle'">원형</button>
        <button type="button" class="chip" :class="{ on: shape === 'square' }" @click="shape = 'square'">사각</button>
      </div></div>
      <div class="field"><label>글자 배치</label><div class="chips">
        <button v-for="(l, k) in LAYOUTS" :key="k" type="button" class="chip" :class="{ on: layout === k }" @click="layout = k">{{ l }}</button>
      </div></div>
      <div class="field"><label>글꼴</label><div class="chips">
        <button v-for="f in FONTS" :key="f.id" type="button" class="chip" :class="{ on: font === f.id }" :style="{ fontFamily: `'${f.id}', serif` }" @click="font = f.id">{{ f.label }}</button>
      </div></div>
      <div class="field"><label>색</label><div class="chips">
        <button v-for="c in COLORS" :key="c.v" type="button" class="chip" :class="{ on: color === c.v }" @click="color = c.v"><span :style="{ color: c.v }">●</span> {{ c.label }}</button>
      </div></div>
      <div class="field"><label for="bw">테두리 굵기</label><input id="bw" v-model.number="border" type="range" min="2" max="10" style="width: 100%" /></div>
      <label class="check"><input v-model="texture" type="checkbox" /> 찍은 듯한 번짐 효과</label>
    </div>
  </div>
  <button class="btn" type="button" :disabled="!chars.length" @click="save">투명 배경 PNG로 저장</button>
  <p class="notice">만든 도장 이미지는 전자 문서나 디자인에 쓰는 용도예요. 본인 이름으로만 만들고, 인감처럼 등록이 필요한 도장을 대신할 수는 없어요.</p>
</template>

<style scoped>
.stamp-wrap { display: grid; grid-template-columns: 260px 1fr; gap: 18px; margin-top: 14px; align-items: start; }
.stamp-canvas { width: 260px; height: 260px; border-radius: 12px; background: repeating-conic-gradient(#f3f2ee 0 25%, #fff 0 50%) 0 0 / 20px 20px; border: 1px solid var(--line); }
.stamp-opts .field + .field { margin-top: 10px; }
@media (max-width: 600px) { .stamp-wrap { grid-template-columns: 1fr; } .stamp-canvas { margin: 0 auto; } }
</style>
