// 오늘 뭐 먹지 (메뉴 추천) 로직. 메뉴 목록·조건 거르기·뽑기·지도 검색 링크.
// 위치는 다루지 않는다: "근처에서 찾기"는 지도 서비스 검색 주소로 넘겨서, 위치 확인은 지도 앱이 한다.

/** 음식 종류 */
export const CUISINES = ['한식', '중식', '일식', '양식', '분식', '아시안', '패스트푸드'];

/** 상황·취향 조건 (고르면 모두 만족하는 메뉴만) */
export const TAGS = {
  solo: '혼밥',
  group: '여럿이',
  soup: '국물',
  noodle: '면',
  rice: '밥',
  meat: '고기',
  spicy: '매콤',
  light: '가볍게',
  hangover: '해장',
};

const M = (name, cuisine, emoji, tags) => ({ name, cuisine, emoji, tags: tags.split(' ').filter(Boolean) });

/** 메뉴 목록 (이름 = 지도 검색어) */
export const MENUS = [
  // 한식
  M('김치찌개', '한식', '🍲', 'solo soup rice spicy'),
  M('된장찌개', '한식', '🍲', 'solo soup rice'),
  M('순두부찌개', '한식', '🍲', 'solo soup rice spicy'),
  M('부대찌개', '한식', '🍲', 'group soup spicy'),
  M('제육볶음', '한식', '🍖', 'solo rice meat spicy'),
  M('불고기', '한식', '🍖', 'solo rice meat'),
  M('비빔밥', '한식', '🍚', 'solo rice light'),
  M('돌솥비빔밥', '한식', '🍚', 'solo rice'),
  M('국밥', '한식', '🍲', 'solo soup rice hangover'),
  M('순대국', '한식', '🍲', 'solo soup rice hangover'),
  M('뼈해장국', '한식', '🍲', 'solo soup rice meat hangover spicy'),
  M('콩나물국밥', '한식', '🍲', 'solo soup rice hangover light'),
  M('설렁탕', '한식', '🍲', 'solo soup rice meat'),
  M('갈비탕', '한식', '🍲', 'solo soup rice meat'),
  M('삼계탕', '한식', '🍗', 'solo soup meat'),
  M('감자탕', '한식', '🍲', 'group soup meat spicy hangover'),
  M('육개장', '한식', '🍲', 'solo soup rice meat spicy hangover'),
  M('김치볶음밥', '한식', '🍳', 'solo rice spicy'),
  M('생선구이', '한식', '🐟', 'solo rice light'),
  M('삼겹살', '한식', '🥓', 'group meat'),
  M('갈비', '한식', '🍖', 'group meat'),
  M('닭갈비', '한식', '🍗', 'group meat spicy'),
  M('보쌈', '한식', '🥬', 'group meat'),
  M('족발', '한식', '🍖', 'group meat'),
  M('냉면', '한식', '🍜', 'solo noodle light'),
  M('칼국수', '한식', '🍜', 'solo soup noodle'),
  M('수제비', '한식', '🍲', 'solo soup'),
  M('쌈밥', '한식', '🥬', 'solo rice light'),
  M('낙지볶음', '한식', '🐙', 'solo rice spicy'),
  M('아귀찜', '한식', '🐟', 'group spicy'),
  M('해물파전', '한식', '🥞', 'group'),
  M('곱창', '한식', '🍖', 'group meat'),
  M('닭볶음탕', '한식', '🍗', 'group soup meat spicy'),
  M('찜닭', '한식', '🍗', 'group meat rice'),
  M('쭈꾸미볶음', '한식', '🐙', 'group rice spicy'),
  M('백반', '한식', '🍚', 'solo rice'),
  M('죽', '한식', '🥣', 'solo light hangover'),
  // 중식
  M('짜장면', '중식', '🍜', 'solo noodle'),
  M('짬뽕', '중식', '🍜', 'solo soup noodle spicy hangover'),
  M('볶음밥', '중식', '🍳', 'solo rice'),
  M('탕수육', '중식', '🥡', 'group meat'),
  M('마라탕', '중식', '🌶️', 'solo soup spicy'),
  M('마라샹궈', '중식', '🌶️', 'group spicy'),
  M('양꼬치', '중식', '🍢', 'group meat'),
  M('딤섬', '중식', '🥟', 'group light'),
  M('마파두부밥', '중식', '🍚', 'solo rice spicy'),
  // 일식
  M('초밥', '일식', '🍣', 'solo rice light'),
  M('돈카츠', '일식', '🍱', 'solo rice meat'),
  M('라멘', '일식', '🍜', 'solo soup noodle'),
  M('우동', '일식', '🍜', 'solo soup noodle light'),
  M('규동', '일식', '🍚', 'solo rice meat'),
  M('회덮밥', '일식', '🍚', 'solo rice light'),
  M('소바', '일식', '🍜', 'solo noodle light'),
  M('오코노미야키', '일식', '🥞', 'group'),
  M('샤브샤브', '일식', '🍲', 'group soup meat light'),
  M('텐동', '일식', '🍤', 'solo rice'),
  // 양식
  M('파스타', '양식', '🍝', 'solo noodle'),
  M('피자', '양식', '🍕', 'group'),
  M('스테이크', '양식', '🥩', 'meat'),
  M('리조또', '양식', '🍚', 'solo rice'),
  M('샐러드', '양식', '🥗', 'solo light'),
  M('수제버거', '양식', '🍔', 'solo meat'),
  M('브런치', '양식', '🥞', 'light'),
  M('샌드위치', '양식', '🥪', 'solo light'),
  // 분식
  M('떡볶이', '분식', '🌶️', 'solo spicy'),
  M('김밥', '분식', '🍙', 'solo rice light'),
  M('라면', '분식', '🍜', 'solo soup noodle spicy hangover'),
  M('쫄면', '분식', '🍜', 'solo noodle spicy'),
  M('순대', '분식', '🌭', 'solo'),
  M('튀김', '분식', '🍤', 'solo'),
  M('잔치국수', '분식', '🍜', 'solo soup noodle light'),
  M('비빔국수', '분식', '🍜', 'solo noodle spicy'),
  M('오므라이스', '분식', '🍳', 'solo rice'),
  M('돈가스', '분식', '🍱', 'solo meat rice'),
  // 아시안
  M('쌀국수', '아시안', '🍜', 'solo soup noodle light hangover'),
  M('분짜', '아시안', '🍜', 'solo noodle meat'),
  M('팟타이', '아시안', '🍜', 'solo noodle'),
  M('카레', '아시안', '🍛', 'solo rice'),
  M('나시고랭', '아시안', '🍳', 'solo rice'),
  M('반미', '아시안', '🥖', 'solo light'),
  M('똠얌꿍', '아시안', '🍲', 'soup spicy'),
  M('포케', '아시안', '🥗', 'solo rice light'),
  // 패스트푸드
  M('햄버거', '패스트푸드', '🍔', 'solo meat'),
  M('치킨', '패스트푸드', '🍗', 'group meat'),
  M('핫도그', '패스트푸드', '🌭', 'solo light'),
  M('타코', '패스트푸드', '🌮', 'solo meat'),
];

