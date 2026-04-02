import type { Rule } from './engine.js';
import type { AntiPatternWarning } from '../types.js';

/** AP-014: stages에 없는 stage 참조 */
export const ap014: Rule = {
  id: 'AP-014',
  severity: 'error',
  meta: {
    name: '정의되지 않은 stage',
    description: 'stages에 정의되지 않은 stage를 참조하면 파이프라인이 실패합니다.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];
    const validStages = new Set(config.stages);

    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;
      if (job.trigger) continue;

      if (!validStages.has(job.stage)) {
        warnings.push({
          ruleId: 'AP-014',
          severity: 'error',
          message: `'${name}'이 정의되지 않은 stage '${job.stage}'를 참조합니다.`,
          description: ap014.meta.description,
          location: { jobName: name, key: 'stage' },
        });
      }
    }

    return warnings;
  },
};
