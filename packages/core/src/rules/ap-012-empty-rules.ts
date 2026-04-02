import type { Rule } from './engine.js';
import type { AntiPatternWarning } from '../types.js';

/** AP-012: rules: [] 빈 배열 — job이 절대 실행되지 않음 */
export const ap012: Rule = {
  id: 'AP-012',
  severity: 'error',
  meta: {
    name: 'rules 빈 배열',
    description: 'rules: []는 어떤 조건에서도 job이 실행되지 않음을 의미합니다. 의도적이라면 when: never를 사용하세요.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];

    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;
      if (!Array.isArray(job.rules)) continue;
      if (job.rules.length > 0) continue;

      warnings.push({
        ruleId: 'AP-012',
        severity: 'error',
        message: `'${name}'의 rules가 빈 배열입니다. 이 job은 절대 실행되지 않습니다.`,
        description: ap012.meta.description,
        location: { jobName: name, key: 'rules' },
      });
    }

    return warnings;
  },
};
