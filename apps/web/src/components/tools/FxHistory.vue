<script setup lang="ts">
// 과거 환율 조회 UI. 로직은 src/lib/fxHistory.js, 데이터는 /api/rates/day · /api/rates/history (수출입은행 고시 환율을 D1에 저장)
// 그래프는 라이브러리 없이 SVG로 그린다 (선 하나 + 십자선·툴팁).
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import DateInput from '../DateInput.vue';
import { PERIODS, fromDate, stats, monthly, geometry, nearest, dateKo, loadDay, loadHistory } from '../../lib/fxHistory.js';
import { POPULAR, FLAGS, loadRates } from '../../lib/exchange.js';

type Row = { code: string; unit: number; name: string; base: number; send: number | null; receive: number | null };
type Cov = { min: string | null; max: string | null };

const mode = ref<'trend' | 'day'>('trend');
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const coverage = ref<Cov | null>(null);
const START = '2016-01-04'; // 수집 목표 (2016년 첫 영업일)
const filling = computed(() => !!coverage.value?.min && coverage.value.min > START);
const flag = (c: string) => FLAGS[c as keyof typeof FLAGS] ?? '';
const fmt = (n: number) => n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthKo = (m: string) => `${m.slice(0, 4)}년 ${Number(m.slice(5))}월`;
const rank = (c: string) => { const i = POPULAR.indexOf(c); return i < 0 ? 99 : i; };

// ── 통화 목록 (오늘 환율에서)
const currencies = ref<{ code: string; name: string; unit: number }[]>([{ code: 'USD', name: '미국 달러', unit: 1 }]);
const code = ref('USD');

// ── 기간 추이
const period = ref('1y');
const hist = ref<{ points: [string, number][]; unit: number | null; name: string | null } | null>(null);
const histState = ref<'idle' | 'loading' | 'fail'>('idle');
let seq = 0;
async function loadTrend() {
  const my = ++seq;
  histState.value = 'loading';
  const days = PERIODS.find((p) => p[0] === period.value)![2] as number;
  const d = await loadHistory(code.value, fromDate(today, days));
  if (my !== seq) return; // 더 최근 요청이 있으면 버림
  if (!d) { histState.value = 'fail'; hist.value = null; return; }
  coverage.value = d.coverage ?? coverage.value;
  hist.value = d;
  histState.value = 'idle';
  hover.value = null;
}
const points = computed(() => hist.value?.points ?? []);
const st = computed(() => stats(points.value));
const months = computed(() => monthly(points.value));
const unitLabel = computed(() => {
  const c = currencies.value.find((x) => x.code === code.value);
  const u = hist.value?.unit ?? c?.unit ?? 1;
  return `${u === 100 ? '100 ' : ''}${code.value}`;
});

// 그래프 크기: 실제 너비에 맞춰 픽셀 단위로 그린다 (글씨가 줄어들지 않게)
const box = ref<HTMLElement | null>(null);
const width = ref(640);
let ro: ResizeObserver | null = null;
const H = 260;
const BOX = computed(() => ({ w: width.value, h: H, left: 56, right: 12, top: 12, bottom: 28 }));
const geo = computed(() => (points.value.length ? geometry(points.value, BOX.value) : null));
const hover = ref<number | null>(null);
function onMove(e: PointerEvent) {
  if (!geo.value) return;
  const r = (e.currentTarget as SVGElement).getBoundingClientRect();
  hover.value = nearest(geo.value.xs, e.clientX - r.left);
}
const tip = computed(() => {
  if (hover.value === null || !geo.value) return null;
  const i = hover.value;
  const x = geo.value.xs[i];
  return { i, x, y: geo.value.ys[i], date: points.value[i][0], v: points.value[i][1], left: Math.min(Math.max(x - 70, 0), width.value - 140) };
});
const xLabel = (d: string, step: number) => (step >= 300 ? `${d.slice(0, 4)}` : `${d.slice(2, 4)}.${Number(d.slice(5, 7))}${d.slice(8) === '01' ? '' : '.' + Number(d.slice(8))}`);
const span = computed(() => (points.value.length > 1 ? (Date.parse(points.value[points.value.length - 1][0]) - Date.parse(points.value[0][0])) / 86400e3 : 0));
const xStep = computed(() => (span.value > 1500 ? 365 : 30));

