import type { Rule } from './engine.js';
import type { AntiPatternWarning } from '../types.js';

/** AP-011: job 간 script 배열 유사도가 높음 → extends 추출 제안 */
export const ap011: Rule = {
  id: 'AP-011',
  severity: 'info',
  meta: {
    name: 'script 중복',
    description: '여러 job에 유사한 script가 있습니다. extends나 !reference로 추출하면 유지보수가 쉬워집니다.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];
    const reported = new Set<string>();

    const visibleJobs = Object.entries(config.jobs).filter(([, j]) => !j._hidden && j.script?.length);

    for (let i = 0; i < visibleJobs.length; i++) {
      for (let j = i + 1; j < visibleJobs.length; j++) {
        const [nameA, jobA] = visibleJobs[i];
        const [nameB, jobB] = visibleJobs[j];

        const similarity = scriptSimilarity(jobA.script ?? [], jobB.script ?? []);
        if (similarity < 0.7) continue;

        const key = [nameA, nameB].sort().join('|');
        if (reported.has(key)) continue;
        reported.add(key);

        warnings.push({
          ruleId: 'AP-011',
          severity: 'info',
          message: `'${nameA}'와 '${nameB}'의 script가 ${Math.round(similarity * 100)}% 유사합니다. extends 추출을 고려하세요.`,
          description: ap011.meta.description,
          location: { jobName: nameA, key: 'script' },
        });
      }
    }

    return warnings;
  },
};

function scriptSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let common = 0;
  for (const item of setA) {
    if (setB.has(item)) common++;
  }
  return common / Math.max(setA.size, setB.size);
}
