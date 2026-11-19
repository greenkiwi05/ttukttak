<script setup lang="ts">
// 24절기 달력 UI. 로직은 src/lib/solarTerms.js, 데이터는 /api/solar-terms (한국천문연구원 특일 정보)
import { ref, computed, onMounted } from 'vue';
import { loadTerms, termsOfYear, years, around, bySeason, TERM_INFO, SEASONS, daysBetween } from '../../lib/solarTerms.js';

type Term = { date: string; name: string; time?: string; longitude?: number };
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const terms = ref<Term[]>([]);
const state = ref<'loading' | 'ok' | 'fail'>('loading');
const year = ref(Number(today.slice(0, 4)));

onMounted(async () => {
  const d = await loadTerms();
  if (!d) { state.value = 'fail'; return; }
  terms.value = d;
  const q = Number(new URLSearchParams(location.search).get('year'));
  if (q && years(d).includes(q)) year.value = q;
  state.value = 'ok';
});

const ys = computed(() => years(terms.value));
const list = computed(() => termsOfYear(terms.value, year.value));
const seasons = computed(() => bySeason(list.value));
const now = computed(() => around(terms.value, today));
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일(${WEEK[new Date(Date.parse(d + 'T00:00:00Z')).getUTCDay()]})`;
const dday = (d: string) => { const n = daysBetween(today, d); return n === 0 ? '오늘' : n > 0 ? `D-${n}` : ''; };
const go = (n: number) => { const y = year.value + n; if (ys.value.includes(y)) year.value = y; };
const SEASON_EMOJI: Record<string, string> = { 봄: '🌱', 여름: '☀️', 가을: '🍂', 겨울: '❄️' };
</script>

<template>
  <p v-if="state === 'loading'" class="muted">24절기를 불러오는 중이에요…</p>
  <p v-else-if="state === 'fail'" class="notice">지금은 24절기 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
  <template v-else>
    <div v-if="now.cur || now.next" class="result" aria-live="polite">
      <div v-if="now.cur" class="sub">지금은 <b>{{ now.cur.name }}</b> ({{ md(now.cur.date) }}부터) · {{ TERM_INFO[now.cur.name as keyof typeof TERM_INFO]?.[1] }}</div>
      <div v-if="now.next" class="big">다음 절기 {{ now.next.name }} · {{ now.dday === 0 ? '오늘' : `D-${now.dday}` }}</div>
      <p v-if="now.next" class="sub" style="margin: 4px 0 0">{{ md(now.next.date) }}<template v-if="now.next.time"> {{ now.next.time }}</template> · {{ TERM_INFO[now.next.name as keyof typeof TERM_INFO]?.[1] }}</p>
    </div>

    <div class="year-nav">
      <button type="button" class="btn-sub" :disabled="!ys.includes(year - 1)" aria-label="이전 해" @click="go(-1)">◀</button>
      <b>{{ year }}년 24절기</b>
      <button type="button" class="btn-sub" :disabled="!ys.includes(year + 1)" aria-label="다음 해" @click="go(1)">▶</button>
    </div>

    <p v-if="!list.length" class="notice">{{ year }}년 절기 정보가 아직 없어요.</p>
    <div v-else class="season-grid">
      <section v-for="s in SEASONS" :key="s" class="season">
        <h3>{{ SEASON_EMOJI[s] }} {{ s }}</h3>
        <ul>
          <li v-for="t in seasons[s]" :key="t.date" :class="{ past: t.date < today, cur: now.cur?.date === t.date }">
            <div class="top"><b>{{ t.name }}</b><span class="when">{{ md(t.date) }}<template v-if="t.time"> {{ t.time }}</template></span></div>
            <small class="muted">{{ TERM_INFO[t.name as keyof typeof TERM_INFO]?.[1] }}<template v-if="dday(t.date)"> · {{ dday(t.date) }}</template></small>
          </li>
        </ul>
      </section>
    </div>
    <p class="muted" style="margin: 10px 0 0">시각은 해가 그 절기의 위치(황경)에 이르는 절입 시각(한국시간)이에요. 1월의 소한·대한은 겨울에 넣었어요.</p>
  </template>
</template>

<style scoped>
.year-nav { display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 1.1rem; margin: 18px 0 12px; }
.year-nav .btn-sub { margin-top: 0; padding: 8px 14px; }
.season-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.season { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; background: #fff; }
.season h3 { margin: 0 0 6px; font-size: 1rem; }
.season ul { list-style: none; margin: 0; padding: 0; }
.season li { padding: 7px 0; border-top: 1px solid var(--line); }
.season li:first-child { border-top: 0; }
.season li.past { opacity: .55; }
.season li.cur { opacity: 1; background: var(--accent-soft); border-radius: 8px; padding: 7px 8px; margin: 0 -8px; }
.top { display: flex; justify-content: space-between; gap: 8px; }
.when { font-size: .9rem; color: var(--text-soft); white-space: nowrap; }
</style>
