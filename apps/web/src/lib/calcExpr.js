// 공학용 계산기 수식 계산 (순수 로직). eval을 쓰지 않고 직접 해석한다.
// 지원: + − × ÷ ^ ( ) %, 계승 !, sin cos tan asin acos atan sqrt(√) ln log abs, 상수 π e, 곱셈 생략(2π, 3(4+1))
// 각도: deg(도) / rad(라디안). 결과는 유효숫자 12자리로 정리해 0.1+0.2 같은 부동소수 오차를 숨긴다.

const FUNCS = {
  sin: (x, deg) => Math.sin(deg ? (x * Math.PI) / 180 : x),
  cos: (x, deg) => Math.cos(deg ? (x * Math.PI) / 180 : x),
  tan: (x, deg) => {
    const r = deg ? (x * Math.PI) / 180 : x;
    if (deg && Math.abs(((x % 180) + 180) % 180 - 90) < 1e-9) return NaN; // tan 90° 는 정의되지 않음
    return Math.tan(r);
  },
  asin: (x, deg) => (deg ? (Math.asin(x) * 180) / Math.PI : Math.asin(x)),
  acos: (x, deg) => (deg ? (Math.acos(x) * 180) / Math.PI : Math.acos(x)),
  atan: (x, deg) => (deg ? (Math.atan(x) * 180) / Math.PI : Math.atan(x)),
  sqrt: (x) => (x < 0 ? NaN : Math.sqrt(x)),
  ln: (x) => (x <= 0 ? NaN : Math.log(x)),
  log: (x) => (x <= 0 ? NaN : Math.log10(x)),
  abs: (x) => Math.abs(x),
};
const CONSTS = { 'π': Math.PI, pi: Math.PI, e: Math.E };
const BIN = { '+': [1, 'L'], '-': [1, 'L'], '*': [2, 'L'], '/': [2, 'L'], '^': [4, 'R'] };

function factorial(n) {
  if (!Number.isInteger(n) || n < 0) return NaN;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** 문자열 → 토큰 */
export function tokenize(src) {
  const s = String(src ?? '').replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/√/g, 'sqrt').replace(/\s+/g, '').toLowerCase();
  const out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    let m;
    if ((m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(s.slice(i)))) { out.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
    if ((m = /^(asin|acos|atan|sin|cos|tan|sqrt|ln|log|abs)/.exec(s.slice(i)))) { out.push({ t: 'fn', v: m[1] }); i += m[1].length; continue; }
    if ((m = /^(π|pi|e)/.exec(s.slice(i)))) { out.push({ t: 'num', v: CONSTS[m[1]] }); i += m[1].length; continue; }
    if ('+-*/^'.includes(ch)) { out.push({ t: 'op', v: ch }); i++; continue; }
    if (ch === '(' || ch === ')') { out.push({ t: ch }); i++; continue; }
    if (ch === '!' || ch === '%') { out.push({ t: 'post', v: ch }); i++; continue; }
    throw new Error(`알 수 없는 문자: ${ch}`);
  }
  // 곱셈 생략 채우기: 2π, 2(…), )(, )2, π2, 2sin…
  const res = [];
  for (const tk of out) {
    const prev = res[res.length - 1];
    const prevEnds = prev && (prev.t === 'num' || prev.t === ')' || prev.t === 'post');
    const curStarts = tk.t === 'num' || tk.t === '(' || tk.t === 'fn';
    if (prevEnds && curStarts) res.push({ t: 'op', v: '*' });
    res.push(tk);
  }
  return res;
}

/**
 * @param {string} expr
 * @param {{ deg?: boolean }} [opt]
 * @returns {{ value:number } | { error:string }}
 */
export function evaluate(expr, { deg = true } = {}) {
  let tokens;
  try { tokens = tokenize(expr); } catch (e) { return { error: e.message }; }
  if (!tokens.length) return { error: '식을 입력해 주세요.' };
  // 단항 부호 표시
  const toks = tokens.map((tk, i) => {
    const prev = tokens[i - 1];
    if (tk.t === 'op' && (tk.v === '-' || tk.v === '+') && (!prev || prev.t === 'op' || prev.t === '(' || prev.t === 'fn')) return { t: 'neg', v: tk.v };
    return tk;
  });
  // 섄팅 야드 → 후위식
  const outQ = [], ops = [];
  const prec = (o) => (o.t === 'neg' ? 3 : BIN[o.v][0]);
  for (const tk of toks) {
    if (tk.t === 'num') outQ.push(tk);
    else if (tk.t === 'post') outQ.push(tk);
    else if (tk.t === 'fn' || tk.t === '(') ops.push(tk);
    else if (tk.t === 'neg') ops.push(tk);
    else if (tk.t === 'op') {
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.t === '(' || top.t === 'fn') break;
        const pTop = prec(top), pCur = BIN[tk.v][0];
        if (pTop > pCur || (pTop === pCur && BIN[tk.v][1] === 'L')) outQ.push(ops.pop()); else break;
      }
      ops.push(tk);
    } else if (tk.t === ')') {
      while (ops.length && ops[ops.length - 1].t !== '(') outQ.push(ops.pop());
      if (!ops.length) return { error: '괄호 짝이 맞지 않아요.' };
      ops.pop();
      if (ops.length && ops[ops.length - 1].t === 'fn') outQ.push(ops.pop());
    }
  }
  while (ops.length) {
    const o = ops.pop();
    if (o.t === '(') return { error: '괄호 짝이 맞지 않아요.' };
    outQ.push(o);
  }
  // 계산
  const st = [];
  for (const tk of outQ) {
    if (tk.t === 'num') st.push(tk.v);
    else if (tk.t === 'post') { if (!st.length) return { error: '식이 올바르지 않아요.' }; const x = st.pop(); st.push(tk.v === '!' ? factorial(x) : x / 100); }
    else if (tk.t === 'neg') { if (!st.length) return { error: '식이 올바르지 않아요.' }; const x = st.pop(); st.push(tk.v === '-' ? -x : x); }
    else if (tk.t === 'fn') { if (!st.length) return { error: '식이 올바르지 않아요.' }; st.push(FUNCS[tk.v](st.pop(), deg)); }
    else if (tk.t === 'op') {
      if (st.length < 2) return { error: '식이 올바르지 않아요.' };
      const b = st.pop(), a = st.pop();
      if (tk.v === '/' && b === 0) return { error: '0으로 나눌 수 없어요.' };
      st.push(tk.v === '+' ? a + b : tk.v === '-' ? a - b : tk.v === '*' ? a * b : tk.v === '/' ? a / b : Math.pow(a, b));
    }
  }
  if (st.length !== 1) return { error: '식이 올바르지 않아요.' };
  const v = st[0];
  if (Number.isNaN(v)) return { error: '계산할 수 없는 값이에요.' };
  if (!Number.isFinite(v)) return { error: '값이 너무 커요.' };
  return { value: tidy(v) };
}

/** 유효숫자 12자리로 정리, 아주 작은 오차는 0으로 */
export function tidy(v) {
  if (Math.abs(v) < 1e-12) return 0;
  return Number(v.toPrecision(12));
}

/** 화면 표시: 큰 수·작은 수는 지수 표기 */
export function fmtResult(v) {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e15 || a < 1e-9) return v.toExponential(8).replace(/\.?0+e/, 'e');
  return v.toLocaleString('en-US', { maximumFractionDigits: 10 });
}
