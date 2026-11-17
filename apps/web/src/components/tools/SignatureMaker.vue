<script setup lang="ts">
// 사인 만들기 UI. 손글씨 글꼴로 이름을 그려 투명 PNG로 저장한다. 글꼴은 이 페이지에서만 불러온다.
import { ref, computed } from 'vue';
import '@fontsource/nanum-pen-script/400.css';
import '@fontsource/nanum-brush-script/400.css';
import '@fontsource/great-vibes/400.css';
import '@fontsource/dancing-script/700.css';
import { downloadBlob } from '../../lib/download.js';

const FONTS = [
  { id: 'Nanum Pen Script', label: '펜 손글씨', weight: 400, scale: 1.15 },
  { id: 'Nanum Brush Script', label: '붓 손글씨', weight: 400, scale: 1.15 },
  { id: 'Great Vibes', label: '영문 필기체', weight: 400, scale: 1 },
  { id: 'Dancing Script', label: '영문 흘림체', weight: 700, scale: 0.95 },
];
const COLORS = [{ v: '#1d1d1b', label: '검정' }, { v: '#1f3d8a', label: '파랑 잉크' }, { v: '#a3131a', label: '빨강' }];

const name = ref('');
const font = ref(FONTS[0].id);
const color = ref(COLORS[0].v);
const underline = ref(true);
const slant = ref(true);
const hasLatin = computed(() => /[A-Za-z]/.test(name.value));
const shown = computed(() => name.value.trim() || (hasLatin.value ? 'Signature' : '홍길동'));

async function save() {
  const f = FONTS.find((x) => x.id === font.value)!;
  const text = name.value.trim();
  if (!text) return;
  try { await document.fonts.load(`${f.weight} 120px "${f.id}"`, text); } catch { /* 기본 글꼴 */ }
  const size = Math.round(160 * f.scale);
  const fontCss = `${f.weight} ${size}px "${f.id}", cursive`;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = fontCss;
  const tw = probe.measureText(text).width;
  const W = Math.ceil(tw + size * 0.9), H = Math.ceil(size * 1.7);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = ctx.strokeStyle = color.value;
  ctx.font = fontCss;
  ctx.textBaseline = 'alphabetic';
  ctx.save();
  ctx.translate(size * 0.45, size * 1.05);
  if (slant.value) ctx.transform(1, 0, -0.14, 1, 0, 0);
  ctx.fillText(text, 0, 0);
  ctx.restore();
  if (underline.value) {
    // 끝을 살짝 들어 올린 밑줄 획
    ctx.lineWidth = Math.max(3, size * 0.03);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const y = size * 1.25;
    ctx.moveTo(size * 0.35, y);
    ctx.quadraticCurveTo(W * 0.55, y + size * 0.12, W - size * 0.25, y - size * 0.18);
    ctx.stroke();
  }
  c.toBlob((b) => b && downloadBlob(b, `사인_${text}.png`), 'image/png');
}
</script>

<template>
  <div class="field">
    <label for="sg">이름</label>
    <input id="sg" v-model="name" type="text" maxlength="20" placeholder="예: 홍길동 또는 Gildong Hong" autocomplete="off" />
  </div>

  <div class="field" style="margin-top: 14px">
    <label>글씨체 고르기</label>
    <div class="sig-grid">
      <button v-for="f in FONTS" :key="f.id" type="button" class="sig-card" :class="{ on: font === f.id }" @click="font = f.id">
        <span class="sig-sample" :style="{ fontFamily: `'${f.id}', cursive`, fontWeight: f.weight, color, fontStyle: slant ? 'italic' : 'normal' }">{{ shown }}</span>
        <small>{{ f.label }}</small>
      </button>
    </div>
    <p v-if="!hasLatin && name && (font === 'Great Vibes' || font === 'Dancing Script')" class="muted" style="margin: 6px 0 0">영문 글씨체는 한글을 지원하지 않아요. 한글 이름은 펜·붓 손글씨를 고르세요.</p>
  </div>
  <div class="field" style="margin-top: 14px"><label>색</label><div class="chips">
    <button v-for="c in COLORS" :key="c.v" type="button" class="chip" :class="{ on: color === c.v }" @click="color = c.v"><span :style="{ color: c.v }">●</span> {{ c.label }}</button>
  </div></div>
  <label class="check"><input v-model="underline" type="checkbox" /> 밑줄 획 넣기</label>
  <label class="check" style="margin-top: 6px"><input v-model="slant" type="checkbox" /> 살짝 기울이기</label>
  <button class="btn" type="button" :disabled="!name.trim()" @click="save">투명 배경 PNG로 저장</button>
  <p class="notice">전자 문서·이메일 서명이나 디자인에 쓰는 사인 이미지예요. 본인 이름으로만 만들어 주세요.</p>
</template>

<style scoped>
.sig-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.sig-card { border: 1.5px solid var(--line); border-radius: 12px; background: #fff; padding: 14px 10px 10px; cursor: pointer; text-align: center; min-width: 0; }
.sig-card.on { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.sig-sample { display: block; font-size: 2.6rem; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sig-card small { color: var(--muted); }
</style>
