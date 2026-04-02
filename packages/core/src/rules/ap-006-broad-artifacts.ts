import type { Rule } from './engine.js';
import type { AntiPatternWarning } from '../types.js';

/** AP-006: 과도하게 넓은 artifacts + downstream이 dependencies 미지정 */
export const ap006: Rule = {
  id: 'AP-006',
  severity: 'warning',
  meta: {
    name: '과도한 artifacts 범위',
    description: 'artifacts paths가 넓고 downstream job이 dependencies를 지정하지 않으면 불필요한 파일이 전달됩니다.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];
    const BROAD_PATTERNS = ['**/*', '*', '.', './', 'build/', 'dist/', 'out/', 'target/'];

    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;
      if (!job.artifacts?.paths) continue;

      const hasBroadPath = job.artifacts.paths.some(p =>
        BROAD_PATTERNS.some(bp => p === bp || p.endsWith('/**/*'))
      );
      if (!hasBroadPath) continue;

      // Check if any downstream job lacks dependencies
      const hasDownstreamWithoutDeps = Object.entries(config.jobs).some(([dName, dJob]) => {
        if (dJob._hidden) return false;
        if (dName === name) return false;
        // Downstream = same or later stage, and no explicit dependencies
        const needs = dJob.needs;
        if (needs) {
          const needsThis = needs.some(n =>
            (typeof n === 'string' ? n : n.job) === name
          );
          if (needsThis && !dJob.dependencies) return true;
        }
        return false;
      });

      if (hasBroadPath) {
        warnings.push({
          ruleId: 'AP-006',
          severity: 'warning',
          message: `'${name}'의 artifacts paths가 넓습니다.${hasDownstreamWithoutDeps ? ' downstream job이 dependencies를 지정하지 않아 불필요한 파일이 전달될 수 있습니다.' : ''}`,
          description: ap006.meta.description,
          location: { jobName: name, key: 'artifacts.paths' },
        });
      }
    }

    return warnings;
  },
};
