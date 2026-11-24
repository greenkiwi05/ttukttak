// QR코드·바코드에서 읽은 문자열 해석 (링크·와이파이·연락처 등) + 링크 주의점 판별. 인식 자체는 zxing-wasm이 한다.
// 링크는 http/https만 열 수 있게 하고, 나머지 스킴(javascript:, data:, 앱 스킴 등)은 글자로만 보여 준다.

/** 짧은 주소 서비스: 눌러 보기 전에는 실제 목적지를 알 수 없다 */
export const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'ow.ly', 'buly.kr', 'me2.do', 'han.gl', 'vo.la', 'url.kr', 'c11.kr', 'lrl.kr', 'abit.ly', 'rebrand.ly', 'cutt.ly', 'shorturl.at', 't.ly', 'qrco.de', 'me-qr.com', 'l.ead.me'];

const isIp = (host) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');

/**
 * 링크 주의점. 안전하다는 판정이 아니라 "눈여겨볼 점" 목록이다.
 * @returns {null | { href: string, host: string, warnings: string[] }} http/https가 아니면 null
 */
export function checkUrl(text) {
  let u;
  try { u = new URL(String(text ?? '').trim()); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  if (!host) return null;
  const bare = host.replace(/^www\./, '');
  const warnings = [];
  if (u.username || u.password) warnings.push('주소에 @가 들어 있어요. @ 앞의 글자는 진짜 사이트 이름이 아니에요.');
  if (isIp(host)) warnings.push('사이트 이름 대신 숫자(IP) 주소로 되어 있어요.');
  if (host.split('.').some((p) => p.startsWith('xn--'))) warnings.push('영문이 아닌 글자가 섞인 주소예요. 비슷한 글자로 유명 사이트를 흉내 낸 것은 아닌지 확인하세요.');
  if (SHORTENERS.some((s) => bare === s || bare.endsWith('.' + s))) warnings.push('짧은 주소라서 열기 전에는 실제 사이트를 알 수 없어요.');
  if (/\.(apk|exe|msi|dmg|bat|scr|ipa)$/i.test(u.pathname)) warnings.push('열면 앱·프로그램 파일을 내려받을 수 있어요.');
  if (u.port) warnings.push(`흔하지 않은 접속 번호(:${u.port})를 써요.`);
  if (u.protocol === 'http:') warnings.push('암호화되지 않은 주소(http)예요. 비밀번호나 카드 번호를 넣지 마세요.');
  return { href: u.href, host, warnings };
}

/** 'KEY:값;KEY:값;' 형식(WIFI:, MECARD:) 나누기. \ 로 이스케이프된 문자는 그대로 값에 넣는다 */
export function parseFields(body) {
  const out = [];
  let key = '', val = '', inVal = false;
  const push = () => { if (key) out.push([key.trim().toUpperCase(), val]); key = ''; val = ''; inVal = false; };
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\' && i + 1 < body.length) { const n = body[++i]; if (inVal) val += n; else key += n; continue; }
    if (c === ';') { push(); continue; }
    if (c === ':' && !inVal) { inVal = true; continue; }
    if (inVal) val += c; else key += c;
  }
  push();
  return out;
}

