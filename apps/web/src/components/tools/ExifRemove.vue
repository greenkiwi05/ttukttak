<script setup lang="ts">
// 사진 위치정보(EXIF) 지우기 UI. 로직은 src/lib/exif.js — 다시 압축하지 않고 메타데이터 구간만 잘라낸다.
import { ref, computed } from 'vue';
import { filterFiles, uniqueNames } from '../../lib/files.js';
import { readMeta, stripMeta } from '../../lib/exif.js';
import { formatBytes } from '../../lib/compress.js';
import { downloadBlob, downloadZip } from '../../lib/download.js';

type Item = { file: File; meta?: ReturnType<typeof readMeta>; out?: Blob; error?: string };
const items = ref<Item[]>([]);
const rejected = ref<string[]>([]);
const keepOrientation = ref(true);
const over = ref(false);

const outNames = computed(() => uniqueNames(items.value.map((i) => i.file.name.replace(/(\.[^.]+)$/, '_clean$1'))));
const done = computed(() => items.value.filter((i) => i.out));

async function add(list: FileList | null | undefined) {
  if (!list) return;
  const r = filterFiles([...list], { exts: ['jpg', 'jpeg', 'png'], maxSize: 100 * 1024 * 1024, maxCount: 50, already: items.value.length });
  rejected.value = r.rejected.map((x: { file: File; reason: string }) => `${x.file.name}: ${x.reason}`);
  for (const file of r.accepted as File[]) {
    const it: Item = { file };
    try {
      it.meta = readMeta(new Uint8Array(await file.arrayBuffer()));
      if (!it.meta.kind) it.error = 'JPG·PNG 형식이 아니에요';
    } catch {
      it.error = '파일을 읽지 못했어요';
    }
    items.value.push(it);
  }
}

async function clean() {
  for (const it of items.value) {
    if (it.error) continue;
    try {
      const bytes = stripMeta(new Uint8Array(await it.file.arrayBuffer()), { keepOrientation: keepOrientation.value });
      it.out = new Blob([bytes as BlobPart], { type: it.file.type || (it.meta?.kind === 'png' ? 'image/png' : 'image/jpeg') });
    } catch (e) {
      it.error = (e as Error).message;
    }
  }
}

const saveOne = (i: number) => downloadBlob(items.value[i].out!, outNames.value[i]);
const saveZip = () => downloadZip(items.value.map((it, i) => ({ it, name: outNames.value[i] })).filter((x) => x.it.out).map((x) => ({ name: x.name, blob: x.it.out! })), 'photos_clean.zip');
const coord = (n: number) => n.toFixed(5);
const mapUrl = (g: { lat: number; lon: number }) => `https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lon}#map=15/${g.lat}/${g.lon}`;
</script>

<template>
  <label class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; add($event.dataTransfer?.files)">
    <input type="file" accept="image/jpeg,image/png" multiple @change="add(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
    <strong>사진을 끌어다 놓거나 눌러서 고르세요</strong><br />
    <small class="muted">JPG · PNG, 여러 장 가능 · 서버로 올라가지 않아요</small>
  </label>
  <p v-for="r in rejected" :key="r" class="error" style="margin: 6px 0 0">{{ r }}</p>

  <template v-if="items.length">
    <ul class="file-list">
      <li v-for="(it, i) in items" :key="i" style="flex-wrap: wrap; align-items: flex-start">
        <span class="name" style="flex-basis: 100%; white-space: normal"><b>{{ it.file.name }}</b> <small class="muted">{{ formatBytes(it.file.size) }}</small></span>
        <div v-if="it.error" class="error" style="margin: 0">{{ it.error }}</div>
        <div v-else-if="it.meta" style="flex: 1; font-size: .9rem">
          <div v-if="it.meta.gps" style="color: #c92a2a">
            📍 위치정보 있음: {{ coord(it.meta.gps.lat) }}, {{ coord(it.meta.gps.lon) }}
            (<a :href="mapUrl(it.meta.gps)" target="_blank" rel="noopener">지도에서 보기</a>)
          </div>
          <div v-else class="muted">위치정보 없음</div>
          <div v-if="it.meta.make || it.meta.model" class="muted">📷 {{ [it.meta.make, it.meta.model].filter(Boolean).join(' ') }}</div>
          <div v-if="it.meta.date" class="muted">🕒 {{ it.meta.date }}</div>
          <div class="muted">발견: {{ it.meta.found.length ? it.meta.found.join(', ') : '지울 메타데이터 없음' }}</div>
        </div>
        <button v-if="it.out" type="button" class="btn-sub" @click="saveOne(i)">저장 ({{ formatBytes(it.out.size) }})</button>
      </li>
    </ul>
    <label class="check"><input v-model="keepOrientation" type="checkbox" /> 사진 회전 정보는 남기기 (끄면 일부 사진이 옆으로 누워 보일 수 있어요)</label>
    <button class="btn" type="button" @click="clean">메타데이터 지우기</button>
    <div style="display: flex; gap: 8px; margin-top: 10px">
      <button v-if="done.length > 1" type="button" class="btn-sub" @click="saveZip">전체 ZIP 저장 ({{ done.length }}장)</button>
      <button type="button" class="btn-sub" @click="items = []; rejected = []">목록 비우기</button>
    </div>
    <p class="notice">지도 링크는 누를 때만 OpenStreetMap으로 좌표가 전달돼요. 사진 파일 자체는 어디에도 올라가지 않아요.</p>
  </template>
</template>