// ── 날짜로 조회
const date = ref('');
const dayData = ref<{ requested: string; date: string | null; rates: Row[] } | null>(null);
const dayState = ref<'idle' | 'loading' | 'fail'>('idle');
async function loadDate() {
  if (!date.value) { dayData.value = null; return; }
  dayState.value = 'loading';
  const d = await loadDay(date.value);
  if (!d) { dayState.value = 'fail'; dayData.value = null; return; }
  coverage.value = d.coverage ?? coverage.value;
  d.rates.sort((a: Row, b: Row) => rank(a.code) - rank(b.code) || a.code.localeCompare(b.code));
  dayData.value = d;
  dayState.value = 'idle';
}
watch(date, loadDate);
watch([code, period], () => { loadTrend(); try { localStorage.setItem('ttukttak:fx', code.value); } catch { /* 저장 불가 */ } });

onMounted(async () => {
  if (box.value) {
    width.value = box.value.clientWidth || 640;
    ro = new ResizeObserver(() => { if (box.value) width.value = box.value.clientWidth || 640; });
    ro.observe(box.value);
  }
  try { const c = localStorage.getItem('ttukttak:fx'); if (c && /^[A-Z]{3}$/.test(c)) code.value = c; } catch { /* 저장 불가 */ }
  loadTrend();
  const latest = await loadRates();
  if (latest) currencies.value = latest.rates.map((r) => ({ code: r.code, name: r.name, unit: r.unit }));
});
onBeforeUnmount(() => ro?.disconnect());
function showDay(d: string) {
  date.value = d;
  mode.value = 'day';
}
</script>

