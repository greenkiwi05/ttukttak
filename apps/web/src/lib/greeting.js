// 경조사·인사 문구 생성기. 미리 써 둔 템플릿을 상황·관계·말투로 골라 보여준다 (외부 API 없음).
// 템플릿에는 이름을 넣지 않고, 이름을 입력하면 앞에 부르는 말(○○님, / ○○아,)을 붙인다.

export const SITUATIONS = {
  wedding: '결혼',
  birth: '출산',
  dol: '돌',
  birthday: '생일',
  promotion: '승진·영전',
  opening: '개업·창업',
  condolence: '조의 (위로)',
  condolenceThanks: '조문 감사 답례',
  holiday: '명절 (설·추석)',
  newyear: '연말연시',
  thanks: '감사 인사',
};

export const RELATIONS = {
  boss: '상사·윗사람',
  colleague: '직장 동료',
  friend: '친구',
  family: '가족·친척',
  client: '거래처·고객',
};

export const TONES = { formal: '격식 있게', casual: '친근하게' };

/** 봉투·리본에 쓰는 짧은 문구 (널리 쓰는 관용 표현) */
export const ENVELOPE = {
  wedding: ['祝結婚 (축결혼)', '祝華婚 (축화혼)'],
  birth: ['祝順産 (축순산)', '祝得男 (축득남) / 祝得女 (축득녀)'],
  dol: ['祝첫돌 (축첫돌)'],
  birthday: ['祝生日 (축생일)'],
  promotion: ['祝昇進 (축승진)', '祝榮轉 (축영전)'],
  opening: ['祝開業 (축개업)', '祝發展 (축발전)'],
  condolence: ['謹弔 (근조)', '賻儀 (부의)', '追慕 (추모)'],
  condolenceThanks: [],
  holiday: [],
  newyear: ['謹賀新年 (근하신년)'],
  thanks: ['薄禮 (박례)', '感謝 (감사)'],
};

