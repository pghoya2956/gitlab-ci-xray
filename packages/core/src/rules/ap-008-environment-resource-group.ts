import type { Rule } from './engine.js';
import type { AntiPatternWarning } from '../types.js';

/** AP-008: environment 있지만 resource_group 없음 */
export const ap008: Rule = {
  id: 'AP-008',
  severity: 'info',
  meta: {
    name: 'resource_group 미설정',
    description: 'environment를 사용하는 deploy job에 resource_group이 없으면 동시 배포가 발생할 수 있습니다.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];

    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;
      if (!job.environment) continue;
      if (job.resource_group) continue;

      warnings.push({
        ruleId: 'AP-008',
        severity: 'info',
        message: `'${name}'에 environment가 있지만 resource_group이 없습니다.`,
        description: ap008.meta.description,
        location: { jobName: name, key: 'environment' },
      });
    }

    return warnings;
  },
};
