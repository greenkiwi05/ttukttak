// 정기 작업 일정표 출력: npm run schedule
import { SCHEDULE, CRONS, jobsFor } from '../src/schedule.js';

console.log('\n정기 작업 일정표 (apps/api/src/schedule.js)\n');
for (const j of SCHEDULE) {
  console.log(`■ ${j.id} — ${j.title}`);
  console.log(`   언제: ${j.kst}  (cron UTC: ${j.crons.join(' | ')})`);
  console.log(`   출처: ${j.source}${j.key ? `  · 키: ${j.key}` : ''}`);
  console.log(`   호출: 평소 ${j.usual} · 한 번에 최대 ${j.maxCalls}회\n`);
}
console.log('cron별 한 번 실행 외부 호출 최대 (무료 플랜 한도 50):');
for (const c of CRONS) console.log(`   ${c.padEnd(22)} ${jobsFor(c).map((j) => j.id).join(' + ').padEnd(28)} ${jobsFor(c).reduce((a, j) => a + j.maxCalls, 0)}회`);
console.log('');
