<script setup lang="ts">
// 오늘 뭐 먹지 UI. 로직은 src/lib/menu.js, 난수는 crypto 기반(src/lib/ladder.js).
// 위치를 받지 않는다: "근처에서 찾기"는 네이버 지도·카카오맵 검색으로 넘기고, 주변 검색은 지도 서비스가 한다.
import { ref, computed, onBeforeUnmount } from 'vue';
import { CUISINES, TAGS, filterMenus, pickMenu, mapLinks } from '../../lib/menu.js';
import { cryptoRand } from '../../lib/ladder.js';

type Menu = { name: string; cuisine: string; emoji: string; tags: string[] };
const cuisines = ref<string[]>([]);
const tags = ref<string[]>([]);
const exclude = ref<string[]>([]);
const result = ref<Menu | null>(null);
const rolling = ref(false);
const showList = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

const candidates = computed(() => filterMenus({ cuisines: cuisines.value, tags: tags.value, exclude: exclude.value }) as Menu[]);
const links = computed(() => (result.value ? mapLinks(result.value.name) : null));

function toggle(list: string[], v: string) {
  const i = list.indexOf(v);
  if (i >= 0) list.splice(i, 1); else list.push(v);
}

function roll() {
  const list = candidates.value;
  if (!list.length) return;
  const final = pickMenu(list, cryptoRand, result.value?.name ?? null) as Menu;
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || list.length < 2) { result.value = final; return; }
  // 잠깐 메뉴가 빠르게 바뀌다가 멈추는 연출 (결과는 이미 정해져 있음)
  rolling.value = true;
  let n = 0;
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    result.value = list[Math.floor(cryptoRand() * list.length)];
    if (++n >= 12) { clearInterval(timer!); timer = null; result.value = final; rolling.value = false; }
  }, 60);
}

function skip() {
  if (!result.value) return;
  exclude.value.push(result.value.name);
  roll();
}
function reset() { cuisines.value = []; tags.value = []; exclude.value = []; }
onBeforeUnmount(() => { if (timer) clearInterval(timer); });
</script>

<template>
  <div class="field">
    <label>음식 종류 <small class="muted">(여러 개 고를 수 있어요 · 안 고르면 전부)</small></label>
    <div class="chips">
      <button v-for="c in CUISINES" :key="c" type="button" class="chip" :class="{ on: cuisines.includes(c) }" :aria-pressed="cuisines.includes(c)" @click="toggle(cuisines, c)">{{ c }}</button>
    </div>
  </div>
  <div class="field">
    <label>상황·취향 <small class="muted">(고른 조건을 모두 만족하는 메뉴만)</small></label>
    <div class="chips">
      <button v-for="(label, key) in TAGS" :key="key" type="button" class="chip" :class="{ on: tags.includes(key) }" :aria-pressed="tags.includes(key)" @click="toggle(tags, key)">{{ label }}</button>
    </div>
  </div>

  <button type="button" class="btn" :disabled="!candidates.length || rolling" @click="roll">
    {{ result ? '다시 뽑기' : '메뉴 뽑기' }} <small style="font-weight: 500">(후보 {{ candidates.length }}개)</small>
  </button>
  <p v-if="!candidates.length" class="error" role="alert">조건에 맞는 메뉴가 없어요. 조건을 조금 줄여 보세요.</p>

  <div v-if="result" class="result menu-result" aria-live="polite">
    <div class="menu-emoji" aria-hidden="true">{{ result.emoji }}</div>
    <div class="big" :class="{ rolling }">{{ result.name }}</div>
    <div class="sub">{{ result.cuisine }}<template v-if="result.tags.length"> · {{ result.tags.map((t) => TAGS[t as keyof typeof TAGS]).join(' · ') }}</template></div>
    <template v-if="!rolling && links">
      <p class="sub" style="margin: 14px 0 6px">근처에서 {{ result.name }} 식당 찾기</p>
      <div class="map-links">
        <a class="btn-sub" :href="links.naver" target="_blank" rel="noopener">네이버 지도</a>
        <a class="btn-sub" :href="links.kakao" target="_blank" rel="noopener">카카오맵</a>
      </div>
      <button type="button" class="link-btn" @click="skip">이 메뉴는 빼고 다시 뽑기</button>
    </template>
  </div>

  <div v-if="exclude.length" class="field">
    <label>뺀 메뉴 <small class="muted">(누르면 다시 넣어요)</small></label>
    <div class="chips">
      <button v-for="(n, i) in exclude" :key="n" type="button" class="chip" @click="exclude.splice(i, 1)">{{ n }} ✕</button>
    </div>
  </div>

  <div class="foot">
    <button type="button" class="link-btn" @click="showList = !showList">{{ showList ? '후보 목록 닫기' : `후보 ${candidates.length}개 보기` }}</button>
    <button v-if="cuisines.length || tags.length || exclude.length" type="button" class="link-btn" @click="reset">조건 초기화</button>
  </div>
  <div v-if="showList" class="chips">
    <span v-for="m in candidates" :key="m.name" class="chip static">{{ m.emoji }} {{ m.name }}</span>
  </div>
</template>

<style scoped>
.field + .field, .btn + .error { margin-top: 14px; }
.menu-result { text-align: center; }
.menu-emoji { font-size: 3rem; line-height: 1.2; }
.menu-result .big { font-size: 2.2rem; }
.rolling { opacity: .55; }
.map-links { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
.map-links a { flex: 1 1 140px; max-width: 220px; text-align: center; font-weight: 700; }
.link-btn { margin-top: 12px; border: 0; background: none; color: var(--muted); text-decoration: underline; cursor: pointer; font-size: .92rem; padding: 6px 4px; }
.link-btn:hover { color: var(--text); }
.foot { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 10px; }
.chip.static { cursor: default; }
</style>
