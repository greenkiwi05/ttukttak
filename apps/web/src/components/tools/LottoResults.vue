<script setup lang="ts">
// 로또 당첨번호 조회 UI. 로직은 src/lib/lottoStats.js, 데이터는 /api/lotto · /api/lotto/round (동행복권 회차별 결과)
// 내 번호 맞춰보기는 브라우저에서만 계산한다 (입력한 번호는 서버로 보내지 않음).
import { ref, computed, watch, onMounted } from 'vue';
import LottoBall from '../LottoBall.vue';
import { loadLotto, loadRound, rankOf, checkAll, parsePicks, wonKo } from '../../lib/lottoStats.js';

type Round = { round: number; date: string; nums: number[]; bonus: number };
type Detail = Round & { sales: number | null; prizes: { rank: number; count: number | null; amount: number | null }[] };

const rounds = ref<Round[]>([]);
const latest = ref<Detail | null>(null);
const state = ref<'loading' | 'ok' | 'fail'>('loading');
const sel = ref(0);
const detail = ref<Detail | null>(null);
const detailLoading = ref(false);

const cur = computed(() => rounds.value.find((r) => r.round === sel.value) ?? null);
const maxRound = computed(() => rounds.value[rounds.value.length - 1]?.round ?? 0);
const desc = computed(() => [...rounds.value].reverse());
const dateKo = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return `${y}년 ${m}월 ${dd}일`; };

onMounted(async () => {
  const d = await loadLotto();
  if (!d) { state.value = 'fail'; return; }
  rounds.value = d.rounds;
  latest.value = d.latest;
  const q = Number(new URLSearchParams(location.search).get('n'));
  sel.value = Number.isInteger(q) && d.rounds.some((r: Round) => r.round === q) ? q : d.rounds[d.rounds.length - 1].round;
  state.value = 'ok';
});

let seq = 0;
watch(sel, async (n) => {
  if (!n) return;
  if (latest.value?.round === n) { detail.value = latest.value; return; }
  const my = ++seq;
  detailLoading.value = true;
  const d = await loadRound(n);
  if (my !== seq) return;
  detail.value = d;
  detailLoading.value = false;
});
const go = (d: number) => { const n = sel.value + d; if (n >= 1 && n <= maxRound.value) sel.value = n; };

// 내 번호 맞춰보기
const pickText = ref('');
const picks = computed(() => (pickText.value.trim() ? parsePicks(pickText.value) : null));
const myNums = computed(() => (picks.value && 'nums' in picks.value ? picks.value.nums : null));
const myRank = computed(() => (myNums.value && cur.value ? rankOf(cur.value, myNums.value) : null));
const all = computed(() => (myNums.value ? checkAll(rounds.value, myNums.value) : null));
const hitSet = computed(() => new Set(cur.value?.nums ?? []));
</script>

<template>
  <p v-if="state === 'loading'" class="muted">당첨번호를 불러오는 중이에요…</p>
  <p v-else-if="state === 'fail'" class="notice">지금은 당첨번호를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
  <template v-else>
    <div class="round-nav">
      <button type="button" class="btn-sub" :disabled="sel <= 1" aria-label="이전 회차" @click="go(-1)">◀</button>
      <select v-model.number="sel" aria-label="회차 선택">
        <option v-for="r in desc" :key="r.round" :value="r.round">{{ r.round }}회 ({{ r.date }})</option>
      </select>
      <button type="button" class="btn-sub" :disabled="sel >= maxRound" aria-label="다음 회차" @click="go(1)">▶</button>
    </div>

    <div v-if="cur" class="result draw" aria-live="polite">
      <div class="sub"><b>{{ cur.round }}회</b> 당첨번호 · {{ dateKo(cur.date) }} 추첨</div>
      <div class="balls">
        <LottoBall v-for="n in cur.nums" :key="n" :n="n" />
        <span class="plus">+</span>
        <LottoBall :n="cur.bonus" />
      </div>
      <small class="muted">마지막 공은 보너스 번호예요.</small>
    </div>

    <h3 class="h3">등수별 당첨금</h3>
    <p v-if="detailLoading" class="muted">불러오는 중…</p>
    <div v-else-if="detail && detail.round === sel" class="table-wrap">
      <table class="table">
        <thead><tr><th>등수</th><th>맞힌 번호</th><th>당첨자 수</th><th>1인당 당첨금</th></tr></thead>
        <tbody>
          <tr v-for="p in detail.prizes" :key="p.rank">
            <td><b>{{ p.rank }}등</b></td>
            <td>{{ ['', '6개', '5개 + 보너스', '5개', '4개', '3개'][p.rank] }}</td>
            <td>{{ p.count === null ? '-' : p.count.toLocaleString('ko-KR') + '명' }}</td>
            <td>{{ wonKo(p.amount) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="detail && detail.round === sel && detail.sales" class="muted" style="margin: 6px 0 0">이 회차 총 판매액 {{ wonKo(detail.sales) }} · 당첨금은 세금을 떼기 전 금액이에요.</p>

    <h3 class="h3">내 번호 맞춰보기</h3>
    <div class="field">
      <label for="my">내 번호 6개 <small class="muted">(띄어쓰기나 쉼표로 구분)</small></label>
      <input id="my" v-model="pickText" type="text" inputmode="numeric" placeholder="예: 3 11 19 27 34 42" />
    </div>
    <p v-if="picks && 'error' in picks" class="error" role="alert">{{ picks.error }}</p>
    <template v-else-if="myNums && cur">
      <div class="result">
        <div class="balls">
          <span v-for="n in myNums" :key="n" :class="{ miss: !hitSet.has(n) }"><LottoBall :n="n" size="sm" /></span>
        </div>
        <div class="big" style="margin-top: 6px">{{ cur.round }}회: {{ myRank ? `${myRank}등` : '낙첨' }}</div>
        <p class="sub" style="margin: 4px 0 0">맞힌 번호는 색으로, 못 맞힌 번호는 흐리게 보여요.</p>
      </div>
      <div v-if="all" class="notice">
        1회부터 {{ maxRound }}회까지 이 번호였다면:
        <b v-for="k in [1, 2, 3, 4, 5]" :key="k" style="margin-left: 6px">{{ k }}등 {{ all.counts[k] }}번</b>
        <ul v-if="all.best.length" style="margin: 6px 0 0; padding-left: 18px">
          <li v-for="h in all.best.slice(0, 5)" :key="h.round"><a href="#" @click.prevent="sel = h.round">{{ h.round }}회</a> ({{ h.date }}) {{ h.rank }}등</li>
        </ul>
      </div>
    </template>
  </template>
</template>

<style scoped>
.round-nav { display: flex; gap: 8px; align-items: center; }
.round-nav select { flex: 1; min-width: 0; }
.round-nav .btn-sub { margin-top: 0; padding: 10px 14px; }
.draw { margin-top: 14px; }
.balls { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 8px 0 4px; }
.plus { color: var(--muted); font-weight: 700; padding: 0 2px; }
.miss { opacity: .3; }
.h3 { margin: 22px 0 6px; font-size: 1rem; }
</style>
