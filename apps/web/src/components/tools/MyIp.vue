<script setup lang="ts">
// 내 IP 확인 UI. IP·통신사·대략적 위치는 /api/ip(Cloudflare가 아는 접속 정보)를 그대로 보여 주고,
// 브라우저·운영체제·화면 크기는 브라우저 안에서 알아낸다. 아무것도 저장하지 않는다.
import { ref, computed, onMounted } from 'vue';
import { ipVersion, parseUA, countryName } from '../../lib/myIp.js';

type Info = { ip: string | null; country: string | null; region: string | null; city: string | null; isp: string | null; asn: number | null };
const info = ref<Info | null>(null);
const error = ref('');
const loading = ref(false);
const copied = ref(false);
const env = ref<{ browser: string; os: string; screen: string; lang: string } | null>(null);

async function load() {
  loading.value = true;
  error.value = '';
  copied.value = false;
  try {
    const r = await fetch('/api/ip', { cache: 'no-store' });
    const d = await r.json();
    if (!r.ok || !d.ip) throw new Error(d.error || 'IP를 알 수 없어요');
    info.value = d;
  } catch {
    info.value = null;
    error.value = 'IP 주소를 불러오지 못했어요. 잠시 후 다시 확인을 눌러 주세요.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const { browser, os } = parseUA(navigator.userAgent);
  env.value = { browser, os, screen: `${screen.width}×${screen.height}`, lang: navigator.language || '' };
  load();
});

const version = computed(() => (info.value?.ip ? ipVersion(info.value.ip) : null));
const place = computed(() => {
  const i = info.value;
  if (!i) return '';
  const where = [i.city, i.region].filter((v, k, a) => v && a.indexOf(v) === k).join(', ');
  const c = countryName(i.country);
  return [c, where].filter(Boolean).join(' · ');
});

async function copy() {
  if (!info.value?.ip) return;
  try { await navigator.clipboard.writeText(info.value.ip); copied.value = true; setTimeout(() => (copied.value = false), 1500); } catch { /* 복사 불가 환경 */ }
}
</script>

<template>
  <div class="result" aria-live="polite">
    <div class="sub">내 공인 IP 주소</div>
    <div v-if="info?.ip" class="big ip" :class="{ long: info.ip.length > 15 }">{{ info.ip }}</div>
    <div v-else-if="loading" class="big">확인하는 중…</div>
    <div v-else class="error">{{ error }}</div>
    <div v-if="version" class="sub">IPv{{ version }} 주소예요</div>
    <div class="actions">
      <button type="button" class="btn" :disabled="!info?.ip" @click="copy">{{ copied ? '복사했어요' : 'IP 복사' }}</button>
      <button type="button" class="btn-sub" :disabled="loading" @click="load">다시 확인</button>
    </div>
  </div>

  <div class="table-wrap">
    <table class="table">
      <tbody>
        <tr><th scope="row">통신사</th><td>{{ info?.isp ?? '-' }}<span v-if="info?.asn" class="asn"> (AS{{ info.asn }})</span></td></tr>
        <tr><th scope="row">대략적인 위치</th><td>{{ place || '-' }}</td></tr>
        <tr><th scope="row">브라우저</th><td>{{ env?.browser ?? '-' }}</td></tr>
        <tr><th scope="row">운영체제</th><td>{{ env?.os ?? '-' }}</td></tr>
        <tr><th scope="row">화면 크기</th><td>{{ env?.screen ?? '-' }}</td></tr>
      </tbody>
    </table>
  </div>
  <p class="note">위치는 통신사 정보로 짐작한 값이라 실제 위치와 다를 수 있어요. 이 정보는 저장하지 않아요.</p>
</template>

<style scoped>
.ip { word-break: break-all; }
.ip.long { font-size: 1.25rem; line-height: 1.4; }
.actions { display: flex; gap: 8px; margin-top: 14px; }
.actions > * { flex: 1; width: auto; margin-top: 0; }
.table th { text-align: left; width: 34%; background: var(--bg); }
.table td { white-space: normal; word-break: keep-all; overflow-wrap: anywhere; }
.asn { color: var(--muted, #888); white-space: nowrap; }
.note { font-size: .88rem; color: var(--muted, #6b6a65); margin-top: 10px; }
</style>
