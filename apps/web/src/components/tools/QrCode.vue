<script setup lang="ts">
// QR코드 만들기 UI. 문자열 조립은 src/lib/qr.js, QR 그리기는 qrcode-generator(동적 import).
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { buildQrData, QR_TYPES, EC_LEVELS } from '../../lib/qr.js';
import { downloadBlob } from '../../lib/download.js';

type T = keyof typeof QR_TYPES;
const type = ref<T>('url');
const f = reactive<Record<string, any>>({ url: '', text: '', ssid: '', password: '', security: 'WPA', hidden: false, phone: '', message: '', email: '', subject: '', body: '', name: '', org: '' });
const ec = ref('M');
const size = ref(512);
const fg = ref('#000000');
const bg = ref('#ffffff');
const svg = ref('');
const error = ref('');
let qrLib: any = null;

const built = computed(() => buildQrData(type.value, f));

function matrix() {
  const b = built.value;
  if (!qrLib || 'error' in b) return null;
  const q = qrLib(0, ec.value);
  q.addData(b.data, 'Byte');
  q.make();
  return q;
}

function render() {
  error.value = '';
  svg.value = '';
  const b = built.value;
  // 보안 방식(기본 WPA)은 사용자가 친 값이 아니므로 빼고 판단 — 처음 열었을 때 오류가 뜨지 않게
  const hasInput = Object.entries(f).some(([k, v]) => k !== 'security' && typeof v === 'string' && v.trim());
  if ('error' in b) { if (hasInput) error.value = b.error; return; }
  try {
    const q = matrix();
    if (!q) return;
    const n = q.getModuleCount(), quiet = 4, total = n + quiet * 2;
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) path += `M${c + quiet},${r + quiet}h1v1h-1z`;
    svg.value = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${bg.value}"/><path d="${path}" fill="${fg.value}"/></svg>`;
  } catch {
    error.value = '내용이 너무 길어서 QR코드에 담을 수 없어요. 내용을 줄이거나 오류 복원 수준을 낮춰 보세요.';
  }
}

onMounted(async () => {
  const mod: any = await import('qrcode-generator');
  qrLib = mod.default ?? mod;
  // 기본값은 Latin-1이라 한글이 깨진다 → UTF-8로 교체
  qrLib.stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s));
  render();
});
watch([built, ec, fg, bg], render);

function savePng() {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size.value;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, size.value, size.value);
    c.toBlob((b) => b && downloadBlob(b, 'qrcode.png'), 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.value);
}
const saveSvg = () => downloadBlob(new Blob([svg.value], { type: 'image/svg+xml' }), 'qrcode.svg');
</script>

<template>
  <div class="tabs" role="tablist">
    <button v-for="(label, k) in QR_TYPES" :key="k" type="button" role="tab" :aria-selected="type === k" @click="type = k">{{ label }}</button>
  </div>

  <div v-if="type === 'url'" class="field"><label for="u">링크 주소</label><input id="u" v-model="f.url" type="text" inputmode="url" placeholder="예: ttukttaktools.com" /></div>
  <div v-else-if="type === 'text'" class="field"><label for="t">내용</label><textarea id="t" v-model="f.text" rows="4" class="textarea"></textarea></div>
  <template v-else-if="type === 'wifi'">
    <div class="field"><label for="ssid">와이파이 이름 (SSID)</label><input id="ssid" v-model="f.ssid" type="text" /></div>
    <div class="field">
      <label>보안 방식</label>
      <div class="chips">
        <button v-for="s in [['WPA', 'WPA/WPA2/WPA3'], ['WEP', 'WEP'], ['nopass', '없음']]" :key="s[0]" type="button" class="chip" :class="{ on: f.security === s[0] }" @click="f.security = s[0]">{{ s[1] }}</button>
      </div>
    </div>
    <div v-if="f.security !== 'nopass'" class="field"><label for="pw">비밀번호</label><input id="pw" v-model="f.password" type="text" autocomplete="off" /></div>
    <label class="check"><input v-model="f.hidden" type="checkbox" /> 숨겨진 네트워크</label>
  </template>
  <template v-else-if="type === 'tel' || type === 'sms'">
    <div class="field"><label for="ph">전화번호</label><input id="ph" v-model="f.phone" type="tel" placeholder="예: 010-1234-5678" /></div>
    <div v-if="type === 'sms'" class="field"><label for="msg">문자 내용 (선택)</label><input id="msg" v-model="f.message" type="text" /></div>
  </template>
  <template v-else-if="type === 'email'">
    <div class="field"><label for="em">받는 이메일</label><input id="em" v-model="f.email" type="text" inputmode="email" /></div>
    <div class="field"><label for="sub">제목 (선택)</label><input id="sub" v-model="f.subject" type="text" /></div>
  </template>
  <template v-else>
    <div class="row">
      <div class="field"><label for="nm">이름</label><input id="nm" v-model="f.name" type="text" /></div>
      <div class="field"><label for="cph">전화번호</label><input id="cph" v-model="f.phone" type="tel" /></div>
    </div>
    <div class="row" style="margin-top: 14px">
      <div class="field"><label for="cem">이메일 (선택)</label><input id="cem" v-model="f.email" type="text" /></div>
      <div class="field"><label for="org">회사 (선택)</label><input id="org" v-model="f.org" type="text" /></div>
    </div>
  </template>

  <details style="margin-top: 14px; border: 0; padding: 0">
    <summary class="muted">색·크기·오류 복원 설정</summary>
    <div class="row" style="margin-top: 10px">
      <div class="field"><label for="fg">QR 색</label><input id="fg" v-model="fg" type="color" style="width: 100%; height: 44px" /></div>
      <div class="field"><label for="bg">배경색</label><input id="bg" v-model="bg" type="color" style="width: 100%; height: 44px" /></div>
    </div>
    <div class="row" style="margin-top: 10px">
      <div class="field">
        <label>오류 복원 수준</label>
        <div class="chips"><button v-for="l in EC_LEVELS" :key="l" type="button" class="chip" :class="{ on: ec === l }" @click="ec = l">{{ l }}</button></div>
      </div>
      <div class="field"><label for="sz">PNG 크기: {{ size }}px</label><input id="sz" v-model.number="size" type="range" min="256" max="2048" step="128" style="width: 100%" /></div>
    </div>
  </details>

  <p v-if="error" class="error" role="alert">{{ error }}</p>
  <div v-if="svg" class="result" style="text-align: center">
    <div v-html="svg" style="width: 220px; height: 220px; margin: 0 auto" aria-label="만들어진 QR코드"></div>
    <div style="display: flex; gap: 8px; justify-content: center; margin-top: 12px">
      <button type="button" class="btn-sub" @click="savePng">PNG 저장</button>
      <button type="button" class="btn-sub" @click="saveSvg">SVG 저장</button>
    </div>
    <p class="muted" style="margin: 10px 0 0">휴대폰 카메라로 비춰서 제대로 열리는지 꼭 확인하세요.</p>
  </div>
</template>