// rel이 없으면 모든 관계에 쓸 수 있는 문구
const T = [
  // 결혼
  { s: 'wedding', tone: 'formal', text: '두 분의 결혼을 진심으로 축하드립니다. 서로를 아끼는 마음으로 늘 행복한 가정 이루시길 바랍니다.' },
  { s: 'wedding', tone: 'formal', text: '평생을 함께할 소중한 인연을 만나신 것을 축하드립니다. 앞날에 기쁨과 축복이 가득하시길 기원합니다.' },
  { s: 'wedding', tone: 'formal', rel: ['boss', 'client'], text: '뜻깊은 날을 맞아 진심으로 축하의 인사를 올립니다. 두 분의 앞날에 늘 건강과 행복이 함께하시길 바랍니다.' },
  { s: 'wedding', tone: 'casual', text: '결혼 진짜 축하해! 지금처럼 서로 아껴주면서 오래오래 행복하게 살아.' },
  { s: 'wedding', tone: 'casual', text: '드디어 결혼이라니 내가 다 설렌다. 두 사람 앞날에 좋은 일만 가득하길!' },
  { s: 'wedding', tone: 'casual', rel: ['family'], text: '결혼 너무 축하해. 이제 한 가정을 꾸리는 게 대견하고 든든하다. 둘이 서로 의지하며 행복하게 살아.' },

  // 출산
  { s: 'birth', tone: 'formal', text: '건강한 아기의 탄생을 진심으로 축하드립니다. 산모와 아기 모두 건강하시길 바랍니다.' },
  { s: 'birth', tone: 'formal', text: '귀한 생명을 맞이하신 것을 축하드립니다. 아기가 사랑 속에서 건강하고 밝게 자라길 기원합니다.' },
  { s: 'birth', tone: 'casual', text: '출산 정말 축하해! 고생 많았어. 몸조리 잘하고, 아기랑 같이 건강하게 지내.' },
  { s: 'birth', tone: 'casual', text: '아기 태어난 거 축하해! 사진 보니까 너무 예쁘다. 엄마 아빠 된 거 진심으로 축하해.' },

  // 돌
  { s: 'dol', tone: 'formal', text: '아기의 첫 생일을 진심으로 축하드립니다. 앞으로도 건강하고 지혜롭게 자라길 바랍니다.' },
  { s: 'dol', tone: 'formal', text: '건강하게 첫돌을 맞은 것을 축하드립니다. 그동안 정성으로 키우신 부모님께도 감사와 응원을 보냅니다.' },
  { s: 'dol', tone: 'casual', text: '벌써 첫돌이라니! 아기 건강하게 잘 커줘서 고맙고, 키우느라 정말 고생 많았어. 축하해!' },
  { s: 'dol', tone: 'casual', text: '첫 생일 축하해, 아가야! 지금처럼 건강하고 씩씩하게만 자라렴.' },

  // 생일
  { s: 'birthday', tone: 'formal', rel: ['boss', 'client', 'family'], text: '생신을 진심으로 축하드립니다. 늘 건강하시고 뜻하시는 일 모두 이루시길 바랍니다.' },
  { s: 'birthday', tone: 'formal', text: '생일을 축하드립니다. 올 한 해도 기쁜 일이 가득하시길 바랍니다.' },
  { s: 'birthday', tone: 'formal', rel: ['family'], text: '생신 축하드려요. 늘 저희를 아껴 주셔서 감사합니다. 오래오래 건강하세요.' },
  { s: 'birthday', tone: 'casual', text: '생일 축하해! 오늘 하루는 하고 싶은 거 다 하면서 행복하게 보내.' },
  { s: 'birthday', tone: 'casual', text: '생일 진심으로 축하해. 올해도 좋은 일만 가득하고, 늘 건강하자!' },

  // 승진·영전
  { s: 'promotion', tone: 'formal', text: '승진을 진심으로 축하드립니다. 그동안의 노력이 결실을 맺었네요. 새로운 자리에서도 큰 성과 이루시길 바랍니다.' },
  { s: 'promotion', tone: 'formal', text: '영전을 축하드립니다. 더 큰 자리에서 뜻하시는 바를 마음껏 펼치시길 기원합니다.' },
  { s: 'promotion', tone: 'formal', rel: ['colleague', 'boss'], text: '승진 축하드립니다. 함께 일하며 많이 배웠습니다. 앞으로도 잘 부탁드립니다.' },
  { s: 'promotion', tone: 'casual', text: '승진 축하해! 열심히 하더니 결국 해냈네. 오늘은 맛있는 거 먹자!' },
  { s: 'promotion', tone: 'casual', text: '승진 진짜 축하해. 네가 노력한 거 다 알아. 새 자리에서도 잘할 거야!' },

  // 개업·창업
  { s: 'opening', tone: 'formal', text: '개업을 진심으로 축하드립니다. 나날이 번창하시길 기원합니다.' },
  { s: 'opening', tone: 'formal', text: '새로운 시작을 축하드립니다. 뜻하신 일이 모두 잘 이루어지고 늘 손님이 가득하시길 바랍니다.' },
  { s: 'opening', tone: 'formal', rel: ['client'], text: '개업을 축하드리며, 앞으로도 좋은 파트너로 함께 성장하길 바랍니다. 번창하세요.' },
  { s: 'opening', tone: 'casual', text: '개업 축하해! 대박 나라! 자주 놀러 갈게.' },
  { s: 'opening', tone: 'casual', text: '드디어 네 가게를 열었구나. 정말 축하하고, 늘 손님 북적이길 응원할게!' },

  // 조의 (위로)
  { s: 'condolence', tone: 'formal', text: '삼가 고인의 명복을 빕니다. 갑작스러운 비보에 깊은 위로의 말씀을 드립니다.' },
  { s: 'condolence', tone: 'formal', text: '고인의 명복을 빌며, 슬픔을 함께 나눕니다. 유가족분들께 깊은 위로를 전합니다.' },
  { s: 'condolence', tone: 'formal', text: '직접 찾아뵙지 못해 죄송합니다. 마음으로나마 고인의 명복을 빌며 깊은 위로를 드립니다.' },
  { s: 'condolence', tone: 'casual', text: '소식 듣고 너무 마음이 아프다. 고인의 명복을 빌어. 힘들 때 언제든 연락해.' },
  { s: 'condolence', tone: 'casual', text: '얼마나 힘들지 감히 다 헤아릴 수 없지만, 곁에 있을게. 고인의 명복을 빌어.' },

  // 조문 감사 답례
  { s: 'condolenceThanks', tone: 'formal', text: '바쁘신 가운데 조문해 주시고 위로해 주셔서 깊이 감사드립니다. 덕분에 장례를 잘 마쳤습니다.' },
  { s: 'condolenceThanks', tone: 'formal', text: '보내주신 따뜻한 위로에 큰 힘을 얻었습니다. 직접 찾아뵙고 인사드려야 하나 우선 글로 감사의 마음을 전합니다.' },
  { s: 'condolenceThanks', tone: 'casual', text: '와줘서 정말 고마워. 덕분에 많이 위로받았어. 정리되면 따로 연락할게.' },
  { s: 'condolenceThanks', tone: 'casual', text: '바쁜데 마음 써줘서 고마워. 네 덕분에 잘 마무리했어.' },

  // 명절
  { s: 'holiday', tone: 'formal', text: '풍성하고 넉넉한 명절 보내시길 바랍니다. 가족과 함께 따뜻한 시간 되세요.' },
  { s: 'holiday', tone: 'formal', text: '즐거운 명절 맞으시길 바랍니다. 오가는 길 안전하시고, 늘 건강하세요.' },
  { s: 'holiday', tone: 'formal', rel: ['client'], text: '늘 보내주시는 성원에 감사드립니다. 가족과 함께 풍요로운 명절 보내시길 바랍니다.' },
  { s: 'holiday', tone: 'casual', text: '명절 잘 보내! 맛있는 거 많이 먹고 푹 쉬어.' },
  { s: 'holiday', tone: 'casual', text: '이번 명절엔 걱정은 내려놓고 가족들이랑 즐거운 시간 보내길!' },

  // 연말연시
  { s: 'newyear', tone: 'formal', text: '새해 복 많이 받으세요. 올 한 해도 건강과 행운이 함께하시길 바랍니다.' },
  { s: 'newyear', tone: 'formal', text: '한 해 동안 베풀어 주신 관심에 감사드립니다. 다가오는 새해에도 뜻하시는 일 모두 이루시길 기원합니다.' },
  { s: 'newyear', tone: 'formal', rel: ['boss', 'colleague', 'client'], text: '올 한 해 함께해 주셔서 감사했습니다. 새해에도 잘 부탁드리며, 늘 건강하시길 바랍니다.' },
  { s: 'newyear', tone: 'casual', text: '새해 복 많이 받아! 올해도 우리 자주 보자.' },
  { s: 'newyear', tone: 'casual', text: '한 해 동안 고마웠어. 새해에는 원하는 일 다 잘되길 응원할게!' },

  // 감사 인사
  { s: 'thanks', tone: 'formal', text: '베풀어 주신 마음에 진심으로 감사드립니다. 받은 도움 잊지 않겠습니다.' },
  { s: 'thanks', tone: 'formal', text: '늘 신경 써 주셔서 감사합니다. 덕분에 일이 잘 마무리되었습니다.' },
  { s: 'thanks', tone: 'formal', rel: ['client'], text: '항상 믿고 함께해 주셔서 감사합니다. 앞으로도 더 좋은 모습으로 보답하겠습니다.' },
  { s: 'thanks', tone: 'casual', text: '진짜 고마워. 네 덕분에 큰 힘이 됐어. 다음엔 내가 맛있는 거 살게!' },
  { s: 'thanks', tone: 'casual', text: '항상 챙겨줘서 고마워. 말로 다 못 할 만큼 고마운 마음이야.' },
];

/** 이름 끝 글자에 받침이 있으면 true (가~힣만 판단) */
export function hasBatchim(word) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return false;
  return (c - 0xac00) % 28 !== 0;
}

/** 부르는 말: 격식 → '홍길동님, ' / 친근 → '민수야, ' · '지현아, ' */
export function vocative(name, tone) {
  const n = String(name ?? '').trim();
  if (!n) return '';
  if (tone === 'formal') return `${n}님, `;
  return /[가-힣]$/.test(n) ? `${n}${hasBatchim(n) ? '아' : '야'}, ` : `${n}, `;
}

/**
 * @param {{ situation:keyof typeof SITUATIONS, relation:keyof typeof RELATIONS, tone:keyof typeof TONES, name?:string }} p
 * @returns {string[]} 관계 맞춤 문구를 앞에 둔다
 */
export function makeGreetings({ situation, relation, tone, name = '' }) {
  const pick = T.filter((t) => t.s === situation && t.tone === tone && (!t.rel || t.rel.includes(relation)));
  pick.sort((a, b) => (b.rel ? 1 : 0) - (a.rel ? 1 : 0));
  const v = vocative(name, tone);
  return pick.map((t) => v + t.text);
}
