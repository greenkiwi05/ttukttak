// 더치페이(N빵) 정산. 여러 차수(1차·2차…)마다 참여한 사람이 다를 수 있다.
// 각 차수 금액을 참여자 수로 나눠 사람별로 더한 뒤, 정해진 단위(1·10·100·1000원)로 맞춘다.
// 단위 맞춤으로 생기는 차액(더 걷힌 돈 또는 모자란 돈)은 결과에 따로 보여준다.

export const ROUND_UNITS = [1, 10, 100, 1000];

/**
 * @param {{ people:string[], rounds:{ name:string, amount:number, payers:number[] }[], unit?:number, mode?:'ceil'|'round'|'floor' }} p
 *   payers: people 배열의 인덱스
 * @returns {{ perPerson:{ name:string, exact:number, pay:number, rounds:string[] }[], total:number, collected:number, diff:number } | { error:string }}
 */
export function settle({ people, rounds, unit = 100, mode = 'ceil' }) {
  if (!people.length) return { error: '참여자를 1명 이상 넣어 주세요.' };
  if (!rounds.length) return { error: '결제 금액을 넣어 주세요.' };
  const exact = new Array(people.length).fill(0);
  const joined = people.map(() => []);
  let total = 0;
  for (const [i, r] of rounds.entries()) {
    if (!(r.amount > 0)) return { error: `${r.name || `${i + 1}차`} 금액을 입력해 주세요.` };
    const payers = [...new Set(r.payers)].filter((k) => k >= 0 && k < people.length);
    if (!payers.length) return { error: `${r.name || `${i + 1}차`}에 참여한 사람을 골라 주세요.` };
    total += r.amount;
    for (const k of payers) { exact[k] += r.amount / payers.length; joined[k].push(r.name || `${i + 1}차`); }
  }
  const fn = mode === 'floor' ? Math.floor : mode === 'round' ? Math.round : Math.ceil;
  const perPerson = people.map((name, k) => ({
    name, exact: exact[k], rounds: joined[k],
    pay: exact[k] === 0 ? 0 : fn(Math.round(exact[k] * 1000) / 1000 / unit) * unit,
  }));
  const collected = perPerson.reduce((s, p) => s + p.pay, 0);
  return { perPerson, total, collected, diff: collected - total };
}

/** 메신저에 붙여 넣을 정산 문구 */
export function settleText(result, rounds, account = '') {
  const won = (n) => n.toLocaleString('ko-KR') + '원';
  const lines = ['[정산]'];
  for (const [i, r] of rounds.entries()) lines.push(`${r.name || `${i + 1}차`} ${won(r.amount)} (${r.payers.length}명)`);
  lines.push(`총 ${won(result.total)}`, '');
  for (const p of result.perPerson) if (p.pay > 0) lines.push(`${p.name}: ${won(p.pay)}`);
  if (account.trim()) lines.push('', `입금: ${account.trim()}`);
  return lines.join('\n');
}
