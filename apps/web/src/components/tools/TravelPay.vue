<script setup lang="ts">
// 해외 결제 수수료 계산기 UI. 로직은 src/lib/travelPay.js
// 환율·수수료율은 사용자가 입력한다. 입력한 환율은 이 브라우저에만 통화별로 기억한다(편의 기능).
import { ref, computed, watch, onMounted } from 'vue';
import { travelPay, toKrw, num, CURRENCIES } from '../../lib/travelPay.js';
import { loadRates, eximCode, rateFor } from '../../lib/exchange.js';

type C = keyof typeof CURRENCIES;
const cur = ref<C>('IDR');
const amount = ref('');
const rate = ref('');
const tax = ref<number | ''>(0);
const brand = ref<number | ''>(1.1);
const issuer = ref<number | ''>(0.2);
const dcc = ref<number | ''>(5);

const info = computed(() => CURRENCIES[cur.value]);
const KEY = (c: string) => `ttukttak:rate:${c}`;
function loadRate() {
  try { rate.value = localStorage.getItem(KEY(cur.value)) ?? ''; } catch { rate.value = ''; }
}
// 오늘 고시 환율(한국수출입은행 매매기준율). 고시하지 않는 통화(VND·PHP·TWD)는 직접 입력.
const official = ref<{ rate: number; date: string } | null | 'none' | 'fail'>(null);
const fetching = ref(false);
async function fetchOfficial(fill: boolean) {
  fetching.value = true;
  const d = await loadRates();
  fetching.value = false;
  if (!d) { official.value = 'fail'; return; }
  const r = d.rates.find((x) => x.code === eximCode(cur.value));
  official.value = r ? { rate: rateFor(r, info.value.unit), date: d.date } : 'none';
  if (fill && typeof official.value === 'object' && official.value) rate.value = String(official.value.rate);
}
onMounted(() => { loadRate(); fetchOfficial(!rate.value); });
watch(cur, () => { loadRate(); amount.value = ''; fetchOfficial(!rate.value); });
const dateKo = (s: string) => { const [, m, d] = s.split('-').map(Number); return `${m}월 ${d}일`; };
// 직접 넣은 환율만 기억한다 (고시 환율과 같으면 지워서 다음에 그날 환율을 새로 불러오게)
watch(rate, (v) => {
  try {
    const o = official.value;
    if (o && typeof o === 'object' && num(v) === o.rate) localStorage.removeItem(KEY(cur.value));
    else if (num(v) > 0) localStorage.setItem(KEY(cur.value), String(num(v)));
  } catch { /* 저장 불가 환경 */ }
});

const params = computed(() => ({
  amount: num(amount.value), rate: num(rate.value), unit: info.value.unit,
  taxPct: Number(tax.value) || 0, brandPct: Number(brand.value) || 0, issuerPct: Number(issuer.value) || 0, dccPct: Number(dcc.value) || 0,
}));
const r = computed(() => (amount.value && rate.value ? travelPay(params.value) : null));
const ok = computed(() => (r.value && !('error' in r.value) ? r.value : null));
const error = computed(() => (r.value && 'error' in r.value ? r.value.error : ''));
const feePct = computed(() => (Number(brand.value) || 0) + (Number(issuer.value) || 0));
const won = (n: number) => n.toLocaleString('ko-KR') + '원';
const loc = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
</script>

