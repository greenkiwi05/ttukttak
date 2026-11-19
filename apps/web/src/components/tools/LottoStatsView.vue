<script setup lang="ts">
// 로또 번호 통계 UI. 로직은 src/lib/lottoStats.js, 데이터는 /api/lotto
// 막대그래프는 라이브러리 없이 SVG. 색은 공 색(번호 구간)과 같게 써서 번호를 알아보기 쉽게 한다.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import LottoBall from '../LottoBall.vue';
import { loadLotto, frequency, gaps, topBy, oddEven, bands, lastN } from '../../lib/lottoStats.js';
import { ballBand } from '../../lib/lotto.js';

type Round = { round: number; date: string; nums: number[]; bonus: number };
const COLORS = ['#fbc400', '#69c8f2', '#ff7272', '#aaaaaa', '#b0d840'];
const RANGES = [[10, '최근 10회'], [50, '최근 50회'], [100, '최근 100회'], [52 * 3, '최근 3년'], [0, '전체']] as const;

const all = ref<Round[]>([]);
const state = ref<'loading' | 'ok' | 'fail'>('loading');
const range = ref<number>(100);
const withBonus = ref(false);

onMounted(async () => {
  const d = await loadLotto();
  if (!d) { state.value = 'fail'; return; }
  all.value = d.rounds;
  state.value = 'ok';
});

const rs = computed(() => lastN(all.value, range.value));
const freq = computed(() => frequency(rs.value, { bonus: withBonus.value }));
const gap = computed(() => gaps(all.value));
const most = computed(() => topBy(freq.value, 6));
const least = computed(() => topBy(freq.value, 6, 'asc'));
const longest = computed(() => topBy(gap.value, 6));
const oe = computed(() => Object.entries(oddEven(rs.value)).sort((a, b) => b[1] - a[1]));
const bd = computed(() => bands(rs.value));
const span = computed(() => (rs.value.length ? `${rs.value[0].round}회 ~ ${rs.value[rs.value.length - 1].round}회` : ''));
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
const total = computed(() => freq.value.reduce((a, b) => a + b, 0));

// 막대그래프 (실제 너비에 맞춰 픽셀로 그림)
const box = ref<HTMLElement | null>(null);
const width = ref(640);
let ro: ResizeObserver | null = null;
// 그래프 상자는 데이터를 받은 뒤에 생기므로, 생기는 순간부터 너비를 잰다
watch(box, (el) => {
  ro?.disconnect();
  if (!el) return;
  width.value = el.clientWidth || 640;
  ro = new ResizeObserver(() => { if (box.value) width.value = box.value.clientWidth || 640; });
  ro.observe(el);
});
onBeforeUnmount(() => ro?.disconnect());
const H = 220, L = 34, R = 6, T = 10, B = 24;
const chart = computed(() => {
  const max = Math.max(1, ...freq.value.slice(1));
  const step = max <= 5 ? 1 : max <= 12 ? 2 : max <= 30 ? 5 : max <= 60 ? 10 : max <= 150 ? 25 : 50;
  const top = Math.ceil(max / step) * step;
  const w = width.value - L - R, h = H - T - B;
  const slot = w / 45, bw = Math.max(2, slot - 2);
  const bars = Array.from({ length: 45 }, (_, i) => {
    const n = i + 1, v = freq.value[n];
    const bh = (v / top) * h;
    return { n, v, x: L + i * slot + (slot - bw) / 2, y: T + h - bh, w: bw, h: bh, cx: L + i * slot + slot / 2 };
  });
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push({ v, y: T + h - (v / top) * h });
  return { bars, ticks, slot };
});
const hover = ref<number | null>(null);
function onMove(e: PointerEvent) {
  const r = (e.currentTarget as SVGElement).getBoundingClientRect();
  const i = Math.floor((e.clientX - r.left - L) / chart.value.slot);
  hover.value = i >= 0 && i < 45 ? i + 1 : null;
}
const tip = computed(() => {
  if (!hover.value) return null;
  const b = chart.value.bars[hover.value - 1];
  return { ...b, left: Math.min(Math.max(b.cx - 60, 0), width.value - 120), gap: gap.value[b.n] };
});
// 막대 모서리: 위쪽만 둥글게 (아래는 기준선에 붙임)
const barPath = (b: { x: number; y: number; w: number; h: number }) => {
  if (b.h <= 0) return '';
  const r = Math.min(3, b.w / 2, b.h);
  return `M${b.x},${b.y + b.h}V${b.y + r}Q${b.x},${b.y} ${b.x + r},${b.y}H${b.x + b.w - r}Q${b.x + b.w},${b.y} ${b.x + b.w},${b.y + r}V${b.y + b.h}Z`;
};
</script>

