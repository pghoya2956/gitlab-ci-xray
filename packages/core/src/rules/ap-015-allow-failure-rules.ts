import type { Rule } from './engine.js';
import type { AntiPatternWarning } from '../types.js';

/** AP-015: allow_failure + rules.when 동시 존재 → 혼란 가능 */
export const ap015: Rule = {
  id: 'AP-015',
  severity: 'info',
  meta: {
    name: 'allow_failure + rules 혼용',
    description: 'allow_failure와 rules[].allow_failure가 동시에 있으면 어떤 값이 적용되는지 혼란스러울 수 있습니다.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];

    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;
      if (job.allow_failure == null) continue;
      if (!Array.isArray(job.rules)) continue;

      const hasRuleAllowFailure = job.rules.some(r => r.allow_failure != null);
      if (!hasRuleAllowFailure) continue;

      warnings.push({
        ruleId: 'AP-015',
        severity: 'info',
        message: `'${name}'에 allow_failure와 rules[].allow_failure가 동시에 설정되어 있습니다.`,
        description: ap015.meta.description,
        location: { jobName: name, key: 'allow_failure' },
      });
    }

    return warnings;
  },
};
