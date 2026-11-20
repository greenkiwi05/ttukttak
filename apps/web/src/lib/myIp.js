// 내 IP 확인: IP 종류 판별, 브라우저·운영체제 알아보기(User-Agent), 국가 코드 → 한국어 이름.
// IP 자체는 /api/ip가 알려 주고, 나머지는 모두 브라우저 안에서 계산한다.

/** IPv4면 4, IPv6면 6, 아니면 null */
export function ipVersion(ip) {
  if (typeof ip !== 'string') return null;
  const s = ip.trim();
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) return m.slice(1).every((n) => Number(n) <= 255 && String(Number(n)) === n) ? 4 : null;
  if (s.includes(':') && /^[0-9a-f:.]+$/i.test(s)) {
    const parts = s.split('::');
    if (parts.length > 2) return null;
    const groups = s.replace('::', ':').split(':').filter(Boolean);
    if (groups.some((g) => !g.includes('.') && g.length > 4)) return null;
    if (parts.length === 1 && groups.length !== 8 && !s.includes('.')) return null;
    return 6;
  }
  return null;
}

/** 사설·특수 IP인지 (공유기 안쪽 주소 등) */
export function isPrivateIp(ip) {
  const v = ipVersion(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    return s === '::1' || /^f[cd]/.test(s) || /^fe[89ab]/.test(s);
  }
  return false;
}

const BROWSERS = [
  [/KAKAOTALK/i, '카카오톡 앱 안 브라우저'],
  [/NAVER\(inapp|NAVER\//, '네이버 앱 안 브라우저'],
  [/Whale\/([\d.]+)/, '네이버 웨일'],
  [/SamsungBrowser\/([\d.]+)/, '삼성 인터넷'],
  [/Edg(?:e|A|iOS)?\/([\d.]+)/, 'Microsoft Edge'],
  [/(?:OPR|Opera)\/([\d.]+)/, 'Opera'],
  [/(?:Firefox|FxiOS)\/([\d.]+)/, 'Firefox'],
  [/(?:Chrome|CriOS)\/([\d.]+)/, 'Chrome'],
  [/Version\/([\d.]+).*Safari/, 'Safari'],
];

/** User-Agent에서 브라우저와 운영체제 이름 */
export function parseUA(ua = '') {
  let browser = '알 수 없음';
  for (const [re, name] of BROWSERS) {
    const m = ua.match(re);
    if (m) { browser = m[1] ? `${name} ${m[1].split('.')[0]}` : name; break; }
  }
  let os = '알 수 없음';
  let m;
  if ((m = ua.match(/(?:iPhone|iPod).*?OS (\d+)[_.]?(\d+)?/))) os = `iOS ${m[1]}${m[2] ? '.' + m[2] : ''} (iPhone)`;
  else if ((m = ua.match(/iPad.*?OS (\d+)[_.]?(\d+)?/))) os = `iPadOS ${m[1]}${m[2] ? '.' + m[2] : ''}`;
  else if ((m = ua.match(/Android ([\d.]+)/))) os = `Android ${m[1]}`;
  else if (/Windows NT 10\.0/.test(ua)) os = 'Windows 10 또는 11';
  else if ((m = ua.match(/Windows NT ([\d.]+)/))) os = ({ '6.3': 'Windows 8.1', '6.2': 'Windows 8', '6.1': 'Windows 7' })[m[1]] ?? 'Windows';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return { browser, os };
}

/** 국가 코드(KR) → 한국어 이름(대한민국). 모르면 코드 그대로 */
export function countryName(code) {
  if (!code) return null;
  try { return new Intl.DisplayNames(['ko'], { type: 'region' }).of(code) ?? code; } catch { return code; }
}