<template>
  <div class="tabs" role="tablist">
    <button type="button" role="tab" :aria-selected="mode === 'trend'" @click="mode = 'trend'">기간별 추이</button>
    <button type="button" role="tab" :aria-selected="mode === 'day'" @click="mode = 'day'">날짜로 조회</button>
  </div>

  <p v-if="filling" class="notice" style="margin: 0 0 12px">
    지금은 {{ dateKo(coverage!.min!) }}부터 조회할 수 있어요. 2016년 자료까지 매시간 조금씩 채우고 있어요.
  </p>

  <!-- 기간별 추이 -->
  <div v-show="mode === 'trend'">
    <div class="row">
      <div class="field">
        <label for="fh-cur">통화</label>
        <select id="fh-cur" v-model="code">
          <option v-for="c in currencies" :key="c.code" :value="c.code">{{ flag(c.code) }} {{ c.code }} · {{ c.name }}</option>
        </select>
      </div>
      <div class="field">
        <label>기간</label>
        <div class="chips" style="margin-top: 0">
          <button v-for="[id, l] in PERIODS" :key="id" type="button" class="chip" :class="{ on: period === id }" @click="period = id as string">{{ l }}</button>
        </div>
      </div>
    </div>

    <h3 class="chart-title">{{ code }} 매매기준율 <small class="muted">(원 / {{ unitLabel }})</small></h3>
    <div ref="box" class="chart" :class="{ dim: histState === 'loading' }">
      <p v-if="histState === 'fail'" class="error" role="alert">과거 환율을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      <p v-else-if="histState === 'idle' && !points.length" class="muted chart-empty">이 기간에는 아직 저장된 환율이 없어요.</p>
      <svg v-if="geo" :width="width" :height="H" role="img" :aria-label="`${code} 환율 추이 그래프`"
           @pointermove="onMove" @pointerdown="onMove">
        <g class="grid">
          <line v-for="t in geo.yTicks" :key="'y' + t.v" :x1="BOX.left" :x2="width - BOX.right" :y1="t.y" :y2="t.y" />
        </g>
        <g class="axis">
          <text v-for="t in geo.yTicks" :key="'yl' + t.v" :x="BOX.left - 8" :y="t.y + 4" text-anchor="end">{{ t.v.toLocaleString('ko-KR') }}</text>
          <text v-for="t in geo.xTicks" :key="'xl' + t.d" :x="t.x" :y="H - 8" text-anchor="middle">{{ xLabel(t.d, xStep) }}</text>
        </g>
        <path :d="geo.path" class="line" />
        <template v-if="tip">
          <line class="cross" :x1="tip.x" :x2="tip.x" :y1="BOX.top" :y2="H - BOX.bottom" />
          <circle :cx="tip.x" :cy="tip.y" r="5" class="dot" />
        </template>
        <rect :x="BOX.left" :y="0" :width="Math.max(0, width - BOX.left - BOX.right)" :height="H" fill="transparent" style="touch-action: pan-y" />
      </svg>
      <div v-if="tip" class="tip" :style="{ left: tip.left + 'px' }">
        <small>{{ dateKo(tip.date) }}</small><b>{{ fmt(tip.v) }}원</b>
      </div>
    </div>

    <div v-if="st" class="stat-grid">
      <div class="stat"><small>최고</small><b>{{ fmt(st.max.v) }}</b><small>{{ st.max.date }}</small></div>
      <div class="stat"><small>최저</small><b>{{ fmt(st.min.v) }}</b><small>{{ st.min.date }}</small></div>
      <div class="stat"><small>평균</small><b>{{ fmt(st.avg) }}</b><small>{{ st.n.toLocaleString() }}일 고시</small></div>
      <div class="stat">
        <small>기간 변동</small>
        <b :class="st.diff > 0 ? 'up' : st.diff < 0 ? 'down' : ''">{{ st.diff > 0 ? '▲' : st.diff < 0 ? '▼' : '' }} {{ fmt(Math.abs(st.diff)) }}</b>
        <small>{{ st.pct > 0 ? '+' : '' }}{{ st.pct }}%</small>
      </div>
    </div>

    <details v-if="months.length" class="month-table">
      <summary>월별 평균 환율 표 보기 ({{ months.length }}개월)</summary>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>월</th><th>평균</th><th>최고</th><th>최저</th></tr></thead>
          <tbody>
            <tr v-for="m in months" :key="m.month"><td>{{ monthKo(m.month) }}</td><td><b>{{ fmt(m.avg) }}</b></td><td>{{ fmt(m.max) }}</td><td>{{ fmt(m.min) }}</td></tr>
          </tbody>
        </table>
      </div>
    </details>
    <p v-if="tip" class="muted" style="margin: 8px 0 0"><a href="#" @click.prevent="showDay(tip.date)">{{ dateKo(tip.date) }} 전체 통화 환율 보기</a></p>
  </div>

  <!-- 날짜로 조회 -->
  <div v-show="mode === 'day'">
    <div class="field">
      <label for="fh-date">조회할 날짜</label>
      <DateInput id="fh-date" v-model="date" :min="coverage?.min ?? '2016-01-01'" :max="today" placeholder="예: 2025.12.31" />
      <small class="muted">주말·공휴일을 고르면 그 전 마지막 고시일 환율을 보여줘요.</small>
    </div>
    <p v-if="dayState === 'loading'" class="muted">불러오는 중…</p>
    <p v-else-if="dayState === 'fail'" class="error" role="alert">환율을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
    <template v-else-if="dayData">
      <p v-if="!dayData.date" class="notice">이 날짜의 환율은 아직 저장돼 있지 않아요.</p>
      <template v-else>
        <div class="result" aria-live="polite">
          <div class="sub">{{ dateKo(dayData.date) }} 고시 환율</div>
          <p v-if="dayData.date !== dayData.requested" class="sub" style="margin: 4px 0 0">
            {{ dateKo(dayData.requested) }}은 고시가 없는 날이라 직전 영업일 환율이에요.
          </p>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>통화</th><th>매매기준율</th><th>송금 보낼 때</th><th>송금 받을 때</th></tr></thead>
            <tbody>
              <tr v-for="r in dayData.rates" :key="r.code">
                <td>{{ flag(r.code) }} {{ r.name }} <small class="muted">{{ r.unit === 100 ? '100 ' : '' }}{{ r.code }}</small></td>
                <td><b>{{ fmt(r.base) }}</b></td>
                <td>{{ r.send ? fmt(r.send) : '-' }}</td>
                <td>{{ r.receive ? fmt(r.receive) : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.chart-title { margin: 18px 0 6px; font-size: 1rem; }
.chart { position: relative; min-height: 260px; }
.chart.dim { opacity: .5; }
.chart-empty { padding-top: 100px; text-align: center; }
.chart svg { display: block; touch-action: pan-y; user-select: none; }
.grid line { stroke: var(--line); stroke-width: 1; }
.axis text { font-size: 12px; fill: var(--muted); }
.line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.cross { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; }
.dot { fill: var(--accent); stroke: #fff; stroke-width: 2; }
.tip {
  position: absolute; top: 0; width: 140px; pointer-events: none; background: var(--text); color: #fff;
  border-radius: 8px; padding: 6px 10px; display: flex; flex-direction: column; font-size: .85rem; line-height: 1.35;
}
.tip small { opacity: .8; }
.stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.stat { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; min-width: 0; }
.stat small { color: var(--muted); font-size: .78rem; }
.stat b { font-size: 1.05rem; }
@media (max-width: 520px) { .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.month-table { margin-top: 14px; }
.up { color: #e03131; }
.down { color: #1c7ed6; }
</style>
