<script setup lang="ts">
// 환율 계산기 UI. 로직은 src/lib/exchange.js
// 환율은 /api/rates(한국수출입은행 고시 매매기준율, Worker가 하루 몇 번 받아 둠)에서 불러온다.
// 못 불러오면 직접 입력해서 계산한다. 사용자가 입력한 금액은 어디로도 보내지 않는다.
import { ref, computed, watch, onMounted } from 'vue';
import { loadRates, convert, change, quickAmounts, quickTable, num, FLAGS } from '../../lib/exchange.js';

// currency: 통화별 페이지(달러·엔화 환율 계산기 등)에서 고정해서 여는 통화. 이때는 마지막에 고른 통화(기기 저장)보다 우선하고 빠른 환산표를 보여 준다
const props = defineProps<{ currency?: string }>();

type Rate = { code: string; unit: number; name: string; base: number; send: number | null; receive: number | null };
type Data = { date: string; source: string; rates: Rate[]; prev: null | { date: string; base: Record<string, number> } };

// 불러오기 실패 시 고를 수 있는 통화 (단위만, 환율 값은 사용자가 입력)
const FALLBACK: Rate[] = [
  ['USD', 1, '미국 달러'], ['JPY', 100, '일본 엔'], ['EUR', 1, '유로'], ['CNH', 1, '위안화'], ['GBP', 1, '영국 파운드'],
  ['AUD', 1, '호주 달러'], ['CAD', 1, '캐나다 달러'], ['HKD', 1, '홍콩 달러'], ['SGD', 1, '싱가포르 달러'], ['THB', 1, '태국 바트'], ['IDR', 100, '인도네시아 루피아'],
].map(([code, unit, name]) => ({ code, unit, name, base: 0, send: null, receive: null }) as Rate);

const data = ref<Data | null>(null);
const state = ref<'loading' | 'ok' | 'fail'>('loading');
const code = ref(props.currency ?? 'USD');
const dir = ref<'toKrw' | 'fromKrw'>('toKrw');
// 통화별 페이지는 그 통화에서 자주 계산하는 금액으로 시작 (엔화 1만 엔, 바트 1,000바트 등)
const amount = ref(props.currency ? String(quickAmounts(props.currency)[2]) : '100');
const rateText = ref('');

const list = computed(() => data.value?.rates ?? FALLBACK);
const cur = computed(() => list.value.find((r) => r.code === code.value) ?? list.value[0]);
const unitLabel = computed(() => `${cur.value.unit === 100 ? '100 ' : ''}${cur.value.code}`);

function useOfficial() {
  rateText.value = cur.value.base > 0 ? String(cur.value.base) : '';
}
watch(code, () => {
  useOfficial();
  if (!props.currency) { try { localStorage.setItem('ttukttak:fx', code.value); } catch { /* 저장 불가 환경 */ } }
});

onMounted(async () => {
  if (!props.currency) { try { const c = localStorage.getItem('ttukttak:fx'); if (c) code.value = c; } catch { /* 저장 불가 환경 */ } }
  const d = (await loadRates()) as Data | null;
  data.value = d;
  state.value = d ? 'ok' : 'fail';
  if (!list.value.some((r) => r.code === code.value)) code.value = 'USD';
  useOfficial();
});

const rate = computed(() => num(rateText.value));
const custom = computed(() => cur.value.base > 0 && rate.value !== cur.value.base);
const r = computed(() => (amount.value.trim() && rateText.value ? convert({ amount: num(amount.value), rate: rate.value, unit: cur.value.unit, dir: dir.value }) : null));
const ok = computed(() => (r.value && 'value' in r.value ? r.value.value : null));
const error = computed(() => (r.value && 'error' in r.value ? r.value.error : ''));
// 송금 환율로 계산한 값 (외화 → 원화일 때만)
const remit = computed(() => {
  const a = num(amount.value);
  const c = cur.value;
  if (dir.value !== 'toKrw' || !(a > 0) || !c.send || !c.receive) return null;
  return { send: Math.round((a * c.send) / c.unit), receive: Math.round((a * c.receive) / c.unit) };
});

