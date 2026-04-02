import type { Rule } from './engine.js';
import type { AntiPatternWarning } from '../types.js';

/** AP-013: image 미설정 + default.image 없음 */
export const ap013: Rule = {
  id: 'AP-013',
  severity: 'warning',
  meta: {
    name: 'image 미설정',
    description: 'image가 설정되지 않으면 러너의 기본 이미지에 의존합니다. 재현 가능한 빌드를 위해 명시적으로 지정하세요.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];
    const hasDefaultImage = config.default.image != null;

    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;
      if (job.trigger) continue; // Trigger jobs don't need image
      if (job.image) continue;
      if (hasDefaultImage) continue;

      warnings.push({
        ruleId: 'AP-013',
        severity: 'warning',
        message: `'${name}'에 image가 설정되지 않았고 default.image도 없습니다.`,
        description: ap013.meta.description,
        location: { jobName: name, key: 'image' },
      });
    }

    return warnings;
  },
};
