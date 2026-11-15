<script setup lang="ts">
// 제비뽑기·팀 나누기·순서 정하기 UI. 로직은 src/lib/randomPick.js, 난수는 crypto 기반.
import { ref, computed } from 'vue';
import { parseList, pick, teams, shuffle, duplicates } from '../../lib/randomPick.js';
import { cryptoRand } from '../../lib/ladder.js';

const MODES = [['pick', '당첨자 뽑기'], ['teams', '팀 나누기'], ['order', '순서 정하기']] as const;
const mode = ref<'pick' | 'teams' | 'order'>('pick');
const text = ref('');
const k = ref<number | ''>(1);
const n = ref<number | ''>(2);
const result = ref<{ winners?: string[]; teams?: string[][]; order?: string[]; error?: string } | null>(null);
const rolling = ref(false);

const list = computed(() => parseList(text.value));
const dup = computed(() => duplicates(list.value));

function run() {
  rolling.value = true;
  result.value = null;
  setTimeout(() => {
    if (mode.value === 'pick') result.value = pick(list.value, Number(k.value), cryptoRand);
    else if (mode.value === 'teams') result.value = teams(list.value, Number(n.value), cryptoRand);
    else result.value = list.value.length < 2 ? { error: '2명 이상 입력해 주세요.' } : { order: shuffle(list.value, cryptoRand) };
    rolling.value = false;
  }, 600);
}
</script>

<template>
  <div class="tabs" role="tablist">
    <button v-for="[id, l] in MODES" :key="id" type="button" role="tab" :aria-selected="mode === id" @click="mode = id; result = null">{{ l }}</button>
  </div>
  <div class="field">
    <label for="names">참가자 · 항목 <small class="muted">(줄바꿈이나 쉼표로 구분)</small></label>
    <textarea id="names" v-model="text" rows="6" class="textarea" placeholder="김민수&#10;이지현&#10;박서준&#10;최유나"></textarea>
    <small class="muted">{{ list.length }}명<template v-if="dup.length"> · 이름이 겹쳐요: {{ dup.join(', ') }}</template></small>
  </div>
  <div v-if="mode === 'pick'" class="field" style="margin-top: 12px"><label for="k">뽑을 인원</label><input id="k" v-model.number="k" type="number" min="1" /></div>
  <div v-if="mode === 'teams'" class="field" style="margin-top: 12px"><label for="n">팀 수</label><input id="n" v-model.number="n" type="number" min="2" /></div>

  <button class="btn" type="button" :disabled="rolling || !list.length" @click="run">{{ rolling ? '섞는 중…' : MODES.find((m) => m[0] === mode)![1] }}</button>

  <p v-if="result?.error" class="error" role="alert">{{ result.error }}</p>
  <div v-else-if="result" class="result" aria-live="polite">
    <template v-if="result.winners">
      <div class="sub">당첨</div>
      <div class="big">{{ result.winners.join(', ') }}</div>
    </template>
    <div v-else-if="result.teams" class="team-grid">
      <div v-for="(t, i) in result.teams" :key="i" class="team">
        <b>{{ i + 1 }}팀 ({{ t.length }}명)</b>
        <div>{{ t.join(', ') }}</div>
      </div>
    </div>
    <ol v-else-if="result.order" style="margin: 0; padding-left: 22px">
      <li v-for="x in result.order" :key="x" style="font-weight: 600">{{ x }}</li>
    </ol>
  </div>
  <p class="muted" style="margin: 10px 0 0">브라우저의 보안 난수(crypto)로 섞어서 누구에게도 유리하지 않아요.</p>
</template>

<style scoped>
.team-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
.team { background: #fff; border-radius: 10px; padding: 10px 12px; }
</style>
