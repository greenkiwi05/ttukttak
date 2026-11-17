<script setup lang="ts">
// 더치페이(N빵) 계산기 UI. 정산 로직은 src/lib/dutchPay.js
import { ref, computed, watch, onMounted } from 'vue';
import { settle, settleText, ROUND_UNITS } from '../../lib/dutchPay.js';
import { parseList } from '../../lib/randomPick.js';

type Mode = 'simple' | 'rounds';
const mode = ref<Mode>('simple');
const unit = ref(100);
const how = ref<'ceil' | 'round' | 'floor'>('ceil');
const copied = ref(false);
const account = ref('');

// 간단히: 총액 ÷ 인원
const total = ref<number | ''>('');
const count = ref<number | ''>(4);

// 차수별
const namesText = ref('');
const names = computed(() => {
  const l = parseList(namesText.value);
  return l.length ? l : ['1번', '2번', '3번', '4번'];
});
const rounds = ref([{ name: '1차', amount: '' as number | '', payers: [0, 1, 2, 3] }]);
watch(() => names.value.length, (n) => rounds.value.forEach((r) => (r.payers = Array.from({ length: n }, (_, i) => i))));
function addRound() {
  rounds.value.push({ name: `${rounds.value.length + 1}차`, amount: '', payers: names.value.map((_, i) => i) });
}
function toggle(r: { payers: number[] }, i: number) {
  r.payers = r.payers.includes(i) ? r.payers.filter((x) => x !== i) : [...r.payers, i].sort((a, b) => a - b);
}

const input = computed(() => {
  if (mode.value === 'simple') {
    const n = Math.max(0, Math.min(100, Math.round(Number(count.value) || 0)));
    const people = Array.from({ length: n }, (_, i) => `${i + 1}번`);
    return { people, rounds: [{ name: '총액', amount: Number(total.value) || 0, payers: people.map((_, i) => i) }] };
  }
  const people = names.value;
  return { people, rounds: rounds.value.map((r) => ({ name: r.name, amount: Number(r.amount) || 0, payers: r.payers.filter((k) => k < people.length) })) };
});
const ready = computed(() => input.value.rounds.some((r) => r.amount > 0));
const result = computed(() => (ready.value ? settle({ ...input.value, unit: unit.value, mode: how.value }) : null));
const ok = computed(() => (result.value && !('error' in result.value) ? result.value : null));
const error = computed(() => (result.value && 'error' in result.value ? result.value.error : ''));
const won = (n: number) => n.toLocaleString('ko-KR') + '원';

// 정산 문구. "총액 ÷ 인원"은 사람 이름 대신 1인당 금액으로 간단히.
function shareText() {
  const r = ok.value!;
  if (mode.value === 'simple') {
    const lines = ['[정산]', `총 ${won(r.total)} ÷ ${r.perPerson.length}명`, `1인당 ${won(r.perPerson[0]?.pay ?? 0)}`];
    if (account.value.trim()) lines.push('', `입금: ${account.value.trim()}`);
    return lines.join('\n');
  }
  return settleText(r, input.value.rounds, account.value);
}
// 휴대폰에서는 공유창(카카오톡·문자 등)을 띄우고, 지원하지 않으면 복사한다.
const canShare = ref(false); // 서버 렌더링과 어긋나지 않게 화면에 붙은 뒤 확인
onMounted(() => (canShare.value = 'share' in navigator));
async function share() {
  if (!ok.value) return;
  try {
    await navigator.share({ title: '더치페이 정산', text: shareText() });
  } catch (e) {
    if ((e as Error).name !== 'AbortError') await copy();
  }
}
async function copy() {
  if (!ok.value) return;
  try { await navigator.clipboard.writeText(shareText()); } catch { /* 복사 불가 환경 */ }
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}
</script>