/**
 * 조건에 맞는 메뉴
 * @param {{ cuisines?: string[], tags?: string[], exclude?: string[] }} o
 * - cuisines: 하나라도 맞으면 (비우면 전부)
 * - tags: 모두 만족해야
 * - exclude: 뺄 메뉴 이름
 */
export function filterMenus(o = {}, menus = MENUS) {
  const cs = o.cuisines ?? [], ts = o.tags ?? [], ex = new Set(o.exclude ?? []);
  return menus.filter((m) => (!cs.length || cs.includes(m.cuisine)) && ts.every((t) => m.tags.includes(t)) && !ex.has(m.name));
}

/**
 * 후보에서 하나 뽑기. 직전 메뉴(last)는 후보가 2개 이상이면 다시 나오지 않게 한다.
 * @param {(() => number)} rand 0 이상 1 미만
 */
export function pickMenu(list, rand = Math.random, last = null) {
  const pool = list.length > 1 && last ? list.filter((m) => m.name !== last) : list;
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

/** 지도 서비스 검색 주소. 위치 확인·주변 검색은 지도 서비스가 한다 */
export function mapLinks(name) {
  const q = encodeURIComponent(name);
  return {
    naver: `https://map.naver.com/p/search/${q}`,
    kakao: `https://map.kakao.com/?q=${q}`,
  };
}