const first = (fields, key) => fields.find(([k]) => k === key)?.[1] ?? '';
const phoneHref = (n) => { const d = String(n).replace(/[^\d+*#]/g, ''); return /^\+?\d{3,15}$/.test(d) ? `tel:${d}` : null; };
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

function parseVcard(text) {
  // 줄 이어쓰기(다음 줄이 공백으로 시작)를 편다
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const get = (name) => {
    const l = lines.find((x) => new RegExp(`^(?:item\\d+\\.)?${name}(?:[;:])`, 'i').test(x));
    return l ? l.slice(l.indexOf(':') + 1).replace(/\\n/gi, ' ').replace(/\\([\\;,:])/g, '$1').trim() : '';
  };
  const n = get('FN') || get('N').split(';').filter(Boolean).join(' ');
  return { name: n, phone: get('TEL').replace(/^tel:/i, ''), email: get('EMAIL'), org: get('ORG').replace(/;/g, ' ').trim(), url: get('URL') };
}

/** 주소처럼 보이지만 https://가 빠진 글자 (example.com/abc). 공백이 있으면 글로 본다 */
const BARE_URL = /^(?:www\.)?(?:[a-z0-9-]+\.)+(?:com|net|org|kr|io|me|app|dev|site|shop|store|info|biz|link|page|gl|ly|co|tv|ai)(?:[/?#]\S*)?$/i;

const row = (label, value, secret = false) => ({ label, value, secret });

/**
 * 읽은 문자열 해석
 * @param {string} text
 * @param {{ barcode?: boolean }} [o] barcode: 상품 바코드 등 QR이 아닌 코드 (숫자를 전화번호·주소로 해석하지 않음)
 * @returns {{ kind: string, label: string, rows: { label:string, value:string, secret:boolean }[], href: string|null, action: string, copy: string, url: null|{ href:string, host:string, warnings:string[] } }}
 */
export function parseCode(text, { barcode = false } = {}) {
  const t = String(text ?? '');
  const s = t.trim();
  const make = (kind, label, rows, extra = {}) => ({ kind, label, rows: rows.filter((r) => r.value), href: null, action: '', copy: t, url: null, ...extra });
  if (barcode) return make('barcode', '바코드', [row('번호·내용', s)]);

  if (/^https?:\/\//i.test(s)) {
    const url = checkUrl(s);
    if (url) return make('url', '링크', [row('주소', s)], { href: url.href, action: '이 링크 열기', url });
  }
  if (/^URLTO:/i.test(s)) {
    const body = s.slice(6); const i = body.search(/:(?=https?:|www\.|[a-z0-9-]+\.)/i);
    const target = body.slice(i + 1); const url = checkUrl(/^https?:/i.test(target) ? target : `https://${target}`);
    if (url) return make('url', '링크', [row('주소', target)], { href: url.href, action: '이 링크 열기', url, copy: target });
  }
  if (/^WIFI:/i.test(s)) {
    const f = parseFields(s.slice(5));
    const sec = first(f, 'T');
    const pass = first(f, 'P');
    return make('wifi', '와이파이', [row('이름 (SSID)', first(f, 'S')), row('비밀번호', pass, true), row('보안 방식', !sec || /^nopass$/i.test(sec) ? '없음' : sec.toUpperCase())], { copy: pass || first(f, 'S') });
  }
  if (/^MECARD:/i.test(s)) {
    const f = parseFields(s.slice(7));
    return contact({ name: first(f, 'N').replace(/,/g, ' ').trim(), phone: first(f, 'TEL'), email: first(f, 'EMAIL'), org: first(f, 'ORG'), url: first(f, 'URL') });
  }
  if (/^BEGIN:VCARD/i.test(s)) return contact(parseVcard(s));
  if (/^tel:/i.test(s)) { const n = dec(s.slice(4)); return make('tel', '전화번호', [row('번호', n)], { href: phoneHref(n), action: '전화 걸기', copy: n }); }
  if (/^sms(?:to)?:/i.test(s)) {
    const m = s.match(/^sms(?:to)?:([^:?]*)(?::([\s\S]*)|\?body=([\s\S]*))?$/i) ?? [];
    const n = dec(m[1] ?? ''), body = m[2] ?? dec(m[3] ?? '');
    const tel = phoneHref(n);
    return make('sms', '문자', [row('받는 번호', n), row('내용', body)], { href: tel ? `sms:${tel.slice(4)}` : null, action: '문자 쓰기', copy: n });
  }
  if (/^mailto:/i.test(s)) {
    const [to, q = ''] = s.slice(7).split('?');
    const p = new URLSearchParams(q);
    const mail = dec(to);
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
    return make('email', '이메일', [row('받는 사람', mail), row('제목', p.get('subject') ?? ''), row('내용', p.get('body') ?? '')], { href: ok ? `mailto:${to}${q ? '?' + q : ''}` : null, action: '메일 쓰기', copy: mail });
  }
  if (/^geo:/i.test(s)) {
    const m = s.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
    if (m) return make('geo', '위치', [row('위도', m[1]), row('경도', m[2])], { copy: `${m[1]}, ${m[2]}` });
  }
  if (/^BEGIN:V(?:EVENT|CALENDAR)/i.test(s)) {
    const get = (k) => (s.match(new RegExp(`^${k}(?:;[^:\\n]*)?:(.*)$`, 'im'))?.[1] ?? '').trim();
    return make('event', '일정', [row('제목', get('SUMMARY')), row('시작', get('DTSTART')), row('끝', get('DTEND')), row('장소', get('LOCATION'))]);
  }
  if (BARE_URL.test(s)) {
    const url = checkUrl(`https://${s}`);
    if (url) return make('url', '링크', [row('주소', s)], { href: url.href, action: '이 링크 열기', url });
  }
  // 웹이 아닌 주소(앱 열기, javascript: 등)는 열지 않고 글자로만
  if (/^(?:javascript|data|vbscript|file|blob):/i.test(s)) return make('danger', '실행될 수 있는 내용', [row('내용', s)]);
  if (/^[a-z][a-z0-9+.-]{1,30}:\S+$/i.test(s)) return make('scheme', '앱 전용 주소', [row('내용', s)]);
  return make('text', '글자', [row('내용', t)]);

  function contact(c) {
    const url = c.url ? checkUrl(/^https?:/i.test(c.url) ? c.url : `https://${c.url}`) : null;
    return make('contact', '연락처', [row('이름', c.name), row('전화', c.phone), row('이메일', c.email), row('회사', c.org), row('홈페이지', c.url)], {
      href: phoneHref(c.phone), action: '전화 걸기', copy: [c.name, c.phone, c.email].filter(Boolean).join(' '), url,
    });
  }
}

/** 카메라 오류 → 안내 문구. 어떤 경우든 사진으로 읽는 방법으로 이어 준다 */
export function cameraMessage(name) {
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return '카메라 권한이 꺼져 있어요. 주소창 옆 설정(자물쇠) 아이콘에서 카메라를 허용하거나, 아래에 사진을 올려 주세요.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return '쓸 수 있는 카메라를 찾지 못했어요. QR코드가 있는 사진이나 캡처를 아래에 올려 주세요.';
    case 'NotReadableError':
    case 'AbortError':
      return '카메라를 켤 수 없어요. 다른 앱이 카메라를 쓰고 있는지 확인하거나, 아래에 사진을 올려 주세요.';
    case 'Unsupported':
      return '이 브라우저에서는 카메라를 쓸 수 없어요. 카카오톡 같은 앱 안이라면 크롬·사파리로 열거나, 아래에 사진을 올려 주세요.';
    default:
      return '카메라를 켜지 못했어요. QR코드가 있는 사진이나 캡처를 아래에 올려 주세요.';
  }
}

/** 같은 내용이 여러 번 잡힌 결과를 하나로 */
export function uniqueCodes(list) {
  const seen = new Set();
  return list.filter((c) => c.text && !seen.has(c.text) && seen.add(c.text));
}

/** 인식용으로 줄일 크기. 너무 크면 느리고, 작은 QR은 작게 줄이면 못 읽어서 큰 것부터 차례로 시도한다 */
export function scanSizes(w, h) {
  const long = Math.max(w, h);
  if (!(long > 0)) return [];
  return [2400, 1400, 800].filter((m, i, a) => i === 0 || long > m || a[i - 1] === undefined).map((m) => Math.min(1, m / long))
    .filter((s, i, a) => a.indexOf(s) === i);
}
