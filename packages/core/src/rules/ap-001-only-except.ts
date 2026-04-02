import type { Rule } from './engine.js';
import type { AntiPatternWarning } from '../types.js';

/** AP-001: only/except 대신 rules 사용 권장 */
export const ap001: Rule = {
  id: 'AP-001',
  severity: 'warning',
  meta: {
    name: 'only/except 사용',
    description: 'only/except는 deprecated입니다. rules 키워드로 전환하세요.',
    docUrl: 'https://docs.gitlab.com/ee/ci/yaml/#only--except',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];

    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;

      if (job.only != null) {
        warnings.push({
          ruleId: 'AP-001',
          severity: 'warning',
          message: `'${name}'에서 only 대신 rules 사용을 권장합니다.`,
          description: ap001.meta.description,
          location: { jobName: name, key: 'only' },
          docUrl: ap001.meta.docUrl,
        });
      }

      if (job.except != null) {
        warnings.push({
          ruleId: 'AP-001',
          severity: 'warning',
          message: `'${name}'에서 except 대신 rules 사용을 권장합니다.`,
          description: ap001.meta.description,
          location: { jobName: name, key: 'except' },
          docUrl: ap001.meta.docUrl,
        });
      }
    }

    return warnings;
  },
};