<template>
  <div class="field">
    <label>통화</label>
    <div class="chips">
      <button v-for="(c, k) in CURRENCIES" :key="k" type="button" class="chip" :class="{ on: cur === k }" @click="cur = k" :title="c.label">{{ k }}</button>
    </div>
    <small class="muted">{{ info.label }}</small>
  </div>

  <div class="row" style="margin-top: 14px">
    <div class="field">
      <label for="amt">현지 가격 ({{ cur }})</label>
      <input id="amt" v-model="amount" type="text" inputmode="decimal" :placeholder="cur === 'IDR' ? '예: 150,000' : '예: 100'" />
    </div>
    <div class="field">
      <label for="rate">환율 (원 / {{ info.unit === 100 ? '100 ' : '1 ' }}{{ cur }})</label>
      <input id="rate" v-model="rate" type="text" inputmode="decimal" placeholder="오늘 환율을 입력" />
      <small v-if="official && typeof official === 'object'" class="muted">
        <template v-if="num(rate) === official.rate">{{ dateKo(official.date) }} 수출입은행 매매기준율이에요.</template>
        <template v-else>직접 넣은 환율이에요 · <a href="#" @click.prevent="rate = String(official.rate)">오늘 고시 환율({{ official.rate.toLocaleString('ko-KR') }}) 넣기</a></template>
      </small>
      <small v-else-if="official === 'none'" class="muted">이 통화는 고시 환율이 없어요. 은행·포털의 환율을 넣으세요. 이 기기에 기억돼요.</small>
      <small v-else-if="official === 'fail'" class="muted">오늘 환율을 불러오지 못했어요. 은행·포털의 환율을 넣으세요. <a href="#" @click.prevent="fetchOfficial(true)">다시 시도</a></small>
      <small v-else class="muted">{{ fetching ? '오늘 환율을 불러오는 중…' : '은행·포털의 오늘 환율을 넣으세요. 이 기기에 기억돼요.' }}</small>
    </div>
  </div>

  <div class="field" style="margin-top: 14px">
    <label for="tax">세금·봉사료·팁 (%) <small class="muted">가격표에 포함되지 않고 따로 붙는 금액</small></label>
    <input id="tax" v-model.number="tax" type="number" min="0" step="0.5" inputmode="decimal" />
    <div class="chips"><button v-for="t in [0, 10, 15, 18, 20, 21]" :key="t" type="button" class="chip" :class="{ on: tax === t }" @click="tax = t">{{ t }}%</button></div>
  </div>

  <details style="margin-top: 14px; border: 0; padding: 0" open>
    <summary class="muted">카드 수수료 설정 (카드사 안내에서 확인)</summary>
    <div class="row" style="margin-top: 10px">
      <div class="field">
        <label for="br">브랜드 수수료 (%)</label>
        <input id="br" v-model.number="brand" type="number" min="0" step="0.1" inputmode="decimal" />
        <div class="chips">
          <button type="button" class="chip" :class="{ on: brand === 1.1 }" @click="brand = 1.1">비자 1.1%</button>
          <button type="button" class="chip" :class="{ on: brand === 1 }" @click="brand = 1">마스터 1%</button>
          <button type="button" class="chip" :class="{ on: brand === 0 && issuer === 0 }" @click="brand = 0; issuer = 0">수수료 면제 카드</button>
        </div>
      </div>
      <div class="field">
        <label for="is">카드사 해외이용 수수료 (%)</label>
        <input id="is" v-model.number="issuer" type="number" min="0" step="0.05" inputmode="decimal" />
      </div>
    </div>
    <div class="field" style="margin-top: 10px">
      <label for="dcc">원화로 결제하면 더 붙는 비용 (%, 비교용)</label>
      <input id="dcc" v-model.number="dcc" type="number" min="0" step="0.5" inputmode="decimal" />
    </div>
  </details>

  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <template v-if="ok">
    <div class="result" aria-live="polite">
      <div class="sub">카드로 현지 통화 결제 시 예상 청구액</div>
      <div class="big">{{ won(ok.card) }}</div>
      <p class="sub" style="margin: 8px 0 0">
        현지 결제액 <b>{{ info.symbol }}{{ loc(ok.local) }}</b> · 환산 <b>{{ won(ok.base) }}</b>
        · 브랜드 수수료 <b>{{ won(ok.brandFee) }}</b> · 해외이용 수수료 <b>{{ won(ok.issuerFee) }}</b>
      </p>
    </div>
    <div class="notice">
      ⚠️ 결제할 때 <b>원화(KRW)로 결제</b>하겠냐고 물으면 <b>현지 통화({{ cur }})</b>를 고르세요.
      원화로 결제하면 약 <b>{{ won(ok.dcc) }}</b>, <b style="color: #c92a2a">{{ won(ok.dccDiff) }} 더</b> 나올 수 있어요.
    </div>

    <h3 style="margin: 22px 0 6px; font-size: 1rem">자주 쓰는 금액 바로 보기 (카드 수수료 {{ feePct.toFixed(2).replace(/\.?0+$/, '') }}% 포함)</h3>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>{{ cur }}</th><th>원화</th></tr></thead>
        <tbody>
          <tr v-for="b in info.bills" :key="b"><td>{{ info.symbol }}{{ b.toLocaleString('ko-KR') }}</td><td>{{ won(toKrw(b, params.rate, info.unit, feePct)) }}</td></tr>
        </tbody>
      </table>
    </div>
  </template>
  <p class="muted" style="margin: 12px 0 0">예상치예요. 실제 청구액은 매입일 환율과 카드사 계산 방식에 따라 조금 달라질 수 있어요.</p>
</template>
