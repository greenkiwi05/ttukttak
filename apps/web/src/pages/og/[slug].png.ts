// /og/{slug}.png — 도구마다 공유 미리보기 이미지를 빌드할 때 만든다. 'default'는 홈·카테고리·기타 페이지용.
import type { APIRoute } from 'astro';
import { liveTools, CATEGORIES } from '../../data/tools.js';
import { renderOg, type OgInput } from '../../og/render';

// 파일을 다루는 도구는 "서버 업로드 없음"을 강조
const FILE_CATS = new Set(['file', 'photo']);

export function getStaticPaths() {
  const tools = liveTools().map((t) => ({
    params: { slug: t.slug },
    props: {
      title: t.title,
      desc: t.short,
      badge: CATEGORIES[t.category as keyof typeof CATEGORIES].label,
      chips: FILE_CATS.has(t.category) ? ['서버 업로드 없음', '설치·가입 없이'] : ['무료', '설치·가입 없이'],
    } satisfies OgInput,
  }));
  return [
    ...tools,
    { params: { slug: 'default' }, props: { title: '필요한 계산, 뚝딱 끝', desc: `생활 계산·파일 변환 도구 ${tools.length}가지를 설치·가입 없이 바로`, chips: ['서버 업로드 없음', '무료'] } satisfies OgInput },
  ];
}

export const GET: APIRoute = async ({ props }) =>
  new Response(await renderOg(props as OgInput) as BodyInit, { headers: { 'Content-Type': 'image/png' } });
