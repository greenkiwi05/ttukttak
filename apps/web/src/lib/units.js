// 단위 변환. 각 단위를 기준 단위로 바꾸는 배율(정의값)로 계산한다. 온도만 따로 공식.
// 값은 국제 정의(1인치 = 2.54cm, 1파운드 = 0.45359237kg, 1갤런(미국) = 3.785411784L 등)라 바뀌지 않는다.

export const UNIT_GROUPS = {
  length: {
    label: '길이', base: 'm',
    units: { mm: ['밀리미터 (mm)', 0.001], cm: ['센티미터 (cm)', 0.01], m: ['미터 (m)', 1], km: ['킬로미터 (km)', 1000], in: ['인치 (in)', 0.0254], ft: ['피트 (ft)', 0.3048], yd: ['야드 (yd)', 0.9144], mi: ['마일 (mi)', 1609.344], ja: ['자 (尺)', 10 / 33] },
  },
  weight: {
    label: '무게', base: 'kg',
    units: { mg: ['밀리그램 (mg)', 1e-6], g: ['그램 (g)', 0.001], kg: ['킬로그램 (kg)', 1], t: ['톤 (t)', 1000], oz: ['온스 (oz)', 0.028349523125], lb: ['파운드 (lb)', 0.45359237], geun: ['근 (600g)', 0.6], don: ['돈 (3.75g)', 0.00375] },
  },
  area: {
    label: '넓이', base: 'm2',
    units: { cm2: ['제곱센티미터 (㎠)', 1e-4], m2: ['제곱미터 (㎡)', 1], pyeong: ['평', 400 / 121], ha: ['헥타르 (ha)', 10000], km2: ['제곱킬로미터 (㎢)', 1e6], ft2: ['제곱피트 (ft²)', 0.09290304], acre: ['에이커 (ac)', 4046.8564224] },
  },
  volume: {
    label: '부피', base: 'L',
    units: { ml: ['밀리리터 (mL)', 0.001], L: ['리터 (L)', 1], m3: ['세제곱미터 (㎥)', 1000], cup: ['컵 (200mL)', 0.2], floz: ['액량 온스 (미국 fl oz)', 0.0295735295625], gal: ['갤런 (미국 gal)', 3.785411784] },
  },
  temp: {
    label: '온도', base: 'C',
    units: { C: ['섭씨 (℃)', 0], F: ['화씨 (℉)', 0], K: ['켈빈 (K)', 0] },
  },
  speed: {
    label: '속도', base: 'ms',
    units: { kmh: ['km/h', 1 / 3.6], ms: ['m/s', 1], mph: ['마일/시 (mph)', 0.44704], kn: ['노트 (kn)', 1852 / 3600] },
  },
  data: {
    label: '데이터', base: 'B',
    units: { B: ['바이트 (B)', 1], KB: ['킬로바이트 (KB)', 1024], MB: ['메가바이트 (MB)', 1024 ** 2], GB: ['기가바이트 (GB)', 1024 ** 3], TB: ['테라바이트 (TB)', 1024 ** 4] },
  },
};

const toC = (v, u) => (u === 'C' ? v : u === 'F' ? ((v - 32) * 5) / 9 : v - 273.15);
const fromC = (c, u) => (u === 'C' ? c : u === 'F' ? (c * 9) / 5 + 32 : c + 273.15);

/** @returns {number|null} */
export function convert(value, from, to, group) {
  if (!Number.isFinite(value)) return null;
  const g = UNIT_GROUPS[group];
  if (!g || !g.units[from] || !g.units[to]) return null;
  if (group === 'temp') return fromC(toC(value, from), to);
  return (value * g.units[from][1]) / g.units[to][1];
}

/** 보기 좋게: 유효숫자 10자리로 정리, 쉼표 */
export function fmtNum(n) {
  if (n === null || !Number.isFinite(n)) return '';
  const r = Number(n.toPrecision(10));
  if (Math.abs(r) >= 1e15 || (Math.abs(r) < 1e-6 && r !== 0)) return r.toExponential(4);
  return r.toLocaleString('ko-KR', { maximumFractionDigits: 6 });
}