<template>
  <div class="tabs" role="tablist">
    <button type="button" role="tab" :aria-selected="mode === 'simple'" @click="mode = 'simple'">총액 ÷ 인원</button>
    <button type="button" role="tab" :aria-selected="mode === 'rounds'" @click="mode = 'rounds'">차수별 (1차·2차)</button>
  </div>

  <div v-if="mode === 'simple'" class="row">
    <div class="field"><label for="tot">총 금액 (원)</label><input id="tot" v-model.number="total" type="number" min="0" inputmode="numeric" placeholder="예: 128000" /></div>
    <div class="field"><label for="cnt">인원</label><input id="cnt" v-model.number="count" type="number" min="1" max="100" inputmode="numeric" /></div>
  </div>

  <template v-else>
    <div class="field">
      <label for="names">참여자 이름 <small class="muted">(줄바꿈·쉼표로 구분, 비우면 1번~4번)</small></label>
      <textarea id="names" v-model="namesText" rows="2" class="textarea" placeholder="민수, 지현, 서준, 유나"></textarea>
    </div>
    <div v-for="(r, ri) in rounds" :key="ri" class="round">
      <div class="row">
        <div class="field"><label :for="'rn' + ri">이름</label><input :id="'rn' + ri" v-model="r.name" type="text" /></div>
        <div class="field"><label :for="'ra' + ri">금액 (원)</label><input :id="'ra' + ri" v-model.number="r.amount" type="number" min="0" inputmode="numeric" /></div>
      </div>
      <div class="chips" style="margin-top: 8px">
        <button v-for="(nm, i) in names" :key="i" type="button" class="chip" :class="{ on: r.payers.includes(i) }" @click="toggle(r, i)">{{ nm }}</button>
        <button v-if="rounds.length > 1" type="button" class="chip" style="margin-left: auto" @click="rounds.splice(ri, 1)">✕ 삭제</button>
      </div>
    </div>
    <button type="button" class="btn-sub" style="margin-top: 10px" @click="addRound">+ 차수 추가</button>
  </template>

  <div class="row" style="margin-top: 14px">
    <div class="field">
      <label>금액 단위</label>
      <div class="chips"><button v-for="u in ROUND_UNITS" :key="u" type="button" class="chip" :class="{ on: unit === u }" @click="unit = u">{{ u.toLocaleString() }}원</button></div>
    </div>
    <div class="field">
      <label>나머지 처리</label>
      <div class="chips">
        <button v-for="[k, l] in [['ceil', '올림'], ['round', '반올림'], ['floor', '내림']]" :key="k" type="button" class="chip" :class="{ on: how === k }" @click="how = k as any">{{ l }}</button>
      </div>
    </div>
  </div>

  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <template v-if="ok">
    <div class="result" aria-live="polite">
      <template v-if="mode === 'simple'">
        <div class="sub">1인당</div>
        <div class="big">{{ won(ok.perPerson[0]?.pay ?? 0) }}</div>
      </template>
      <div v-else class="table-wrap" style="margin-top: 0">
        <table class="table">
          <thead><tr><th>이름</th><th>참여</th><th>낼 돈</th></tr></thead>
          <tbody><tr v-for="p in ok.perPerson" :key="p.name"><td>{{ p.name }}</td><td>{{ p.rounds.join(', ') || '-' }}</td><td><b>{{ won(p.pay) }}</b></td></tr></tbody>
        </table>
      </div>
      <p class="sub" style="margin: 8px 0 0">
        총 {{ won(ok.total) }} · 걷는 돈 {{ won(ok.collected) }}
        <template v-if="ok.diff > 0"> · 총무에게 <b>{{ won(ok.diff) }}</b> 남아요</template>
        <template v-else-if="ok.diff < 0"> · 총무가 <b>{{ won(-ok.diff) }}</b> 더 내요</template>
      </p>
    </div>
    <div class="field" style="margin-top: 12px"><label for="acc">입금 계좌 (선택, 저장 안 됨)</label><input id="acc" v-model="account" type="text" placeholder="예: OO은행 000-0000-0000 홍길동" /></div>
    <div class="share-row">
      <button v-if="canShare" type="button" class="btn" @click="share">카톡으로 공유</button>
      <button type="button" :class="canShare ? 'btn-sub' : 'btn'" @click="copy">{{ copied ? '복사됐어요' : '정산 문구 복사' }}</button>
    </div>
  </template>
</template>

<style scoped>
.round { border: 1px solid var(--line); border-radius: 10px; padding: 12px; margin-top: 12px; }
.share-row { display: flex; gap: 8px; align-items: stretch; }
.share-row .btn { flex: 1; }
.share-row .btn-sub { margin-top: 16px; white-space: nowrap; }
</style>
