// 돌림판 로직. 결과는 보안 난수로 먼저 정하고, 바늘이 그 칸에 멈추도록 회전 각도를 계산한다.
// 각도: 바늘은 맨 위(0°) 고정, 칸 i는 위에서 시계 방향으로 [i·s, (i+1)·s] (s = 360 / n),
// 판을 시계 방향으로 R도 돌리면 바늘 아래에는 판의 (-R mod 360) 위치가 온다.

export const MAX_ITEMS = 40;

/** 미리 넣어 둔 목록 */
export const PRESETS = [
  { id: 'lunch', label: '점심 메뉴', items: ['한식', '중식', '일식', '분식', '양식', '국밥', '패스트푸드', '샐러드'] },
  { id: 'yesno', label: '예 / 아니오', items: ['예', '아니오'] },
  { id: 'num', label: '1~6 숫자', items: ['1', '2', '3', '4', '5', '6'] },
  { id: 'penalty', label: '벌칙', items: ['커피 쏘기', '노래 한 곡', '설거지', '심부름', '통과!', '한 번 더'] },
];

/** 칸 색: 이웃한 칸이 같은 색이 되지 않게 (마지막 칸과 첫 칸도) */
export const COLORS = ['#ff8a5b', '#ffc94d', '#7bd389', '#5bc0eb', '#9b8cff', '#f582ae', '#4fd1c5', '#f6ad55'];
export function colorFor(i, n) {
  let c = i % COLORS.length;
  if (n > 1 && i === n - 1 && c === 0) c = (n - 1) % 2 === 0 ? 2 : 1; // 마지막 칸이 첫 칸과 같은 색이면 바꿈
  return COLORS[c];
}

/** 0 이상 n 미만 정수 하나 */
export const pickIndex = (n, rand = Math.random) => Math.min(n - 1, Math.floor(rand() * n));

const mod = (a, m) => ((a % m) + m) % m;

/** 회전 각도 R에서 바늘이 가리키는 칸 */
export const indexAt = (rotation, n) => Math.floor(mod(-rotation, 360) / (360 / n)) % n;

/**
 * 칸 i에 멈추는 새 회전 각도 (지금 각도에서 시계 방향으로 turns바퀴 이상 더 돈다)
 * jitter(0~1)로 칸 안 어디쯤 멈출지 정한다 — 칸 경계에는 멈추지 않게 가운데 80% 안에서
 */
export function spinTo({ current, index, n, turns = 6, jitter = 0.5 }) {
  const s = 360 / n;
  const inSeg = s * (0.1 + 0.8 * jitter);
  const target = mod(-(index * s + inSeg), 360);
  const delta = mod(target - current, 360);
  return current + turns * 360 + delta;
}

/** 칸 하나의 SVG 부채꼴 경로 (중심 cx, cy, 반지름 r) */
export function slicePath(i, n, r = 100, cx = 100, cy = 100) {
  if (n === 1) return `M${cx},${cy - r}A${r},${r} 0 1,1 ${cx - 0.01},${cy - r}Z`;
  const s = (2 * Math.PI) / n;
  const a0 = i * s - Math.PI / 2, a1 = (i + 1) * s - Math.PI / 2;
  const p = (a) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  return `M${cx},${cy}L${p(a0)}A${r},${r} 0 ${s > Math.PI ? 1 : 0},1 ${p(a1)}Z`;
}

/** 칸 글씨 위치·각도 (가운데 선을 따라 바깥쪽으로) */
export function labelPos(i, n, r = 100, cx = 100, cy = 100) {
  const deg = (i + 0.5) * (360 / n);
  const a = (deg - 90) * (Math.PI / 180);
  const d = n === 1 ? 0 : r * 0.62;
  // 왼쪽 절반(글씨가 거꾸로 보이는 쪽)은 180도 뒤집어서 바로 읽히게
  const rot = deg - 90;
  return { x: cx + d * Math.cos(a), y: cy + d * Math.sin(a), rotate: n === 1 ? 0 : rot > 90 && rot < 270 ? rot - 180 : rot };
}

/** 입력 → 항목 목록 (줄바꿈·쉼표 구분, 최대 MAX_ITEMS) */
export function parseItems(text) {
  const items = String(text ?? '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  return { items: items.slice(0, MAX_ITEMS), cut: Math.max(0, items.length - MAX_ITEMS) };
}

/** 긴 글씨 줄이기 */
export const shortLabel = (s, n) => {
  const max = n <= 6 ? 10 : n <= 12 ? 7 : 5;
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
};