const table = computed(() => (props.currency && code.value === props.currency && cur.value.base > 0 ? quickTable(cur.value.code, cur.value.base, cur.value.unit) : null));
const won = (n: number) => n.toLocaleString('ko-KR') + '원';
const fx = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
const rateStr = (n: number) => n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateKo = (s: string) => { const [y, m, d] = s.split('-').map(Number); return `${y}년 ${m}월 ${d}일`; };
function swap() {
  if (ok.value !== null) amount.value = String(ok.value);
  dir.value = dir.value === 'toKrw' ? 'fromKrw' : 'toKrw';
}
function pick(c: string) {
  code.value = c;
  document.getElementById('fx-amount')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
</script>

<template>
  <p v-if="state === 'loading'" class="muted" style="margin: 0 0 12px">오늘 환율을 불러오는 중이에요…</p>
  <p v-else-if="state === 'ok' && data" class="muted" style="margin: 0 0 12px">
    <b>{{ dateKo(data.date) }}</b> {{ data.source }} 고시 매매기준율이에요. 하루 한 번 정해지는 기준 환율이라 포털의 실시간 시세와 조금 달라요.
  </p>
  <p v-else class="notice" style="margin: 0 0 12px">지금은 환율을 불러오지 못했어요. 환율을 직접 넣으면 바로 계산돼요.</p>

  <div class="row">
    <div class="field">
      <label for="fx-cur">통화</label>
      <select id="fx-cur" v-model="code">
        <option v-for="c in list" :key="c.code" :value="c.code">{{ FLAGS[c.code as keyof typeof FLAGS] ?? '' }} {{ c.code }} · {{ c.name }}</option>
      </select>
    </div>
    <div class="field">
      <label for="fx-rate">적용 환율 (원 / {{ unitLabel }})</label>
      <input id="fx-rate" v-model="rateText" type="text" inputmode="decimal" placeholder="예: 1385.5" />
      <small v-if="custom" class="muted">직접 넣은 환율로 계산 중 · <a href="#" @click.prevent="useOfficial">고시 환율로 되돌리기</a></small>
      <small v-else class="muted">은행에서 안내받은 환율로 바꿔 넣어도 돼요.</small>
    </div>
  </div>

  <div class="tabs" role="tablist" style="margin: 16px 0 10px">
    <button type="button" role="tab" :aria-selected="dir === 'toKrw'" @click="dir = 'toKrw'">{{ cur.code }} → 원화</button>
    <button type="button" role="tab" :aria-selected="dir === 'fromKrw'" @click="dir = 'fromKrw'">원화 → {{ cur.code }}</button>
  </div>
  <div class="field">
    <label for="fx-amount">{{ dir === 'toKrw' ? `금액 (${cur.code})` : '금액 (원)' }}</label>
    <input id="fx-amount" v-model="amount" type="text" inputmode="decimal" :placeholder="dir === 'toKrw' ? '예: 100' : '예: 1,000,000'" />
    <div v-if="dir === 'toKrw'" class="chips">
      <button v-for="q in quickAmounts(cur.code)" :key="q" type="button" class="chip" :class="{ on: num(amount) === q }" @click="amount = String(q)">{{ q.toLocaleString('ko-KR') }}</button>
    </div>
  </div>

  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <div v-else-if="ok !== null" class="result" aria-live="polite">
    <div class="sub">{{ dir === 'toKrw' ? `${fx(num(amount))} ${cur.code}` : won(num(amount)) }} =</div>
    <div class="big">{{ dir === 'toKrw' ? won(ok) : `${fx(ok)} ${cur.code}` }}</div>
    <p v-if="remit && !custom" class="sub" style="margin: 8px 0 0">
      해외로 송금 보낼 때 약 <b>{{ won(remit.send) }}</b> · 송금 받을 때 약 <b>{{ won(remit.receive) }}</b>
    </p>
    <button type="button" class="btn-sub" style="margin-top: 10px" @click="swap">⇅ 방향 바꾸기</button>
  </div>

  <template v-if="table && table.toKrw.length">
    <h3 style="margin: 24px 0 6px; font-size: 1rem">{{ cur.name }} 빠른 환산표 <small class="muted">(오늘 매매기준율)</small></h3>
    <div class="quick-grid">
      <table class="table">
        <thead><tr><th>{{ cur.code }}</th><th>원화</th></tr></thead>
        <tbody><tr v-for="[a, w] in table.toKrw" :key="a"><td>{{ fx(a) }} {{ cur.code }}</td><td>{{ won(w) }}</td></tr></tbody>
      </table>
      <table class="table">
        <thead><tr><th>원화</th><th>{{ cur.code }}</th></tr></thead>
        <tbody><tr v-for="[w, a] in table.fromKrw" :key="w"><td>{{ won(w) }}</td><td>{{ fx(a) }} {{ cur.code }}</td></tr></tbody>
      </table>
    </div>
  </template>

  <template v-if="data">
    <h3 style="margin: 24px 0 6px; font-size: 1rem">오늘 환율 한눈에 보기 <small class="muted">(통화를 누르면 계산기에 넣어요)</small></h3>
    <div class="table-wrap">
      <table class="table fx-table">
        <thead>
          <tr><th>통화</th><th>매매기준율</th><th v-if="data.prev">전일 대비</th><th>송금 보낼 때</th><th>송금 받을 때</th></tr>
        </thead>
        <tbody>
          <tr v-for="c in data.rates" :key="c.code" :class="{ next: c.code === code }" @click="pick(c.code)">
            <td><button type="button" class="fx-pick">{{ FLAGS[c.code as keyof typeof FLAGS] ?? '' }} {{ c.name }} <small class="muted">{{ c.unit === 100 ? '100 ' : '' }}{{ c.code }}</small></button></td>
            <td><b>{{ rateStr(c.base) }}</b></td>
            <td v-if="data.prev">
              <template v-if="change(c, data.prev)">
                <span :class="change(c, data.prev)!.diff > 0 ? 'up' : change(c, data.prev)!.diff < 0 ? 'down' : 'muted'">
                  {{ change(c, data.prev)!.diff > 0 ? '▲' : change(c, data.prev)!.diff < 0 ? '▼' : '-' }} {{ rateStr(Math.abs(change(c, data.prev)!.diff)) }}
                </span>
              </template>
              <span v-else class="muted">-</span>
            </td>
            <td>{{ c.send ? rateStr(c.send) : '-' }}</td>
            <td>{{ c.receive ? rateStr(c.receive) : '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="muted" style="margin: 8px 0 0">
      <template v-if="data.prev">전일 대비는 {{ dateKo(data.prev.date) }} 고시 기준이에요. </template>은행 창구에서 현찰로 바꿀 때는 이보다 불리한 환율이 적용돼요.
    </p>
  </template>
</template>

<style scoped>
.fx-table tbody tr { cursor: pointer; }
.fx-table tbody tr:hover td { background: var(--accent-soft); }
.fx-pick { background: none; border: 0; padding: 0; color: inherit; font: inherit; cursor: pointer; text-align: left; }
.up { color: #e03131; }
.down { color: #1c7ed6; }
.quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.quick-grid .table { font-size: .9rem; }
@media (max-width: 520px) { .quick-grid { grid-template-columns: 1fr; } }
</style>
