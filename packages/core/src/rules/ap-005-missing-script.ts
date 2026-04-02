import type { Rule } from './engine.js';
import type { AntiPatternWarning } from '../types.js';

/** AP-005: script/trigger 없는 job */
export const ap005: Rule = {
  id: 'AP-005',
  severity: 'error',
  meta: {
    name: 'script 또는 trigger 누락',
    description: 'job에 script 또는 trigger가 없으면 파이프라인이 실패합니다.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];
    const hasIncludes = config.includes.length > 0;

    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;

      const hasScript = job.script && job.script.length > 0;
      const hasTrigger = job.trigger != null;

      if (!hasScript && !hasTrigger) {
        // If includes exist, script may come from unresolved templates — downgrade to info
        warnings.push({
          ruleId: 'AP-005',
          severity: hasIncludes ? 'info' : 'error',
          message: `'${name}'에 script 또는 trigger가 없습니다.${hasIncludes ? ' (include 미해석으로 인한 오탐 가능)' : ''}`,
          description: ap005.meta.description,
          location: { jobName: name, key: 'script' },
        });
      }
    }

    return warnings;
  },
};
