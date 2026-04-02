import type { Rule } from './engine.js';
import type { AntiPatternWarning } from '../types.js';

/** AP-002: artifacts에 expire_in 미설정 */
export const ap002: Rule = {
  id: 'AP-002',
  severity: 'warning',
  meta: {
    name: 'artifacts expire_in 미설정',
    description: 'artifacts에 expire_in이 없으면 기본 30일간 보관되어 스토리지를 낭비합니다.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];

    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;
      if (!job.artifacts) continue;
      if (job.artifacts.expire_in) continue;

      // reports-only artifacts are fine without expire_in
      if (job.artifacts.reports && !job.artifacts.paths?.length) continue;

      warnings.push({
        ruleId: 'AP-002',
        severity: 'warning',
        message: `'${name}'의 artifacts에 expire_in이 설정되지 않았습니다.`,
        description: ap002.meta.description,
        location: { jobName: name, key: 'artifacts' },
        fix: {
          id: 'fix-ap-002',
          type: 'artifacts',
          title: 'expire_in 추가',
          description: 'artifacts에 expire_in을 추가하여 스토리지 사용량을 관리합니다.',
          impact: 'medium',
          before: `artifacts:\n  paths:\n    - dist/`,
          after: `artifacts:\n  paths:\n    - dist/\n  expire_in: 1 week`,
          affectedJobs: [name],
        },
      });
    }

    return warnings;
  },
};
