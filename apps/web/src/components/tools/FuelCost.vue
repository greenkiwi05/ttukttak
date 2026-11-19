<script setup lang="ts">
// 주유비 계산기 UI. 로직은 src/lib/fuel.js. 유가는 /api/fuel(오피넷 평균 판매가)이 있으면 자동으로 채우고, 없으면 직접 입력.
// 연비·유가는 이 기기에만 기억한다(편의). 입력값은 서버로 보내지 않는다.
import { ref, computed, watch, onMounted } from 'vue';
import { FUELS, fuelCost, byAmount, loadFuel, num } from '../../lib/fuel.js';

type Sido = { code: string; name: string; price: number; diff: number | null };
const mode = ref<'trip' | 'amount'>('trip');
const fuel = ref('B027');
const region = ref('00'); // 00 = 전국
const distance = ref('');
const efficiency = ref('');
const priceText = ref('');
const roundTrip = ref(false);
const people = ref<number | ''>(1);
const amount = ref('50000');
const data = ref<{ date: string | null; national: Map<string, { price: number; diff: number | null }>; sido: Record<string, Sido[]> } | null>(null);

const KEY = 'ttukttak:fuel';
onMounted(async () => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (s.fuel) fuel.value = s.fuel;
    if (s.efficiency) efficiency.value = String(s.efficiency);
    if (s.region) region.value = s.region;
  } catch { /* 저장 불가 */ }
  data.value = (await loadFuel()) as typeof data.value;
  fillPrice();
});
watch([fuel, efficiency, region], () => {
  try { localStorage.setItem(KEY, JSON.stringify({ fuel: fuel.value, efficiency: num(efficiency.value) || undefined, region: region.value })); } catch { /* 저장 불가 */ }
});

const sidoList = computed<Sido[]>(() => data.value?.sido?.[fuel.value] ?? []);
const official = computed(() => {
  if (!data.value) return null;
  if (region.value !== '00') { const s = sidoList.value.find((x) => x.code === region.value); if (s) return { price: s.price, where: s.name }; }
  const n = data.value.national.get(fuel.value);
  return n ? { price: n.price, where: '전국' } : null;
});
function fillPrice() { if (official.value) priceText.value = String(official.value.price); }
watch([fuel, region], fillPrice);

const price = computed(() => num(priceText.value));
const custom = computed(() => !!official.value && price.value !== official.value.price);
const trip = computed(() => (distance.value && efficiency.value && priceText.value
  ? fuelCost({ distance: num(distance.value), efficiency: num(efficiency.value), price: price.value, roundTrip: roundTrip.value, people: Number(people.value) || 1 }) : null));
const amt = computed(() => (amount.value && priceText.value ? byAmount({ amount: num(amount.value), price: price.value, efficiency: num(efficiency.value) }) : null));
const ok = <T extends object>(r: T | { error: string } | null) => (r && !('error' in r) ? (r as T) : null);
const err = (r: object | null) => (r && 'error' in r ? (r as { error: string }).error : '');
const tOk = computed(() => ok(trip.value));
const aOk = computed(() => ok(amt.value));
const won = (n: number) => n.toLocaleString('ko-KR') + '원';
const label = computed(() => FUELS.find((f) => f.code === fuel.value)?.label ?? '');
const dateKo = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;
</script>

