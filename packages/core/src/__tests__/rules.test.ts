import { describe, it, expect } from 'vitest';
import { runRules, allRules } from '../rules/index.js';
import type { GitLabCIConfig, JobConfig } from '../types.js';

function makeConfig(
  jobs: Record<string, Partial<JobConfig>>,
  overrides: Partial<GitLabCIConfig> = {},
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
    stages: overrides.stages ?? ['.pre', 'build', 'test', 'deploy', '.post'],
    variables: overrides.variables ?? {},
    default: overrides.default ?? {},
    workflow: overrides.workflow ?? null,
    jobs: fullJobs,
    includes: overrides.includes ?? [],
    resolvedJobs: {},
  };
}

function findRule(ruleId: string) {
  return allRules.find(r => r.id === ruleId)!;
}

describe('Anti-pattern rules', () => {
  describe('AP-001: only/except', () => {
    it('warns on only usage', () => {
      const config = makeConfig({
        build: { only: ['main'] },
      });
      const warnings = findRule('AP-001').check(config);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].ruleId).toBe('AP-001');
    });

    it('no warning when using rules', () => {
      const config = makeConfig({
        build: { rules: [{ if: '$CI_COMMIT_BRANCH == "main"' }] },
      });
      expect(findRule('AP-001').check(config)).toHaveLength(0);
    });
  });

  describe('AP-002: artifacts expire_in', () => {
    it('warns when expire_in missing', () => {
      const config = makeConfig({
        build: { artifacts: { paths: ['dist/'] } },
      });
      const warnings = findRule('AP-002').check(config);
      expect(warnings).toHaveLength(1);
    });

    it('no warning with expire_in set', () => {
      const config = makeConfig({
        build: { artifacts: { paths: ['dist/'], expire_in: '1 week' } },
      });
      expect(findRule('AP-002').check(config)).toHaveLength(0);
    });

    it('no warning for reports-only artifacts', () => {
      const config = makeConfig({
        test: { artifacts: { reports: { junit: 'report.xml' } } },
      });
      expect(findRule('AP-002').check(config)).toHaveLength(0);
    });
  });

  describe('AP-004: cache key', () => {
    it('warns when cache has paths but no key', () => {
      const config = makeConfig({
        build: { cache: { paths: ['node_modules/'] } },
      });
      expect(findRule('AP-004').check(config)).toHaveLength(1);
    });

    it('no warning with cache key set', () => {
      const config = makeConfig({
        build: { cache: { key: 'deps', paths: ['node_modules/'] } },
      });
      expect(findRule('AP-004').check(config)).toHaveLength(0);
    });
  });

  describe('AP-005: missing script', () => {
    it('errors when no script or trigger', () => {
      const config = makeConfig({
        build: { script: undefined },
      });
      expect(findRule('AP-005').check(config)).toHaveLength(1);
    });

    it('no error with trigger', () => {
      const config = makeConfig({
        deploy: { script: undefined, trigger: { project: 'other/project' } },
      });
      expect(findRule('AP-005').check(config)).toHaveLength(0);
    });
  });

  describe('AP-007: retry on network commands', () => {
    it('warns on npm ci without retry', () => {
      const config = makeConfig({
        build: { script: ['npm ci', 'npm run build'] },
      });
      expect(findRule('AP-007').check(config)).toHaveLength(1);
    });

    it('no warning when retry is set', () => {
      const config = makeConfig({
        build: { script: ['npm ci'], retry: 2 },
      });
      expect(findRule('AP-007').check(config)).toHaveLength(0);
    });

    it('detects curl in before_script', () => {
      const config = makeConfig({
        build: { before_script: ['curl -o file http://example.com'] },
      });
      expect(findRule('AP-007').check(config)).toHaveLength(1);
    });
  });

  describe('AP-012: empty rules', () => {
    it('errors on rules: []', () => {
      const config = makeConfig({
        build: { rules: [] },
      });
      expect(findRule('AP-012').check(config)).toHaveLength(1);
    });

    it('no error with non-empty rules', () => {
      const config = makeConfig({
        build: { rules: [{ if: '$CI' }] },
      });
      expect(findRule('AP-012').check(config)).toHaveLength(0);
    });
  });

  describe('AP-013: missing image', () => {
    it('warns when no image and no default', () => {
      const config = makeConfig({ build: {} });
      expect(findRule('AP-013').check(config)).toHaveLength(1);
    });

    it('no warning with default image', () => {
      const config = makeConfig({ build: {} }, { default: { image: 'node:20' } });
      expect(findRule('AP-013').check(config)).toHaveLength(0);
    });

    it('no warning with job-level image', () => {
      const config = makeConfig({ build: { image: 'node:20' } });
      expect(findRule('AP-013').check(config)).toHaveLength(0);
    });
  });

  describe('AP-003: parallel stage', () => {
    it('suggests needs for independent jobs in same stage', () => {
      const config = makeConfig({
        a: { stage: 'test' },
        b: { stage: 'test' },
      });
      expect(findRule('AP-003').check(config)).toHaveLength(1);
    });

    it('no suggestion when jobs use needs', () => {
      const config = makeConfig({
        a: { stage: 'test', needs: [] },
        b: { stage: 'test' },
      });
      expect(findRule('AP-003').check(config)).toHaveLength(0);
    });
  });

  describe('AP-006: broad artifacts', () => {
    it('warns on wildcard artifacts paths', () => {
      const config = makeConfig({
        build: { artifacts: { paths: ['**/*'] } },
      });
      expect(findRule('AP-006').check(config)).toHaveLength(1);
    });

    it('no warning on specific paths', () => {
      const config = makeConfig({
        build: { artifacts: { paths: ['dist/bundle.js'] } },
      });
      expect(findRule('AP-006').check(config)).toHaveLength(0);
    });
  });

  describe('AP-008: environment without resource_group', () => {
    it('warns on environment without resource_group', () => {
      const config = makeConfig({
        deploy: { environment: 'production' },
      });
      expect(findRule('AP-008').check(config)).toHaveLength(1);
    });

    it('no warning with resource_group', () => {
      const config = makeConfig({
        deploy: { environment: 'production', resource_group: 'prod' },
      });
      expect(findRule('AP-008').check(config)).toHaveLength(0);
    });
  });

  describe('AP-009: needs cycle', () => {
    it('detects cycle in needs', () => {
      const config = makeConfig({
        a: { stage: 'test', needs: ['b'] },
        b: { stage: 'test', needs: ['a'] },
      });
      const warnings = findRule('AP-009').check(config);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].severity).toBe('error');
    });

    it('no warning without cycle', () => {
      const config = makeConfig({
        a: { stage: 'build' },
        b: { stage: 'test', needs: ['a'] },
      });
      expect(findRule('AP-009').check(config)).toHaveLength(0);
    });
  });

  describe('AP-010: interruptible', () => {
    it('warns when interruptible not set', () => {
      const config = makeConfig({ build: {} });
      expect(findRule('AP-010').check(config)).toHaveLength(1);
    });

    it('no warning with default interruptible', () => {
      const config = makeConfig({ build: {} }, { default: { interruptible: true } });
      expect(findRule('AP-010').check(config)).toHaveLength(0);
    });

    it('no warning for manual jobs', () => {
      const config = makeConfig({ deploy: { when: 'manual' } });
      expect(findRule('AP-010').check(config)).toHaveLength(0);
    });
  });

  describe('AP-011: duplicate script', () => {
    it('detects similar scripts between jobs', () => {
      const config = makeConfig({
        a: { script: ['npm ci', 'npm run build', 'npm test', 'npm run lint'] },
        b: { script: ['npm ci', 'npm run build', 'npm test', 'npm run deploy'] },
      });
      // 3/4 = 0.75 > 0.7 threshold
      expect(findRule('AP-011').check(config)).toHaveLength(1);
    });

    it('no warning for different scripts', () => {
      const config = makeConfig({
        a: { script: ['mvn package'] },
        b: { script: ['npm run build'] },
      });
      expect(findRule('AP-011').check(config)).toHaveLength(0);
    });
  });

  describe('AP-015: allow_failure + rules', () => {
    it('warns on simultaneous allow_failure and rules[].allow_failure', () => {
      const config = makeConfig({
        build: {
          allow_failure: true,
          rules: [{ if: '$CI', allow_failure: false }],
        },
      });
      expect(findRule('AP-015').check(config)).toHaveLength(1);
    });

    it('no warning without rules allow_failure', () => {
      const config = makeConfig({
        build: {
          allow_failure: true,
          rules: [{ if: '$CI' }],
        },
      });
      expect(findRule('AP-015').check(config)).toHaveLength(0);
    });
  });

  describe('AP-016: unsafe variable in destructive command', () => {
    it('warns on rm -rf with unchecked variable', () => {
      const config = makeConfig({
        clean: { script: ['rm -rf ${DEPLOY_DIR}/*'] },
      });
      expect(findRule('AP-016').check(config)).toHaveLength(1);
    });

    it('no warning with safe guard', () => {
      const config = makeConfig({
        clean: { script: ['${DEPLOY_DIR:?must be set}', 'rm -rf ${DEPLOY_DIR}/*'] },
      });
      expect(findRule('AP-016').check(config)).toHaveLength(0);
    });

    it('no warning without destructive command', () => {
      const config = makeConfig({
        build: { script: ['echo $HOME'] },
      });
      expect(findRule('AP-016').check(config)).toHaveLength(0);
    });

    it('warns on rsync --delete with variable', () => {
      const config = makeConfig({
        deploy: { script: ['rsync -avz --delete ./dist/ ${REMOTE_PATH}'] },
      });
      expect(findRule('AP-016').check(config)).toHaveLength(1);
    });
  });

  describe('AP-017: duplicate rules block', () => {
    it('warns when 3+ jobs have identical rules', () => {
      const sharedRules = [{ if: '$CI_COMMIT_BRANCH == "main"' }, { if: '$CI_PIPELINE_SOURCE == "merge_request_event"' }];
      const config = makeConfig({
        a: { rules: sharedRules },
        b: { rules: sharedRules },
        c: { rules: sharedRules },
      });
      expect(findRule('AP-017').check(config)).toHaveLength(1);
    });

    it('no warning with fewer than 3 duplicates', () => {
      const sharedRules = [{ if: '$CI_COMMIT_BRANCH == "main"' }];
      const config = makeConfig({
        a: { rules: sharedRules },
        b: { rules: sharedRules },
      });
      expect(findRule('AP-017').check(config)).toHaveLength(0);
    });

    it('no warning when rules differ', () => {
      const config = makeConfig({
        a: { rules: [{ if: '$CI_COMMIT_BRANCH == "main"' }] },
        b: { rules: [{ if: '$CI_COMMIT_BRANCH == "develop"' }] },
        c: { rules: [{ if: '$CI_COMMIT_TAG' }] },
      });
      expect(findRule('AP-017').check(config)).toHaveLength(0);
    });
  });

  describe('AP-014: undefined stage', () => {
    it('errors on undefined stage', () => {
      const config = makeConfig(
        { build: { stage: 'nonexistent' } },
        { stages: ['build', 'test'] },
      );
      expect(findRule('AP-014').check(config)).toHaveLength(1);
    });

    it('no error with valid stage', () => {
      const config = makeConfig(
        { build: { stage: 'build' } },
        { stages: ['build', 'test'] },
      );
      expect(findRule('AP-014').check(config)).toHaveLength(0);
    });
  });
});

describe('runRules', () => {
  it('filters by minSeverity', () => {
    const config = makeConfig({
      build: { only: ['main'] }, // AP-001 warning
    });

    const allWarnings = runRules(allRules, config);
    const errorsOnly = runRules(allRules, config, { minSeverity: 'error' });

    expect(errorsOnly.length).toBeLessThanOrEqual(allWarnings.length);
  });

  it('excludes specific rules', () => {
    const config = makeConfig({
      build: { only: ['main'] },
    });

    const without = runRules(allRules, config, { exclude: ['AP-001'] });
    const has001 = without.some(w => w.ruleId === 'AP-001');
    expect(has001).toBe(false);
  });

  it('sorts by severity (error first)', () => {
    const config = makeConfig({
      build: { script: undefined, only: ['main'] }, // AP-005 error + AP-001 warning
    });

    const warnings = runRules(allRules, config);
    if (warnings.length >= 2) {
      const firstError = warnings.findIndex(w => w.severity === 'error');
      const firstWarning = warnings.findIndex(w => w.severity === 'warning');
      if (firstError >= 0 && firstWarning >= 0) {
        expect(firstError).toBeLessThan(firstWarning);
      }
    }
  });
});
