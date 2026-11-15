// QR코드에 넣을 문자열 조립 (표준 형식). 그리기는 qrcode-generator가 한다.

export const QR_TYPES = {
  url: '링크',
  text: '텍스트',
  wifi: '와이파이',
  tel: '전화',
  sms: '문자',
  email: '이메일',
  contact: '연락처',
};

/** WIFI:/MECARD: 형식에서 특수문자 \ ; , : " 앞에 \ 를 붙인다 */
export const escapeQr = (s) => String(s ?? '').replace(/([\\;,:"])/g, '\\$1');

const digits = (s) => String(s ?? '').replace(/[^\d+]/g, '');

/**
 * @param {keyof typeof QR_TYPES} type
 * @param {Record<string, any>} f 입력값
 * @returns {{ data:string } | { error:string }}
 */
export function buildQrData(type, f = {}) {
  switch (type) {
    case 'url': {
      const u = String(f.url ?? '').trim();
      if (!u) return { error: '링크 주소를 입력해 주세요.' };
      return { data: /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}` };
    }
    case 'text': {
      const t = String(f.text ?? '');
      return t.trim() ? { data: t } : { error: '내용을 입력해 주세요.' };
    }
    case 'wifi': {
      const ssid = String(f.ssid ?? '');
      if (!ssid) return { error: '와이파이 이름(SSID)을 입력해 주세요.' };
      const sec = f.security === 'nopass' ? 'nopass' : f.security === 'WEP' ? 'WEP' : 'WPA';
      if (sec !== 'nopass' && !f.password) return { error: '비밀번호를 입력해 주세요. 비밀번호가 없으면 "없음"을 고르세요.' };
      const pass = sec === 'nopass' ? '' : `P:${escapeQr(f.password)};`;
      return { data: `WIFI:T:${sec};S:${escapeQr(ssid)};${pass}${f.hidden ? 'H:true;' : ''};` };
    }
    case 'tel': {
      const n = digits(f.phone);
      return n ? { data: `tel:${n}` } : { error: '전화번호를 입력해 주세요.' };
    }
    case 'sms': {
      const n = digits(f.phone);
      if (!n) return { error: '받는 번호를 입력해 주세요.' };
      return { data: `SMSTO:${n}:${f.message ?? ''}` };
    }
    case 'email': {
      const to = String(f.email ?? '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: '이메일 주소를 확인해 주세요.' };
      const q = [];
      if (f.subject) q.push(`subject=${encodeURIComponent(f.subject)}`);
      if (f.body) q.push(`body=${encodeURIComponent(f.body)}`);
      return { data: `mailto:${to}${q.length ? '?' + q.join('&') : ''}` };
    }
    case 'contact': {
      if (!String(f.name ?? '').trim()) return { error: '이름을 입력해 주세요.' };
      let s = `MECARD:N:${escapeQr(f.name)};`;
      if (f.phone) s += `TEL:${digits(f.phone)};`;
      if (f.email) s += `EMAIL:${escapeQr(f.email)};`;
      if (f.org) s += `ORG:${escapeQr(f.org)};`;
      if (f.url) s += `URL:${escapeQr(f.url)};`;
      return { data: s + ';' };
    }
    default:
      return { error: '종류를 골라 주세요.' };
  }
}

/** 오류 복원 수준 (L 7% · M 15% · Q 25% · H 30%) */
export const EC_LEVELS = ['L', 'M', 'Q', 'H'];
