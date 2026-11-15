// 사진 메타데이터(EXIF 등) 읽기·지우기. 다시 압축하지 않고 파일 바이트에서 해당 구간만 잘라낸다 → 화질 손실 없음.
// JPEG: APP1(EXIF·XMP), APP3~APP13(IPTC 등), APP15, COM(주석) 제거.
//       APP0(JFIF), APP2(ICC 색 프로필), APP14(Adobe 색 변환)는 화면 표시에 필요해서 남긴다.
//       회전 정보(Orientation)가 1이 아니면 그것만 담은 최소 EXIF를 다시 넣어 사진이 눕지 않게 한다.
// PNG: eXIf·tEXt·iTXt·zTXt·tIME 청크 제거.

const JPEG_KEEP = new Set([0xe0, 0xe2, 0xee]);

export function fileKind(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  return null;
}

/** JPEG 세그먼트 목록 (SOS 전까지). [{ marker, start, end }] end는 세그먼트 끝(다음 시작) */
function jpegSegments(b) {
  const segs = [];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new Error('JPEG 구조를 읽지 못했어요.');
    let marker = b[i + 1];
    while (marker === 0xff) { i++; marker = b[i + 1]; } // 채움 바이트
    if (marker === 0xda || marker === 0xd9) { segs.push({ marker, start: i, end: b.length, tail: true }); break; }
    if (marker >= 0xd0 && marker <= 0xd7) { i += 2; continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    segs.push({ marker, start: i, end: i + 2 + len });
    i += 2 + len;
  }
  return segs;
}

// ── TIFF(EXIF) 읽기
function readTiff(b, base) {
  const le = b[base] === 0x49; // 'II'
  const u16 = (o) => (le ? b[base + o] | (b[base + o + 1] << 8) : (b[base + o] << 8) | b[base + o + 1]);
  const u32 = (o) => (le ? (b[base + o] | (b[base + o + 1] << 8) | (b[base + o + 2] << 16)) + b[base + o + 3] * 2 ** 24 : b[base + o] * 2 ** 24 + ((b[base + o + 1] << 16) | (b[base + o + 2] << 8) | b[base + o + 3]));
  const readIfd = (off) => {
    const out = {};
    if (!off || base + off + 2 > b.length) return out;
    const n = u16(off);
    for (let k = 0; k < n; k++) {
      const e = off + 2 + k * 12;
      if (base + e + 12 > b.length) break;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      const size = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 }[type] ?? 1;
      const vo = size * count <= 4 ? e + 8 : u32(e + 8);
      if (base + vo + size * count > b.length) continue;
      if (type === 2) out[tag] = String.fromCharCode(...b.subarray(base + vo, base + vo + count)).replace(/\0+$/, '').trim();
      else if (type === 3) out[tag] = count === 1 ? u16(vo) : Array.from({ length: count }, (_, j) => u16(vo + 2 * j));
      else if (type === 4) out[tag] = count === 1 ? u32(vo) : Array.from({ length: count }, (_, j) => u32(vo + 4 * j));
      else if (type === 5) out[tag] = Array.from({ length: count }, (_, j) => { const d = u32(vo + 8 * j + 4); return d ? u32(vo + 8 * j) / d : 0; });
    }
    return out;
  };
  const ifd0 = readIfd(u32(4));
  const exif = ifd0[0x8769] ? readIfd(ifd0[0x8769]) : {};
  const gps = ifd0[0x8825] ? readIfd(ifd0[0x8825]) : {};
  return { ifd0, exif, gps };
}

const dms = (a) => (Array.isArray(a) && a.length === 3 ? a[0] + a[1] / 60 + a[2] / 3600 : null);

/**
 * 사진에서 눈에 띄는 메타데이터를 요약한다.
 * @param {Uint8Array} b
 * @returns {{ kind:'jpeg'|'png'|null, found:string[], gps:{lat:number,lon:number}|null, make?:string, model?:string, date?:string, software?:string, orientation:number }}
 */
