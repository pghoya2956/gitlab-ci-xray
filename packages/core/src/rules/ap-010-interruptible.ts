import type { Rule } from './engine.js';
import type { AntiPatternWarning } from '../types.js';

/** AP-010: interruptible 미설정 */
export const ap010: Rule = {
  id: 'AP-010',
  severity: 'info',
  meta: {
    name: 'interruptible 미설정',
    description: 'interruptible: true를 설정하면 새 커밋 push 시 이전 파이프라인을 자동 취소하여 러너 자원을 절약합니다.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];

    // Check if default.interruptible is set
    const hasDefault = config.default.interruptible != null;
    if (hasDefault) return warnings;

    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;
      if (job.interruptible != null) continue;
      // Deploy/manual jobs typically shouldn't be interruptible
      if (job.when === 'manual') continue;
      if (job.environment) continue;

      warnings.push({
        ruleId: 'AP-010',
        severity: 'info',
        message: `'${name}'에 interruptible이 설정되지 않았습니다.`,
        description: ap010.meta.description,
        location: { jobName: name, key: 'interruptible' },
      });
    }

    return warnings;
  },
};
