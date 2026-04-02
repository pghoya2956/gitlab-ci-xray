import type { Rule } from './engine.js';
import type { AntiPatternWarning, GitLabCIConfig } from '../types.js';

/** AP-003: 같은 stage 내 독립 job → needs로 병렬화 가능 */
export const ap003: Rule = {
  id: 'AP-003',
  severity: 'info',
  meta: {
    name: '병렬화 가능한 job',
    description: '같은 stage에 있지만 서로 의존하지 않는 job들은 needs를 사용하면 더 빨리 실행할 수 있습니다.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];

    // Find stages with multiple jobs that don't use needs
    const jobsByStage = groupByStage(config);

    for (const [stage, jobs] of jobsByStage) {
      if (jobs.length < 2) continue;

      // Check if any job in this stage uses needs
      const hasNeeds = jobs.some(name => config.jobs[name].needs != null);
      if (hasNeeds) continue;

      // Check if jobs share artifacts/dependencies
      const independentJobs = jobs.filter(name => {
        const job = config.jobs[name];
        return !job.dependencies?.length;
      });

      if (independentJobs.length >= 2) {
        warnings.push({
          ruleId: 'AP-003',
          severity: 'info',
          message: `[${stage}] stage에 독립적인 job ${independentJobs.length}개가 있습니다. needs를 사용하면 대기 시간을 줄일 수 있습니다.`,
          description: ap003.meta.description,
          location: { jobName: independentJobs[0], key: 'stage' },
        });
      }
    }

    return warnings;
  },
};

function groupByStage(config: GitLabCIConfig): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [name, job] of Object.entries(config.jobs)) {
    if (job._hidden) continue;
    if (!map.has(job.stage)) map.set(job.stage, []);
    map.get(job.stage)!.push(name);
  }
  return map;
}