<template>
  <div class="tabs" role="tablist">
    <button type="button" role="tab" :aria-selected="mode === 'trip'" @click="mode = 'trip'">거리로 주유비</button>
    <button type="button" role="tab" :aria-selected="mode === 'amount'" @click="mode = 'amount'">금액으로 몇 L</button>
  </div>

  <div class="field">
    <label>유종</label>
    <div class="chips" style="margin-top: 0">
      <button v-for="f in FUELS" :key="f.code" type="button" class="chip" :class="{ on: fuel === f.code }" @click="fuel = f.code">{{ f.label }}</button>
    </div>
  </div>

  <div class="row" style="margin-top: 14px">
    <div class="field">
      <label for="fc-price">{{ label }} 1L 가격 (원)</label>
      <input id="fc-price" v-model="priceText" type="text" inputmode="decimal" placeholder="예: 1650" />
      <small v-if="official && !custom" class="muted">{{ data?.date ? dateKo(data.date) + ' ' : '' }}오피넷 {{ official.where }} 평균 판매가예요.</small>
      <small v-else-if="official" class="muted">직접 넣은 가격 · <a href="#" @click.prevent="fillPrice">{{ official.where }} 평균({{ official.price.toLocaleString('ko-KR') }}원) 넣기</a></small>
      <small v-else class="muted">주유소 가격을 넣으세요.</small>
    </div>
    <div v-if="sidoList.length && fuel !== 'K015'" class="field">
      <label for="fc-region">지역 평균</label>
      <select id="fc-region" v-model="region">
        <option value="00">전국</option>
        <option v-for="s in sidoList" :key="s.code" :value="s.code">{{ s.name }} ({{ s.price.toLocaleString('ko-KR') }}원)</option>
      </select>
    </div>
  </div>

  <template v-if="mode === 'trip'">
    <div class="row" style="margin-top: 14px">
      <div class="field"><label for="fc-dist">거리 (km)</label><input id="fc-dist" v-model="distance" type="text" inputmode="decimal" placeholder="예: 400 (서울~부산 약 400km)" /></div>
      <div class="field"><label for="fc-eff">연비 (km/L)</label><input id="fc-eff" v-model="efficiency" type="text" inputmode="decimal" placeholder="예: 12.5" /></div>
    </div>
    <div class="row" style="margin-top: 10px; align-items: end">
      <label class="check"><input v-model="roundTrip" type="checkbox" /> 왕복으로 계산</label>
      <div class="field"><label for="fc-people">나눠 낼 인원</label><input id="fc-people" v-model.number="people" type="number" min="1" max="100" inputmode="numeric" /></div>
    </div>
    <p v-if="err(trip)" class="error" role="alert">{{ err(trip) }}</p>
    <div v-else-if="tOk" class="result" aria-live="polite">
      <div class="sub">{{ tOk.km.toLocaleString('ko-KR') }}km{{ roundTrip ? ' (왕복)' : '' }} · {{ label }} {{ tOk.liters }}L</div>
      <div class="big">{{ won(tOk.cost) }}</div>
      <p class="sub" style="margin: 6px 0 0">
        1km당 약 {{ tOk.perKm }}원<template v-if="Number(people) > 1"> · <b>{{ people }}명이 나누면 1인당 {{ won(tOk.perPerson) }}</b> (10원 단위 올림)</template>
      </p>
    </div>
  </template>

  <template v-else>
    <div class="row" style="margin-top: 14px">
      <div class="field">
        <label for="fc-amt">주유 금액 (원)</label>
        <input id="fc-amt" v-model="amount" type="text" inputmode="numeric" />
        <div class="chips"><button v-for="a in [30000, 50000, 70000, 100000]" :key="a" type="button" class="chip" :class="{ on: num(amount) === a }" @click="amount = String(a)">{{ a / 10000 }}만원</button></div>
      </div>
      <div class="field"><label for="fc-eff2">연비 (km/L, 선택)</label><input id="fc-eff2" v-model="efficiency" type="text" inputmode="decimal" placeholder="예: 12.5" /></div>
    </div>
    <p v-if="err(amt)" class="error" role="alert">{{ err(amt) }}</p>
    <div v-else-if="aOk" class="result" aria-live="polite">
      <div class="sub">{{ won(num(amount)) }} 주유하면</div>
      <div class="big">{{ aOk.liters }}L</div>
      <p v-if="aOk.km" class="sub" style="margin: 6px 0 0">연비 {{ efficiency }}km/L 기준 약 <b>{{ aOk.km.toLocaleString('ko-KR') }}km</b> 갈 수 있어요.</p>
    </div>
  </template>

  <template v-if="data">
    <h3 style="margin: 24px 0 6px; font-size: 1rem">오늘 전국 평균 유가 <small class="muted">({{ data.date ? dateKo(data.date) + ', ' : '' }}오피넷)</small></h3>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>유종</th><th>1L 평균</th><th>전일 대비</th></tr></thead>
        <tbody>
          <tr v-for="f in FUELS.filter((x) => data!.national.has(x.code))" :key="f.code">
            <td>{{ f.label }}</td>
            <td><b>{{ data.national.get(f.code)!.price.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) }}원</b></td>
            <td>
              <template v-if="data.national.get(f.code)!.diff !== null">
                <span :class="data.national.get(f.code)!.diff! > 0 ? 'up' : data.national.get(f.code)!.diff! < 0 ? 'down' : 'muted'">
                  {{ data.national.get(f.code)!.diff! > 0 ? '▲' : data.national.get(f.code)!.diff! < 0 ? '▼' : '-' }} {{ Math.abs(data.national.get(f.code)!.diff!).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) }}
                </span>
              </template>
              <span v-else class="muted">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
  <p class="muted" style="margin: 10px 0 0">실제 주유비는 주유소 가격, 운전 습관, 도로 상황에 따라 달라질 수 있어요.</p>
</template>

<style scoped>
.check { display: inline-flex; gap: 6px; align-items: center; font-weight: 500; padding-bottom: 12px; }
.up { color: #e03131; }
.down { color: #1c7ed6; }
</style>
