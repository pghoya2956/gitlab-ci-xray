import type { Rule } from './engine.js';
import type { AntiPatternWarning, NeedRef } from '../types.js';

/** AP-009: needs 그래프 순환 의존 */
export const ap009: Rule = {
  id: 'AP-009',
  severity: 'error',
  meta: {
    name: 'needs 순환 의존',
    description: 'needs 그래프에 순환이 있으면 파이프라인이 실행되지 않습니다.',
  },
  check(config) {
    const warnings: AntiPatternWarning[] = [];

    // Build adjacency list
    const adj = new Map<string, string[]>();
    for (const [name, job] of Object.entries(config.jobs)) {
      if (job._hidden) continue;
      if (!job.needs) continue;
      const deps = job.needs.map(n => typeof n === 'string' ? n : (n as NeedRef).job);
      adj.set(name, deps);
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();

    function dfs(name: string, path: string[]): void {
      if (inStack.has(name)) {
        const start = path.indexOf(name);
        const cycle = [...path.slice(start), name];
        warnings.push({
          ruleId: 'AP-009',
          severity: 'error',
          message: `needs 순환 의존: ${cycle.join(' → ')}`,
          description: ap009.meta.description,
          location: { jobName: name, key: 'needs' },
        });
        return;
      }
      if (visited.has(name)) return;

      visited.add(name);
      inStack.add(name);
      for (const dep of adj.get(name) ?? []) {
        dfs(dep, [...path, name]);
      }
      inStack.delete(name);
    }

    for (const name of adj.keys()) {
      if (!visited.has(name)) dfs(name, []);
    }

    return warnings;
  },
};
