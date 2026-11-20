<script setup lang="ts">
// 학점(평점) 계산기 UI. 로직은 src/lib/gpa.js.
// 입력한 과목 목록은 다시 열었을 때 이어서 쓰도록 이 기기의 브라우저에만 저장한다(서버 전송 없음).
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { gradesOf, calcGpa, combine, convertScale, neededGpa, fmt } from '../../lib/gpa.js';

type Scale = '4.5' | '4.3';
type Row = { name: string; credit: number | ''; grade: string; major: boolean };
const KEY = 'ttukttak:gpa';
const blank = (): Row => ({ name: '', credit: 3, grade: '', major: false });

const tab = ref<'calc' | 'target' | 'convert'>('calc');
const scale = ref<Scale>('4.5');
const rows = ref<Row[]>(Array.from({ length: 6 }, blank));
const prev = reactive<{ gpa: number | ''; credits: number | '' }>({ gpa: '', credits: '' });
const showPrev = ref(false);
const loaded = ref(false);

onMounted(() => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) {
      if (s.scale === '4.5' || s.scale === '4.3') scale.value = s.scale;
      if (Array.isArray(s.rows) && s.rows.length) rows.value = s.rows.slice(0, 40).map((r: Partial<Row>) => ({ ...blank(), ...r }));
      if (s.prev) { prev.gpa = s.prev.gpa ?? ''; prev.credits = s.prev.credits ?? ''; showPrev.value = prev.credits !== ''; }
    }
  } catch { /* 저장 불가 */ }
  loaded.value = true;
});
watch([scale, rows, prev], () => {
  if (!loaded.value) return;
  try { localStorage.setItem(KEY, JSON.stringify({ scale: scale.value, rows: rows.value, prev })); } catch { /* 저장 불가 */ }
}, { deep: true });

const grades = computed(() => gradesOf(scale.value));
// 만점을 바꾸면 그 만점에 없는 등급(A- 등)은 비운다
watch(scale, () => { for (const r of rows.value) if (r.grade && !grades.value.includes(r.grade)) r.grade = ''; });

const result = computed(() => calcGpa(rows.value, scale.value));
const total = computed(() => (showPrev.value ? combine(prev.gpa, prev.credits, result.value.gpa, result.value.gpaCredits) : null));
const max = computed(() => Number(scale.value));

function addRow() { if (rows.value.length < 40) rows.value.push(blank()); }
function removeRow(i: number) { rows.value.splice(i, 1); if (!rows.value.length) rows.value.push(blank()); }
function reset() { rows.value = Array.from({ length: 6 }, blank); prev.gpa = ''; prev.credits = ''; }

// 목표 학점
const t = reactive<{ gpa: number | ''; credits: number | ''; target: number | ''; remain: number | '' }>({ gpa: '', credits: '', target: '', remain: '' });
function fillFromCalc() {
  const src = total.value ?? (result.value.gpa !== null ? { gpa: result.value.gpa, credits: result.value.gpaCredits } : null);
  if (src) { t.gpa = Number(fmt(src.gpa)); t.credits = src.credits; }
}
const need = computed(() => neededGpa(t.gpa, t.credits, t.target, t.remain, max.value));

// 만점 환산
const SCALE_OPTS = ['4.5', '4.3', '4.0', '100'];
const cv = reactive({ gpa: '' as number | '', from: '4.5', to: '4.3' });
const converted = computed(() => convertScale(cv.gpa, cv.from, cv.to));
</script>

