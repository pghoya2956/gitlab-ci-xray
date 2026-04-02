import type { Rule } from './engine.js';
import type { AntiPatternWarning } from '../types.js';

/** AP-004: cache에 명시적 key 미설정 */
export const ap004: Rule = {
  id: 'AP-004',
  severity: 'warning',
  meta: {
    name: 'cache key 미설정',
    description: 'cache에 key가 없으면 모든 job이 같은 캐시를 공유하여 충돌이 발생할 수 있습니다.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];

    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;
      if (!job.cache) continue;

      const caches = Array.isArray(job.cache) ? job.cache : [job.cache];
      for (const cache of caches) {
        if (cache.paths?.length && !cache.key) {
          warnings.push({
            ruleId: 'AP-004',
            severity: 'warning',
            message: `'${name}'의 cache에 key가 설정되지 않았습니다.`,
            description: ap004.meta.description,
            location: { jobName: name, key: 'cache' },
            fix: {
              id: 'fix-ap-004',
              type: 'cache',
              title: 'cache key 추가',
              description: 'cache에 key를 추가하여 job별 캐시를 분리합니다.',
              impact: 'medium',
              before: `cache:\n  paths:\n    - node_modules/`,
              after: `cache:\n  key:\n    files:\n      - package-lock.json\n  paths:\n    - node_modules/`,
              affectedJobs: [name],
            },
          });
          break; // One warning per job
        }
      }
    }

    return warnings;
  },
};
