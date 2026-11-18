// 결과 공유 문구 만들기 (순수 로직). 끝에 도구 이름과 주소를 붙여서 받은 사람도 바로 써 볼 수 있게 한다.

const SITE = 'https://ttukttaktools.com';

/** 문구 끝 꼬리: '— 뚝딱 사다리타기\nhttps://…/tools/ladder/' */
export const footer = (toolTitle, slug) => `\n\n— 뚝딱 ${toolTitle}\n${SITE}/tools/${slug}/`;

/** 사다리: 참가자 → 결과 */
export function ladderText(names, results, mapping) {
  const lines = names.map((n, i) => `${n} → ${results[mapping[i]] || '-'}`);
  return ['[사다리타기 결과]', ...lines].join('\n') + footer('사다리타기', 'ladder');
}

/** 제비뽑기: 당첨자 / 팀 / 순서 */
export function pickText(result) {
  let body;
  if (result.winners) body = ['[제비뽑기 당첨]', result.winners.join(', ')];
  else if (result.teams) body = ['[팀 나누기 결과]', ...result.teams.map((t, i) => `${i + 1}팀: ${t.join(', ')}`)];
  else body = ['[순서 정하기 결과]', ...result.order.map((x, i) => `${i + 1}. ${x}`)];
  return body.join('\n') + footer('제비뽑기', 'random-pick');
}

/** 로또: A~J 게임 번호 */
export function lottoText(sets) {
  const lines = sets.map((s, i) => `${String.fromCharCode(65 + i)}: ${s.map((n) => String(n).padStart(2, ' ')).join(' ')}`);
  return ['[로또 번호]', ...lines].join('\n') + footer('로또 번호 생성기', 'lotto');
}