<template>
  <p v-if="state === 'loading'" class="muted">당첨번호를 불러오는 중이에요…</p>
  <p v-else-if="state === 'fail'" class="notice">지금은 통계를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
  <template v-else>
    <div class="field">
      <label>통계 기간 <small class="muted">({{ span }}, {{ rs.length }}회)</small></label>
      <div class="chips">
        <button v-for="[n, l] in RANGES" :key="n" type="button" class="chip" :class="{ on: range === n }" @click="range = n">{{ l }}</button>
      </div>
      <label class="check"><input v-model="withBonus" type="checkbox" /> 보너스 번호 포함</label>
    </div>

    <h3 class="h3">번호별 당첨 횟수</h3>
    <div ref="box" class="chart">
      <svg :width="width" :height="H" role="img" :aria-label="`번호별 당첨 횟수 막대그래프, ${span}`" @pointermove="onMove" @pointerdown="onMove" @pointerleave="hover = null">
        <g class="grid"><line v-for="t in chart.ticks" :key="t.v" :x1="L" :x2="width - R" :y1="t.y" :y2="t.y" /></g>
        <g class="axis">
          <text v-for="t in chart.ticks" :key="'t' + t.v" :x="L - 6" :y="t.y + 4" text-anchor="end">{{ t.v }}</text>
          <text v-for="b in chart.bars.filter((x) => x.n === 1 || x.n % 5 === 0)" :key="'n' + b.n" :x="b.cx" :y="H - 6" text-anchor="middle">{{ b.n }}</text>
        </g>
        <path v-for="b in chart.bars" :key="b.n" :d="barPath(b)" :fill="COLORS[ballBand(b.n)]" :opacity="hover && hover !== b.n ? 0.45 : 1" />
        <rect :x="L" :y="0" :width="Math.max(0, width - L - R)" :height="H" fill="transparent" />
      </svg>
      <div v-if="tip" class="tip" :style="{ left: tip.left + 'px' }">
        <b>{{ tip.n }}번 · {{ tip.v }}회</b>
        <small>{{ pct(tip.v, rs.length) }}% 회차에서 나옴 · {{ tip.gap === 0 ? '최근 회차에 나옴' : `${tip.gap}회째 안 나옴` }}</small>
      </div>
    </div>

    <div class="cards">
      <div class="stat-card">
        <h4>많이 나온 번호</h4>
        <div class="row-balls"><span v-for="n in most" :key="n" class="nb"><LottoBall :n="n" size="sm" /><small>{{ freq[n] }}회</small></span></div>
      </div>
      <div class="stat-card">
        <h4>적게 나온 번호</h4>
        <div class="row-balls"><span v-for="n in least" :key="n" class="nb"><LottoBall :n="n" size="sm" /><small>{{ freq[n] }}회</small></span></div>
      </div>
      <div class="stat-card">
        <h4>오래 안 나온 번호 <small class="muted">(전체 기준)</small></h4>
        <div class="row-balls"><span v-for="n in longest" :key="n" class="nb"><LottoBall :n="n" size="sm" /><small>{{ gap[n] }}회째</small></span></div>
      </div>
    </div>

    <div class="row" style="margin-top: 16px">
      <div>
        <h3 class="h3" style="margin-top: 0">홀짝 비율</h3>
        <div class="table-wrap" style="margin-top: 0">
          <table class="table">
            <thead><tr><th>홀 : 짝</th><th>회차</th><th>비율</th></tr></thead>
            <tbody><tr v-for="[k, v] in oe" :key="k"><td>{{ k }}</td><td>{{ v }}</td><td>{{ pct(v, rs.length) }}%</td></tr></tbody>
          </table>
        </div>
      </div>
      <div>
        <h3 class="h3" style="margin-top: 0">번호 구간별</h3>
        <div class="table-wrap" style="margin-top: 0">
          <table class="table">
            <thead><tr><th>구간</th><th>나온 횟수</th><th>비율</th></tr></thead>
            <tbody>
              <tr v-for="(v, i) in bd" :key="i">
                <td><span class="dot" :style="{ background: COLORS[i] }"></span>{{ ['1~10', '11~20', '21~30', '31~40', '41~45'][i] }}</td>
                <td>{{ v }}</td><td>{{ pct(v, rs.length * 6) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <details style="margin-top: 14px">
      <summary>번호별 전체 표 보기</summary>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>번호</th><th>당첨 횟수</th><th>나온 회차 비율</th><th>마지막으로 나온 뒤</th></tr></thead>
          <tbody>
            <tr v-for="n in 45" :key="n"><td>{{ n }}</td><td>{{ freq[n] }}회</td><td>{{ pct(freq[n], rs.length) }}%</td><td>{{ gap[n] === 0 ? '최근 회차' : `${gap[n]}회` }}</td></tr>
          </tbody>
        </table>
      </div>
    </details>

    <p class="notice">통계는 지난 추첨 기록일 뿐이에요. 로또는 매 회차 새로 추첨해서, 많이 나온 번호든 오래 안 나온 번호든 다음 회차에 나올 확률은 모두 같아요.</p>
  </template>
</template>

<style scoped>
.check { display: inline-flex; gap: 6px; align-items: center; margin-top: 10px; font-weight: 500; }
.h3 { margin: 20px 0 6px; font-size: 1rem; }
.chart { position: relative; }
.chart svg { display: block; touch-action: pan-y; user-select: none; }
.grid line { stroke: var(--line); stroke-width: 1; }
.axis text { font-size: 11px; fill: var(--muted); }
.tip {
  position: absolute; top: 0; width: 120px; pointer-events: none; background: var(--text); color: #fff;
  border-radius: 8px; padding: 6px 10px; display: flex; flex-direction: column; font-size: .85rem; line-height: 1.35;
}
.tip small { opacity: .85; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-top: 14px; }
.stat-card { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; background: var(--bg); }
.stat-card h4 { margin: 0 0 8px; font-size: .95rem; }
.row-balls { display: flex; flex-wrap: wrap; gap: 6px; }
.nb { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; }
.nb small { color: var(--muted); font-size: .72rem; }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
</style>
