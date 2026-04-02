import { describe, it, expect } from 'vitest';
import { buildDAG } from '../dag.js';
import type { GitLabCIConfig, JobConfig } from '../types.js';

function makeConfig(
  stages: string[],
  jobs: Record<string, Partial<JobConfig>>,
): GitLabCIConfig {
  const fullJobs: Record<string, JobConfig> = {};
  for (const [name, partial] of Object.entries(jobs)) {
    fullJobs[name] = {
      stage: partial.stage ?? 'test',
      script: partial.script ?? ['echo hi'],
      ...partial,
    } as JobConfig;
  }
  return {
    stages,
    variables: {},
    default: {},
    workflow: null,
    jobs: fullJobs,
    includes: [],
    resolvedJobs: {},
  };
}

describe('buildDAG', () => {
  it('builds DAG with stage-based dependencies', () => {
    const config = makeConfig(['build', 'test', 'deploy'], {
      compile: { stage: 'build' },
      lint: { stage: 'build' },
      'unit-test': { stage: 'test' },
      deploy: { stage: 'deploy' },
    });

    const dag = buildDAG(config);

    expect(dag).toHaveLength(4);

    // Build stage has no dependencies
    const compile = dag.find(n => n.jobName === 'compile')!;
    expect(compile.stageNeeds).toHaveLength(0);
    expect(compile.needs).toHaveLength(0);

    // Test stage depends on build stage jobs
    const unitTest = dag.find(n => n.jobName === 'unit-test')!;
    expect(unitTest.stageNeeds).toContain('compile');
    expect(unitTest.stageNeeds).toContain('lint');

    // Deploy depends on build + test
    const deployNode = dag.find(n => n.jobName === 'deploy')!;
    expect(deployNode.stageNeeds).toHaveLength(3);
  });

  it('uses explicit needs instead of stage deps', () => {
    const config = makeConfig(['build', 'test'], {
      compile: { stage: 'build' },
      lint: { stage: 'build' },
      'unit-test': { stage: 'test', needs: ['compile'] },
    });

    const dag = buildDAG(config);
    const unitTest = dag.find(n => n.jobName === 'unit-test')!;

    expect(unitTest.needs).toEqual(['compile']);
    expect(unitTest.stageNeeds).toHaveLength(0);
  });

  it('handles needs: [] (no dependencies)', () => {
    const config = makeConfig(['build', 'test'], {
      compile: { stage: 'build' },
      'fast-test': { stage: 'test', needs: [] },
    });

    const dag = buildDAG(config);
    const fastTest = dag.find(n => n.jobName === 'fast-test')!;

    expect(fastTest.needs).toHaveLength(0);
    expect(fastTest.stageNeeds).toHaveLength(0);
  });

  it('excludes hidden jobs', () => {
    const config = makeConfig(['build'], {
      '.base': { stage: 'build', _hidden: true },
      compile: { stage: 'build' },
    });

    const dag = buildDAG(config);
    expect(dag).toHaveLength(1);
    expect(dag[0].jobName).toBe('compile');
  });

  it('builds DAG even with cycles (cycle detection delegated to rules)', () => {
    const config = makeConfig(['test'], {
      a: { stage: 'test', needs: ['b'] },
      b: { stage: 'test', needs: ['a'] },
    });

    const dag = buildDAG(config);
    expect(dag).toHaveLength(2);
    expect(dag.find(n => n.jobName === 'a')?.needs).toEqual(['b']);
  });

  it('returns nodes in topological order', () => {
    const config = makeConfig(['build', 'test', 'deploy'], {
      deploy: { stage: 'deploy' },
      compile: { stage: 'build' },
      'unit-test': { stage: 'test' },
    });

    const dag = buildDAG(config);
    const stages = dag.map(n => n.stage);
    expect(stages).toEqual(['build', 'test', 'deploy']);
  });

  it('handles NeedRef objects', () => {
    const config = makeConfig(['build', 'test'], {
      compile: { stage: 'build' },
      'unit-test': {
        stage: 'test',
        needs: [{ job: 'compile', artifacts: true }],
      },
    });

    const dag = buildDAG(config);
    const unitTest = dag.find(n => n.jobName === 'unit-test')!;
    expect(unitTest.needs).toEqual(['compile']);
  });
});
