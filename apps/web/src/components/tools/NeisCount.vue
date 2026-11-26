<script setup lang="ts">
// 나이스(생활기록부) 바이트 계산 UI. 로직은 src/lib/neis.js. 항목별 제한은 해마다 바뀌어서 선생님이 직접 넣는다.
// 입력한 글은 저장하지도, 보내지도 않는다 (제한값만 이 기기에 기억).
import { ref, computed, watch, onMounted } from 'vue';
import { neisBytes, cutToBytes, bytesForHangul, hangulForBytes, unusualChars, tidy, enterCount } from '../../lib/neis.js';
import { countText } from '../../lib/charCount.js';

const KEY = 'ttukttak:neis';
const text = ref('');
const limitIn = ref<number | ''>('');
const unit = ref<'char' | 'byte'>('char'); // 제한을 한글 글자 수로 넣을지, 바이트로 넣을지
const loaded = ref(false);
const PRESETS = [300, 500, 700, 1000]; // 숫자만 (항목 이름과 짝짓지 않음)

onMounted(() => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s?.limit) limitIn.value = s.limit;
    if (s?.unit === 'byte' || s?.unit === 'char') unit.value = s.unit;
  } catch { /* 저장 불가 */ }
  loaded.value = true;
});
watch([limitIn, unit], () => { if (loaded.value) try { localStorage.setItem(KEY, JSON.stringify({ limit: limitIn.value, unit: unit.value })); } catch { /* 저장 불가 */ } });

const bytes = computed(() => neisBytes(text.value));
const c = computed(() => countText(text.value));
const enters = computed(() => enterCount(text.value));
const limit = computed(() => { const n = Number(limitIn.value); return n > 0 ? (unit.value === 'char' ? bytesForHangul(n) : Math.floor(n)) : 0; });
const over = computed(() => (limit.value ? bytes.value - limit.value : 0));
const pct = computed(() => (limit.value ? Math.min(100, (bytes.value / limit.value) * 100) : 0));
const odd = computed(() => unusualChars(text.value).slice(0, 8));
const fmt = (n: number) => n.toLocaleString('ko-KR');
function cut() { text.value = cutToBytes(text.value, limit.value); }
function clean() { text.value = tidy(text.value); }
</script>

<template>
  <div class="field">
    <label for="neis-txt">생활기록부에 넣을 글</label>
    <textarea id="neis-txt" v-model="text" rows="9" class="textarea" placeholder="한글 문서 등에서 쓴 글을 붙여 넣으세요."></textarea>
  </div>

  <div class="result" aria-live="polite">
    <div class="sub">나이스 기준 바이트</div>
    <div class="big" :class="{ bad: over > 0 }">{{ fmt(bytes) }}<small v-if="limit" class="of"> / {{ fmt(limit) }} 바이트</small><small v-else class="of"> 바이트</small></div>
    <template v-if="limit">
      <div class="progress" style="height: 8px; margin-top: 8px"><div :style="{ width: pct + '%', background: over > 0 ? '#c92a2a' : undefined }"></div></div>
      <p class="sub" style="margin: 6px 0 0">
        <b v-if="over > 0" class="bad">{{ fmt(over) }}바이트 초과</b>
        <template v-else>{{ fmt(-over) }}바이트 남음 (한글 약 {{ fmt(hangulForBytes(-over)) }}자)</template>
      </p>
      <button v-if="over > 0" type="button" class="btn-sub" style="margin-top: 10px" @click="cut">제한에 맞게 끝부분 자르기</button>
    </template>
  </div>

  <div class="stat-grid">
    <div class="stat"><small>글자 (공백 포함)</small><b>{{ fmt(c.chars) }}</b></div>
    <div class="stat"><small>글자 (공백 제외)</small><b>{{ fmt(c.charsNoSpace) }}</b></div>
    <div class="stat"><small>줄바꿈(엔터)</small><b>{{ fmt(enters) }}</b></div>
    <div class="stat"><small>한글로 치면</small><b>{{ fmt(hangulForBytes(bytes)) }}자</b></div>
  </div>

  <div class="field" style="margin-top: 16px">
    <label for="neis-limit">입력 제한 <small class="muted">(기재요령에서 확인한 값)</small></label>
    <div class="lim">
      <input id="neis-limit" v-model.number="limitIn" type="number" min="1" inputmode="numeric" :placeholder="unit === 'char' ? '예: 500' : '예: 1500'" />
      <div class="chips" style="margin-top: 0">
        <button type="button" class="chip" :class="{ on: unit === 'char' }" @click="unit = 'char'">한글 글자 수</button>
        <button type="button" class="chip" :class="{ on: unit === 'byte' }" @click="unit = 'byte'">바이트</button>
      </div>
    </div>
    <div class="chips">
      <button v-for="n in PRESETS" :key="n" type="button" class="chip" :class="{ on: unit === 'char' && limitIn === n }" @click="unit = 'char'; limitIn = n">{{ fmt(n) }}자 ({{ fmt(n * 3) }}B)</button>
    </div>
    <small class="muted">'500자'처럼 글자 수로 정해진 항목은 한글 기준이라 바이트로는 3배예요.</small>
  </div>

  <div v-if="odd.length" class="notice">
    한글·영문과 바이트 수가 다른 글자가 있어요:
    <span v-for="o in odd" :key="o.ch" class="odd">{{ o.ch }} <small>{{ o.bytes }}B×{{ o.count }}</small></span>
    <br /><small>가운뎃점(·)은 2바이트, 이모지는 4바이트로 세요. 나이스에서 입력되지 않는 글자가 있을 수 있으니 입력 화면에서 확인하세요.</small>
  </div>

  <div style="display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap">
    <button type="button" class="btn-sub" @click="clean">띄어쓰기·줄바꿈 정리</button>
    <button type="button" class="btn-sub" @click="text = ''">지우기</button>
  </div>
</template>

<style scoped>
.of { font-size: 1rem; font-weight: 600; color: var(--muted); }
.bad { color: #c92a2a; }
.lim { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.lim input { flex: 1 1 140px; min-width: 0; }
.odd { display: inline-block; margin: 2px 6px 2px 0; padding: 1px 8px; border-radius: 8px; background: #fff; border: 1px solid var(--line); }
</style>