<template>
  <div class="tabs" role="tablist">
    <button type="button" role="tab" :aria-selected="tab === 'calc'" @click="tab = 'calc'">학점 계산</button>
    <button type="button" role="tab" :aria-selected="tab === 'target'" @click="tab = 'target'">목표 학점</button>
    <button type="button" role="tab" :aria-selected="tab === 'convert'" @click="tab = 'convert'">만점 환산</button>
  </div>

  <div class="field">
    <label>만점 기준</label>
    <div class="chips">
      <button v-for="s in (['4.5', '4.3'] as Scale[])" :key="s" type="button" class="chip" :class="{ on: scale === s }" @click="scale = s">{{ s }} 만점</button>
    </div>
  </div>

  <template v-if="tab === 'calc'">
    <div class="g-head" aria-hidden="true"><span>과목</span><span>학점</span><span>성적</span><span>전공</span><span></span></div>
    <div v-for="(r, i) in rows" :key="i" class="g-row">
      <input v-model="r.name" type="text" :placeholder="`과목 ${i + 1}`" :aria-label="`${i + 1}번째 과목 이름`" />
      <input v-model.number="r.credit" type="number" min="0.5" max="30" step="0.5" inputmode="decimal" :aria-label="`${i + 1}번째 과목 학점`" />
      <select v-model="r.grade" :aria-label="`${i + 1}번째 과목 성적`">
        <option value="">-</option>
        <option v-for="g in grades" :key="g" :value="g">{{ g }}</option>
      </select>
      <input v-model="r.major" type="checkbox" class="g-major" :aria-label="`${i + 1}번째 과목 전공 여부`" />
      <button type="button" class="g-del" :aria-label="`${i + 1}번째 과목 지우기`" @click="removeRow(i)">✕</button>
    </div>
    <div class="g-actions">
      <button type="button" class="btn-sub" @click="addRow">+ 과목 추가</button>
      <button type="button" class="btn-sub" @click="reset">모두 지우기</button>
    </div>

    <label class="check"><input v-model="showPrev" type="checkbox" /> 이전 학기까지의 누적 학점도 합치기</label>
    <div v-if="showPrev" class="row" style="margin-top: 10px">
      <div class="field"><label for="pg">지난 학기까지 평점</label><input id="pg" v-model.number="prev.gpa" type="number" min="0" :max="max" step="0.01" inputmode="decimal" placeholder="예: 3.72" /></div>
      <div class="field"><label for="pc">평점 반영 학점</label><input id="pc" v-model.number="prev.credits" type="number" min="0" step="1" inputmode="numeric" placeholder="예: 60" /></div>
    </div>

    <div class="result" aria-live="polite">
      <div class="sub">{{ total ? '이번 학기 평점' : '평점 평균' }}</div>
      <div class="big">{{ fmt(result.gpa) }} <small class="of">/ {{ scale }}</small></div>
      <div class="sub">평점 반영 {{ result.gpaCredits }}학점 · 이수(취득) {{ result.earned }}학점</div>
      <div v-if="result.major.credits" class="sub">전공 평점 {{ fmt(result.major.gpa) }} ({{ result.major.credits }}학점)</div>
      <template v-if="total">
        <hr />
        <div class="sub">누적 평점</div>
        <div class="big">{{ fmt(total.gpa) }} <small class="of">/ {{ scale }}</small></div>
        <div class="sub">평점 반영 {{ total.credits }}학점 기준</div>
      </template>
    </div>
    <p class="notice">P(통과)는 이수학점에만, F는 평점에만 들어가요. 등급별 점수와 소수점 처리(반올림·버림)는 학교마다 다를 수 있어요.</p>
  </template>

  <template v-else-if="tab === 'target'">
    <div class="row">
      <div class="field"><label for="tg">지금 누적 평점</label><input id="tg" v-model.number="t.gpa" type="number" min="0" :max="max" step="0.01" inputmode="decimal" placeholder="예: 3.5" /></div>
      <div class="field"><label for="tc">평점 반영 학점</label><input id="tc" v-model.number="t.credits" type="number" min="0" inputmode="numeric" placeholder="예: 60" /></div>
    </div>
    <div class="row" style="margin-top: 14px">
      <div class="field"><label for="tt">목표 평점</label><input id="tt" v-model.number="t.target" type="number" min="0" :max="max" step="0.01" inputmode="decimal" placeholder="예: 3.8" /></div>
      <div class="field"><label for="tr">남은 학점</label><input id="tr" v-model.number="t.remain" type="number" min="1" inputmode="numeric" placeholder="예: 60" /></div>
    </div>
    <button type="button" class="btn-sub" style="margin-top: 12px" @click="fillFromCalc">학점 계산 탭 결과 불러오기</button>
    <div v-if="need" class="result" aria-live="polite">
      <template v-if="need.done">
        <div class="big">이미 목표 이상이에요</div>
        <div class="sub">남은 학점을 모두 F로 받아도 목표 평점을 넘어요.</div>
      </template>
      <template v-else>
        <div class="sub">남은 {{ t.remain }}학점에서 받아야 할 평균</div>
        <div class="big">{{ fmt(need.need) }} <small class="of">/ {{ scale }}</small></div>
        <div v-if="!need.possible" class="error">만점({{ scale }})을 받아도 목표에 닿지 않아요. 목표를 낮추거나 남은 학점을 늘려 보세요.</div>
      </template>
    </div>
  </template>

  <template v-else>
    <div class="field" style="margin-top: 14px"><label for="cg">내 평점</label><input id="cg" v-model.number="cv.gpa" type="number" min="0" step="0.01" inputmode="decimal" placeholder="예: 3.9" /></div>
    <div class="row" style="margin-top: 14px">
      <div class="field"><label for="cf">지금 만점</label><select id="cf" v-model="cv.from"><option v-for="s in SCALE_OPTS" :key="s" :value="s">{{ s }} 만점</option></select></div>
      <div class="field"><label for="ct">바꿀 만점</label><select id="ct" v-model="cv.to"><option v-for="s in SCALE_OPTS" :key="s" :value="s">{{ s }} 만점</option></select></div>
    </div>
    <div v-if="converted !== null" class="result" aria-live="polite">
      <div class="sub">{{ cv.from }} 만점 {{ cv.gpa }} → {{ cv.to }} 만점으로 바꾸면</div>
      <div class="big">{{ fmt(converted) }} <small class="of">/ {{ cv.to }}</small></div>
    </div>
    <p v-else-if="cv.gpa !== '' && Number(cv.gpa) > Number(cv.from)" class="error">평점이 만점({{ cv.from }})보다 커요.</p>
    <p class="notice">만점 비율 그대로 바꾼 값이에요. 회사·대학원은 학교가 발급한 공식 환산표나 자체 기준을 쓰는 경우가 많으니 지원하는 곳의 안내를 확인하세요.</p>
  </template>
</template>

<style scoped>
.g-head, .g-row { display: grid; grid-template-columns: minmax(0, 1fr) 62px 74px 34px 30px; gap: 6px; align-items: center; }
.g-head { margin-top: 16px; font-size: .85rem; color: var(--muted); font-weight: 600; }
.g-head span:nth-child(4) { text-align: center; }
.g-row { margin-top: 6px; }
.g-row input[type='text'], .g-row input[type='number'], .g-row select { min-width: 0; width: 100%; padding-left: 8px; padding-right: 6px; }
.g-major { width: 20px; height: 20px; justify-self: center; accent-color: var(--accent); }
.g-del { border: 0; background: transparent; color: var(--muted); font-size: 1rem; cursor: pointer; min-height: 40px; }
.g-del:hover { color: var(--text); }
.g-actions { display: flex; gap: 8px; margin-top: 10px; }
.of { font-size: 1rem; font-weight: 600; color: var(--muted); }
.result hr { border: 0; border-top: 1px solid rgba(0, 0, 0, .08); margin: 12px 0; }
</style>
