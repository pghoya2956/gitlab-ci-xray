import type { Rule } from './engine.js';
import type { AntiPatternWarning } from '../types.js';

const NETWORK_PATTERNS = [
  /\bcurl\b/,
  /\bwget\b/,
  /\bapt(-get)?\s+(install|update)/,
  /\byum\s+install/,
  /\bdnf\s+install/,
  /\bapk\s+add/,
  /\bnpm\s+(install|ci)\b/,
  /\bpip\s+install/,
  /\bgem\s+install/,
  /\bgo\s+(get|mod\s+download)/,
  /\bdocker\s+pull/,
  /\bhelm\s+(repo|pull|install|upgrade)/,
];

/** AP-007: 네트워크 의존 script에 retry 미설정 */
export const ap007: Rule = {
  id: 'AP-007',
  severity: 'warning',
  meta: {
    name: 'retry 미설정 (네트워크 의존)',
    description: 'script에 네트워크 접근 명령이 있지만 retry가 설정되지 않아 일시적 네트워크 오류에 취약합니다.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];

    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;
      if (job.retry != null) continue;

      const allScripts = [
        ...(job.before_script ?? []),
        ...(job.script ?? []),
        ...(job.after_script ?? []),
      ];

      const hasNetwork = allScripts.some(line =>
        NETWORK_PATTERNS.some(p => p.test(line))
      );

      if (hasNetwork) {
        warnings.push({
          ruleId: 'AP-007',
          severity: 'warning',
          message: `'${name}'에 네트워크 명령이 있지만 retry가 설정되지 않았습니다.`,
          description: ap007.meta.description,
          location: { jobName: name, key: 'retry' },
          fix: {
            id: 'fix-ap-007',
            type: 'structure',
            title: 'retry 추가',
            description: '네트워크 오류에 대한 재시도를 추가합니다.',
            impact: 'medium',
            before: `${name}:\n  script:\n    - npm ci`,
            after: `${name}:\n  script:\n    - npm ci\n  retry:\n    max: 2\n    when: runner_system_failure`,
            affectedJobs: [name],
          },
        });
      }
    }

    return warnings;
  },
};
