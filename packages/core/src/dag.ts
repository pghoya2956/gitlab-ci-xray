import type { GitLabCIConfig, JobConfig, DAGNode, NeedRef } from './types.js';
import { XRayError } from './types.js';

/**
 * Build a DAG (Directed Acyclic Graph) from a resolved GitLab CI config.
 *
 * Dependencies come from two sources:
 * 1. Stage ordering: jobs in later stages depend on all jobs in earlier stages
 * 2. `needs:` explicit dependencies that override stage ordering
 *
 * Special cases:
 * - `needs: []` — job has no dependencies, runs immediately
 * - `trigger:` — downstream pipeline node
 * - Hidden jobs (`.name`) are excluded from the DAG
 */
export function buildDAG(config: GitLabCIConfig, file = '.gitlab-ci.yml'): DAGNode[] {
  const visibleJobs = Object.entries(config.jobs).filter(([, job]) => !job._hidden);

  // Group jobs by stage
  const jobsByStage = new Map<string, string[]>();
  for (const stage of config.stages) {
    jobsByStage.set(stage, []);
  }
  for (const [name, job] of visibleJobs) {
    const list = jobsByStage.get(job.stage);
    if (list) {
      list.push(name);
    }
  }

  // Build stage index for ordering
  const stageIndex = new Map<string, number>();
  for (let i = 0; i < config.stages.length; i++) {
    stageIndex.set(config.stages[i], i);
  }

  const nodes: DAGNode[] = [];

  for (const [name, job] of visibleJobs) {
    const hasExplicitNeeds = job.needs != null;
    const needs: string[] = [];
    const stageNeeds: string[] = [];

    if (hasExplicitNeeds) {
      // Explicit needs override stage ordering
      for (const need of job.needs!) {
        const needName = normalizeNeed(need);
        if (needName) needs.push(needName);
      }
    } else {
      // Implicit stage dependencies: depend on all jobs in previous stages
      const currentStageIdx = stageIndex.get(job.stage) ?? -1;
      for (const [stage, stageJobs] of jobsByStage) {
        const idx = stageIndex.get(stage) ?? -1;
        if (idx < currentStageIdx) {
          stageNeeds.push(...stageJobs);
        }
      }
    }

    nodes.push({
      jobName: name,
      stage: job.stage,
      needs,
      stageNeeds,
      warnings: [],
      suggestions: [],
    });
  }

  // Cycle detection is delegated to AP-009 rule in the rule engine.
  // DAG builder only builds the graph structure.

  return topologicalSort(nodes, config.stages);
}

function normalizeNeed(need: string | NeedRef): string | null {
  if (typeof need === 'string') return need;
  return need.job;
}

/**
 * Topological sort: order by stage index, then by dependency depth within stage.
 */
function topologicalSort(nodes: DAGNode[], stages: string[]): DAGNode[] {
  const stageIndex = new Map<string, number>();
  for (let i = 0; i < stages.length; i++) {
    stageIndex.set(stages[i], i);
  }

  return [...nodes].sort((a, b) => {
    const sa = stageIndex.get(a.stage) ?? 999;
    const sb = stageIndex.get(b.stage) ?? 999;
    if (sa !== sb) return sa - sb;
    return a.jobName.localeCompare(b.jobName);
  });
}