export function readMeta(b) {
  const kind = fileKind(b);
  const res = { kind, found: [], gps: null, orientation: 1 };
  if (kind === 'png') {
    for (const c of pngChunks(b)) if (PNG_DROP.has(c.type)) res.found.push(`PNG ${c.type}`);
    return res;
  }
  if (kind !== 'jpeg') return res;
  for (const s of jpegSegments(b)) {
    if (s.tail) break;
    const isExif = s.marker === 0xe1 && String.fromCharCode(...b.subarray(s.start + 4, s.start + 8)) === 'Exif';
    if (isExif) {
      res.found.push('EXIF');
      try {
        const t = readTiff(b, s.start + 10);
        res.make = t.ifd0[0x010f]; res.model = t.ifd0[0x0110]; res.software = t.ifd0[0x0131];
        res.date = t.exif[0x9003] || t.ifd0[0x0132];
        if (typeof t.ifd0[0x0112] === 'number') res.orientation = t.ifd0[0x0112];
        const lat = dms(t.gps[2]), lon = dms(t.gps[4]);
        if (lat !== null && lon !== null && (lat || lon)) {
          res.gps = { lat: t.gps[1] === 'S' ? -lat : lat, lon: t.gps[3] === 'W' ? -lon : lon };
        }
      } catch { /* 깨진 EXIF는 요약만 생략 */ }
    } else if (s.marker === 0xe1) res.found.push('XMP');
    else if (s.marker === 0xed) res.found.push('IPTC');
    else if (s.marker === 0xfe) res.found.push('주석');
    else if (s.marker >= 0xe0 && s.marker <= 0xef && !JPEG_KEEP.has(s.marker)) res.found.push(`APP${s.marker - 0xe0}`);
  }
  return res;
}

/** 회전 정보만 담은 최소 EXIF APP1 세그먼트 */
export function orientationApp1(o) {
  const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o & 0xff, 0, 0, 0, 0, 0, 0];
  const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = body.length + 2;
  return new Uint8Array([0xff, 0xe1, len >> 8, len & 0xff, ...body]);
}

/**
 * @param {Uint8Array} b
 * @param {{ keepOrientation?: boolean }} [opt]
 * @returns {Uint8Array}
 */
export function stripMeta(b, { keepOrientation = true } = {}) {
  const kind = fileKind(b);
  if (kind === 'png') return stripPng(b);
  if (kind !== 'jpeg') throw new Error('JPG 또는 PNG 파일만 처리할 수 있어요.');
  const { orientation } = readMeta(b);
  const parts = [b.subarray(0, 2)];
  let inserted = !(keepOrientation && orientation > 1 && orientation <= 8);
  for (const s of jpegSegments(b)) {
    const keep = s.tail || JPEG_KEEP.has(s.marker) || s.marker < 0xe0 || (s.marker > 0xef && s.marker !== 0xfe);
    // 최소 EXIF는 APP0(JFIF) 바로 뒤, 없으면 맨 앞에 넣는다
    if (!inserted && s.marker !== 0xe0) { parts.push(orientationApp1(orientation)); inserted = true; }
    if (keep) parts.push(b.subarray(s.start, s.end));
  }
  if (!inserted) parts.push(orientationApp1(orientation));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ── PNG
const PNG_DROP = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);
function pngChunks(b) {
  const out = [];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    out.push({ type, start: i, end: i + 12 + len });
    i += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}
function stripPng(b) {
  const keep = pngChunks(b).filter((c) => !PNG_DROP.has(c.type));
  const out = new Uint8Array(8 + keep.reduce((n, c) => n + (c.end - c.start), 0));
  out.set(b.subarray(0, 8));
  let o = 8;
  for (const c of keep) { out.set(b.subarray(c.start, c.end), o); o += c.end - c.start; }
  return out;
}
