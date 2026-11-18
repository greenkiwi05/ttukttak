// 공유 미리보기(OG) 이미지 그리기 — 빌드할 때만 실행된다 (사이트 방문자에게는 PNG 파일만 전달).
// satori(레이아웃 → SVG) + resvg-wasm(SVG → PNG). 글꼴은 Pretendard OTF(OFL).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import satori from 'satori';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

const req = createRequire(path.join(process.cwd(), 'package.json'));
const read = (id: string) => fs.readFileSync(req.resolve(id));

let ready: Promise<void> | null = null;
let fonts: { name: string; data: Buffer; weight: 500 | 700 | 800; style: 'normal' }[] = [];

function init() {
  ready ??= (async () => {
    await initWasm(read('@resvg/resvg-wasm/index_bg.wasm'));
    fonts = [
      { name: 'Pretendard', data: read('pretendard/dist/public/static/Pretendard-Medium.otf'), weight: 500, style: 'normal' },
      { name: 'Pretendard', data: read('pretendard/dist/public/static/Pretendard-Bold.otf'), weight: 700, style: 'normal' },
      { name: 'Pretendard', data: read('pretendard/dist/public/static/Pretendard-ExtraBold.otf'), weight: 800, style: 'normal' },
    ];
  })();
  return ready;
}

// satori는 React 요소 모양의 객체를 받는다 (React 없이 직접 만든다)
type Node = { type: string; props: { style?: Record<string, unknown>; children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({ type, props: { style, children } });

export interface OgInput {
  title: string;
  desc: string;
  badge?: string;    // 카테고리
  chips?: string[];  // 아래쪽 특징
}

export async function renderOg({ title, desc, badge, chips = [] }: OgInput): Promise<Uint8Array> {
  await init();
  const titleSize = title.length > 14 ? 72 : 84;
  const tree = h('div', { width: 1200, height: 630, display: 'flex', background: '#fafaf7', fontFamily: 'Pretendard' }, [
    h('div', { width: 16, height: '100%', background: '#e8590c' }),
    h('div', { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px 60px' }, [
      h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
        h('div', { display: 'flex', fontSize: 46, fontWeight: 800, letterSpacing: '-0.03em', color: '#1a1a18' }, [
          h('span', {}, '뚝'), h('span', { color: '#e8590c' }, '딱'),
        ]),
        badge ? h('div', { display: 'flex', fontSize: 30, fontWeight: 700, color: '#e8590c', background: '#fff1e8', borderRadius: 999, padding: '10px 26px' }, badge) : h('div', {}),
      ]),
      h('div', { display: 'flex', flexDirection: 'column' }, [
        h('div', { fontSize: titleSize, fontWeight: 800, color: '#1a1a18', letterSpacing: '-0.035em', lineHeight: 1.2, wordBreak: 'keep-all' }, title),
        h('div', { fontSize: 38, fontWeight: 500, color: '#5e5e58', marginTop: 22, lineHeight: 1.4, wordBreak: 'keep-all' }, desc),
      ]),
      h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
        h('div', { display: 'flex' }, chips.map((c) => h('div', { display: 'flex', fontSize: 27, fontWeight: 700, color: '#2e2e2a', border: '2px solid #e6e4dd', background: '#fff', borderRadius: 14, padding: '10px 20px', marginRight: 12 }, c))),
        h('div', { fontSize: 28, fontWeight: 500, color: '#8a8a83' }, 'ttukttaktools.com'),
      ]),
    ]),
  ]);
  const svg = await satori(tree as never, { width: 1200, height: 630, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
