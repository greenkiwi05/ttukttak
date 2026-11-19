// ┌─────────────────────────────────────────────────────────────────────┐
// │ 정기 작업 일정표 — 외부 API를 언제, 얼마나 부르는지 여기 한 곳에서 본다 │
// └─────────────────────────────────────────────────────────────────────┘
// - cron은 UTC 기준이다 (한국시간 = UTC + 9). 요일은 이름(MON-FRI)으로 쓴다 — Cloudflare는 숫자 1이 일요일.
// - 같은 cron에 작업이 여러 개면 위에서부터 차례로 실행된다.
// - wrangler.jsonc의 "triggers.crons"에도 같은 cron이 있어야 실제로 돈다.
//   tests/schedule.test.js가 둘이 어긋나면 실패하게 해 둔다.
// - Cloudflare 무료 플랜은 Worker 한 번 실행에 외부 요청 50회까지라, 한 cron의 maxCalls 합이 50을 넘지 않게 한다.
import * as jobs from './jobs.js';

/**
 * @typedef {Object} Job
 * @property {string} id         작업 이름 (로그용)
 * @property {string} title      한 줄 설명
 * @property {string[]} crons    실행 시각 (UTC)
 * @property {string} kst        사람이 읽는 실행 시각 (한국시간)
 * @property {string} source     부르는 외부 API
 * @property {string} key        필요한 비밀 환경변수 ('' = 없음)
 * @property {number} maxCalls   한 번 실행할 때 외부 호출 최대 횟수
 * @property {string} usual      평소 호출량
 * @property {(env: any) => Promise<void>} run
 */

/** @type {Job[]} */
export const SCHEDULE = [
  {
    id: 'rates-today',
    title: '오늘 환율 (수출입은행 고시 직후 받기)',
    crons: ['*/10 2-3 * * MON-FRI', '0 8 * * MON-FRI'],
    kst: '평일 11:00~12:50 10분마다 + 17:00',
    source: '한국수출입은행 현재환율 API',
    key: 'EXIM_KEY',
    maxCalls: 11, // 고시 없는 날이면 최대 10일 전까지 거슬러 올라감
    usual: '하루 1~3회 (오늘 값을 받으면 그날은 0회)',
    run: jobs.ratesToday,
  },
  {
    id: 'holidays',
    title: '공휴일 (없는 해 채우기 + 올해·내년 다시 확인)',
    crons: ['5 * * * *'],
    kst: '매시 5분',
    source: '한국천문연구원 특일 정보 (공공데이터포털)',
    key: 'HOLIDAY_KEY',
    maxCalls: 13, // 처음 한 번 2016년~내년
    usual: '하루 2회 (올해·내년 각 1회)',
    run: jobs.holidays,
  },
  {
    id: 'solar-terms',
    title: '24절기 (없는 해만 채우기, 바뀌지 않는 값)',
    crons: ['5 * * * *'],
    kst: '매시 5분',
    source: '한국천문연구원 특일 정보 (공공데이터포털)',
    key: 'HOLIDAY_KEY',
    maxCalls: 6, // 한 번에 6해씩
    usual: '다 채운 뒤 0회 (해가 바뀌면 1회)',
    run: jobs.solarTerms,
  },
  {
    id: 'rates-backfill',
    title: '과거 환율 채우기 (자료가 있는 가장 오래된 날까지 거꾸로)',
    crons: ['5 * * * *'],
    kst: '매시 5분',
    source: '한국수출입은행 현재환율 API',
    key: 'EXIM_KEY',
    maxCalls: 30,
    usual: '다 채운 뒤 0회 (채우는 동안 하루 최대 720회)',
    run: jobs.ratesBackfill,
  },
  {
    id: 'lotto',
    title: '로또 당첨번호 (새 회차가 나왔을 때만)',
    crons: ['35 * * * *'],
    kst: '매시 35분',
    source: '동행복권 회차별 결과 (공식 API 아님)',
    key: '',
    maxCalls: 40, // 처음 1회부터 채울 때
    usual: '0회, 토요일 추첨 뒤 1~2회',
    run: (env) => jobs.lotto(env, 'cron'),
  },
  {
    id: 'fuel',
    title: '오늘 평균 유가 (전국·시도별)',
    crons: ['35 * * * *'],
    kst: '매시 35분 (3시간 지났을 때만)',
    source: '오피넷 (한국석유공사) 무료 API',
    key: 'OPINET_KEY',
    maxCalls: 3,
    usual: '하루 약 24회 (3시간마다 3회)',
    run: jobs.fuel,
  },
];

/** wrangler.jsonc에 있어야 할 cron 목록 */
export const CRONS = [...new Set(SCHEDULE.flatMap((j) => j.crons))];

/** 이 cron에 실행할 작업들 */
export const jobsFor = (cron) => SCHEDULE.filter((j) => j.crons.includes(cron));
