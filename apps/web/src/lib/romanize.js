// 한글 이름 → 로마자 (순수 로직).
// 기준: 국어의 로마자 표기법(2000년 고시). 이름은 소리 나는 대로 바꾸지 않고(음운 변화 미반영) 글자 그대로 옮긴다.
//  예) 한복남 → Han Boknam (Han Bongnam 아님). 이름 음절 사이 붙임표(-)는 써도 되고 안 써도 된다.
// 성은 관례 표기(Kim, Lee, Park…)가 널리 쓰여서 후보를 함께 보여 준다.

const INI = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const MED = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
//          ''  ㄱ   ㄲ   ㄳ   ㄴ   ㄵ   ㄶ   ㄷ   ㄹ   ㄺ   ㄻ   ㄼ   ㄽ   ㄾ   ㄿ   ㅀ   ㅁ   ㅂ   ㅄ   ㅅ   ㅆ   ㅇ    ㅈ   ㅊ   ㅋ   ㅌ   ㅍ   ㅎ
const FIN = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
const RIEUL_FIN = 8, RIEUL_INI = 5;

/** 관례적으로 많이 쓰는 성 표기 (앞쪽이 더 흔함). 없는 성은 표기법대로 만든다 */
export const SURNAMES = {
  김: ['Kim', 'Gim'], 이: ['Lee', 'Yi', 'Rhee', 'I'], 박: ['Park', 'Bak'], 최: ['Choi', 'Choe'], 정: ['Jung', 'Jeong', 'Chung'],
  강: ['Kang', 'Gang'], 조: ['Cho', 'Jo'], 윤: ['Yoon', 'Yun'], 장: ['Jang', 'Chang'], 임: ['Lim', 'Im'], 한: ['Han'], 오: ['Oh', 'O'],
  서: ['Seo', 'Suh'], 신: ['Shin', 'Sin'], 권: ['Kwon', 'Gwon'], 황: ['Hwang'], 안: ['Ahn', 'An'], 송: ['Song'], 류: ['Ryu', 'Yoo'],
  유: ['Yoo', 'Yu'], 전: ['Jeon', 'Jun'], 홍: ['Hong'], 고: ['Ko', 'Go'], 문: ['Moon', 'Mun'], 양: ['Yang'], 손: ['Son'], 배: ['Bae'],
  백: ['Baek', 'Paik'], 허: ['Heo', 'Huh'], 남: ['Nam'], 심: ['Shim', 'Sim'], 노: ['Noh', 'No', 'Roh'], 하: ['Ha'], 곽: ['Kwak', 'Gwak'],
  성: ['Sung', 'Seong'], 차: ['Cha'], 주: ['Joo', 'Ju'], 우: ['Woo', 'U'], 구: ['Koo', 'Gu'], 민: ['Min'], 진: ['Jin'], 나: ['Na'],
  지: ['Ji'], 엄: ['Eom', 'Um'], 채: ['Chae'], 원: ['Won'], 천: ['Cheon', 'Chun'], 방: ['Bang'], 공: ['Kong', 'Gong'], 현: ['Hyun', 'Hyeon'],
  함: ['Ham'], 변: ['Byun', 'Byeon'], 염: ['Yeom'], 여: ['Yeo'], 추: ['Choo', 'Chu'], 도: ['Do'], 소: ['So'], 석: ['Seok', 'Suk'],
  선: ['Sun', 'Seon'], 설: ['Seol', 'Sul'], 마: ['Ma'], 길: ['Gil', 'Kil'], 연: ['Yeon'], 위: ['Wi'], 표: ['Pyo'], 명: ['Myung', 'Myeong'],
  기: ['Ki', 'Gi'], 반: ['Ban'], 왕: ['Wang'], 금: ['Keum', 'Geum'], 옥: ['Ok'], 육: ['Yook', 'Yuk'], 인: ['In'], 맹: ['Maeng'], 제: ['Je'],
  모: ['Mo'], 탁: ['Tak'], 국: ['Kook', 'Guk'], 어: ['Eo'], 은: ['Eun'], 편: ['Pyeon'], 용: ['Yong'], 예: ['Ye'], 경: ['Kyung', 'Gyeong'],
  봉: ['Bong'], 사: ['Sa'], 부: ['Boo', 'Bu'], 가: ['Ka', 'Ga'], 피: ['Pi'], 태: ['Tae'],
  남궁: ['Namgung', 'Namkoong'], 황보: ['Hwangbo'], 제갈: ['Jegal'], 선우: ['Sunwoo', 'Seonu'], 독고: ['Dokgo'], 사공: ['Sagong'], 서문: ['Seomun'],
};
const DOUBLE = Object.keys(SURNAMES).filter((k) => k.length === 2);

const isHangul = (ch) => { const c = ch.charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3; };
const parts = (ch) => { const c = ch.charCodeAt(0) - 0xac00; return [Math.floor(c / 588), Math.floor((c % 588) / 28), c % 28]; };

/** 음절들을 표기법대로 (이름은 음운 변화 미반영, 받침 ㄹ + 첫소리 ㄹ 은 ll) */
export function romanizeSyllables(str, { hyphen = false } = {}) {
  const chars = [...String(str ?? '')].filter(isHangul);
  let out = '';
  chars.forEach((ch, i) => {
    const [ini, med, fin] = parts(ch);
    let head = INI[ini];
    if (i > 0 && ini === RIEUL_INI && parts(chars[i - 1])[2] === RIEUL_FIN) head = 'l';
    if (i > 0 && hyphen) out += '-';
    out += head + MED[med] + FIN[fin];
  });
  return out;
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** '홍길동' / '남궁 민수' → 성과 이름 */
export function splitName(full) {
  const raw = String(full ?? '').trim();
  if (/\s/.test(raw)) {
    const [s, ...g] = raw.split(/\s+/);
    return { surname: s, given: g.join('') };
  }
  const chars = [...raw];
  if (chars.length >= 3 && DOUBLE.includes(chars.slice(0, 2).join(''))) return { surname: chars.slice(0, 2).join(''), given: chars.slice(2).join('') };
  return { surname: chars[0] ?? '', given: chars.slice(1).join('') };
}

/**
 * @param {string} full
 * @param {{ surnameSpelling?: string, hyphen?: boolean }} [opt]
 * @returns {{ surname:string, given:string, surnameOptions:string[], romanSurname:string, romanGiven:string, passport:string, western:string, korean:string } | { error:string }}
 */
export function romanizeName(full, { surnameSpelling, hyphen = false } = {}) {
  const raw = String(full ?? '').trim();
  if (!raw) return { error: '이름을 입력해 주세요.' };
  if (![...raw.replace(/\s+/g, '')].every(isHangul)) return { error: '한글 이름만 입력해 주세요. (예: 홍길동)' };
  const { surname, given } = splitName(raw);
  if (!given) return { error: '성과 이름을 함께 입력해 주세요. (예: 홍길동)' };
  const rr = cap(romanizeSyllables(surname));
  const surnameOptions = [...new Set([...(SURNAMES[surname] ?? []), rr])];
  const romanSurname = surnameSpelling && surnameOptions.includes(surnameSpelling) ? surnameSpelling : surnameOptions[0];
  const romanGiven = cap(romanizeSyllables(given, { hyphen }));
  return {
    surname, given, surnameOptions, romanSurname, romanGiven,
    passport: `${romanSurname.toUpperCase()} ${romanGiven.toUpperCase().replace(/-/g, '-')}`,
    western: `${romanGiven} ${romanSurname}`,
    korean: `${romanSurname} ${romanGiven}`,
  };
}
