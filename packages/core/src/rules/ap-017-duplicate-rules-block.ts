import type { Rule } from './engine.js';
import type { AntiPatternWarning, GitLabCIConfig, RuleConfig } from '../types.js';

const THRESHOLD = 3;

/** AP-017: 3회 이상 반복되는 rules 블록 → hidden job으로 공통화 제안 */
export const ap017: Rule = {
  id: 'AP-017',
  severity: 'info',
  meta: {
    name: 'rules 블록 반복',
    description: '동일한 rules 블록이 3개 이상의 job에서 반복됩니다. hidden job이나 !reference로 추출하면 유지보수가 쉬워집니다.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];

    // Group jobs by their rules fingerprint
    const rulesGroups = new Map<string, string[]>();

    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;
      if (!job.rules || job.rules.length === 0) continue;

      const fingerprint = fingerprintRules(job.rules);
      if (!rulesGroups.has(fingerprint)) rulesGroups.set(fingerprint, []);
      rulesGroups.get(fingerprint)!.push(name);
    }

    for (const [, jobs] of rulesGroups) {
      if (jobs.length < THRESHOLD) continue;

      warnings.push({
        ruleId: 'AP-017',
        severity: 'info',
        message: `동일한 rules 블록이 ${jobs.length}개 job에서 반복됩니다: ${jobs.slice(0, 5).join(', ')}${jobs.length > 5 ? '...' : ''}`,
        description: ap017.meta.description,
        location: { jobName: jobs[0], key: 'rules' },
      });
    }

    return warnings;
  },
};

function fingerprintRules(rules: RuleConfig[]): string {
  return JSON.stringify(rules.map(r => ({
    if: r.if ?? null,
    changes: r.changes ?? null,
    exists: r.exists ?? null,
    when: r.when ?? null,
    allow_failure: r.allow_failure ?? null,
  })));
}
