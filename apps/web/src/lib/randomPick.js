// 제비뽑기·팀 나누기·순서 정하기. rand: 0 이상 1 미만 난수 함수.

/** 줄바꿈·쉼표로 나눈 목록 (앞뒤 공백 제거, 빈 항목 제외) */
export const parseList = (text) => String(text ?? '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

/** Fisher–Yates 셔플 (원본은 그대로) */
export function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 중복 없이 k명 뽑기 */
export function pick(arr, k, rand = Math.random) {
  if (!(k >= 1)) return { error: '뽑을 인원을 1명 이상으로 입력해 주세요.' };
  if (k > arr.length) return { error: `참가자(${arr.length}명)보다 많이 뽑을 수 없어요.` };
  return { winners: shuffle(arr, rand).slice(0, k) };
}

/** n개 팀으로 고르게 나누기 (인원 차이 최대 1명) */
export function teams(arr, n, rand = Math.random) {
  if (!(n >= 2)) return { error: '팀은 2개 이상이어야 해요.' };
  if (n > arr.length) return { error: `참가자(${arr.length}명)보다 팀이 많을 수 없어요.` };
  const s = shuffle(arr, rand);
  const out = Array.from({ length: n }, () => []);
  s.forEach((x, i) => out[i % n].push(x));
  return { teams: out };
}

/** 같은 이름이 여러 번 있으면 경고용 목록 */
export function duplicates(arr) {
  const seen = new Set(), dup = new Set();
  for (const x of arr) (seen.has(x) ? dup : seen).add(x);
  return [...dup];
}
