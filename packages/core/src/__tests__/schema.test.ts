import { describe, it, expect } from 'vitest';
import { parseYaml } from '../parser.js';
import { interpretSchema, validateStageRefs } from '../schema.js';

describe('interpretSchema', () => {
  it('extracts stages', () => {
    const parsed = parseYaml(`
stages:
  - build
  - test
  - deploy

build-job:
  stage: build
  script: echo "hi"
`);
    const config = interpretSchema(parsed);
    expect(config.stages).toEqual(['build', 'test', 'deploy']);
  });

  it('uses default stages when none specified', () => {
    const parsed = parseYaml(`
build-job:
  script: echo "hi"
`);
    const config = interpretSchema(parsed);
    expect(config.stages).toEqual(['.pre', 'build', 'test', 'deploy', '.post']);
  });

  it('extracts jobs and skips global keywords', () => {
    const parsed = parseYaml(`
stages:
  - build

variables:
  CI: "true"

image: node:20

build-job:
  stage: build
  script: echo "hi"

test-job:
  stage: test
  script: echo "test"
`);
    const config = interpretSchema(parsed);
    expect(Object.keys(config.jobs)).toEqual(['build-job', 'test-job']);
    expect(config.jobs['build-job'].stage).toBe('build');
    expect(config.variables).toEqual({ CI: 'true' });
  });

  it('identifies hidden jobs', () => {
    const parsed = parseYaml(`
.base:
  image: node:20

build-job:
  extends: .base
  script: echo "hi"
`);
    const config = interpretSchema(parsed);
    expect(config.jobs['.base']._hidden).toBe(true);
    expect(config.jobs['build-job']._hidden).toBe(false);
  });

  it('defaults job stage to "test"', () => {
    const parsed = parseYaml(`
build-job:
  script: echo "hi"
`);
    const config = interpretSchema(parsed);
    expect(config.jobs['build-job'].stage).toBe('test');
  });

  it('normalizes script to array', () => {
    const parsed = parseYaml(`
build-job:
  script: echo "single command"
`);
    const config = interpretSchema(parsed);
    expect(config.jobs['build-job'].script).toEqual(['echo "single command"']);
  });

  it('normalizes extends to array', () => {
    const parsed = parseYaml(`
.base:
  image: node:20

build-job:
  extends: .base
  script: echo "hi"
`);
    const config = interpretSchema(parsed);
    expect(config.jobs['build-job'].extends).toEqual(['.base']);
  });

  it('extracts includes', () => {
    const parsed = parseYaml(`
include:
  - local: /ci/build.yml
  - template: Jobs/Build.gitlab-ci.yml
  - remote: https://example.com/ci.yml

build-job:
  script: echo "hi"
`);
    const config = interpretSchema(parsed);
    expect(config.includes).toHaveLength(3);
    expect(config.includes[0]).toEqual({ local: '/ci/build.yml' });
    expect(config.includes[1]).toEqual({ template: 'Jobs/Build.gitlab-ci.yml' });
    expect(config.includes[2]).toEqual({ remote: 'https://example.com/ci.yml' });
  });

  it('handles single string include', () => {
    const parsed = parseYaml(`
include: /ci/build.yml

build-job:
  script: echo "hi"
`);
    const config = interpretSchema(parsed);
    expect(config.includes).toEqual([{ local: '/ci/build.yml' }]);
  });

  it('extracts global-level defaults', () => {
    const parsed = parseYaml(`
image: node:20
before_script:
  - npm ci

build-job:
  script: npm run build
`);
    const config = interpretSchema(parsed);
    expect(config.default.image).toBe('node:20');
    expect(config.default.before_script).toEqual(['npm ci']);
  });

  it('extracts explicit default block', () => {
    const parsed = parseYaml(`
default:
  image: node:20
  retry: 2

build-job:
  script: npm run build
`);
    const config = interpretSchema(parsed);
    expect(config.default.image).toBe('node:20');
    expect(config.default.retry).toBe(2);
  });

  it('extracts variables with descriptions', () => {
    const parsed = parseYaml(`
variables:
  DEPLOY_ENVIRONMENT:
    value: staging
    description: Target environment
    options:
      - staging
      - production
  SIMPLE_VAR: "hello"

build-job:
  script: echo "hi"
`);
    const config = interpretSchema(parsed);
    expect(config.variables.SIMPLE_VAR).toBe('hello');
    const deployVar = config.variables.DEPLOY_ENVIRONMENT;
    expect(typeof deployVar).toBe('object');
    if (typeof deployVar === 'object') {
      expect(deployVar.value).toBe('staging');
      expect(deployVar.description).toBe('Target environment');
      expect(deployVar.options).toEqual(['staging', 'production']);
    }
  });

  it('extracts workflow', () => {
    const parsed = parseYaml(`
workflow:
  name: "Pipeline for $CI_COMMIT_BRANCH"
  rules:
    - if: $CI_COMMIT_BRANCH

build-job:
  script: echo "hi"
`);
    const config = interpretSchema(parsed);
    expect(config.workflow).not.toBeNull();
    expect(config.workflow?.name).toBe('Pipeline for $CI_COMMIT_BRANCH');
  });
});

describe('validateStageRefs', () => {
  it('detects undefined stage references', () => {
    const parsed = parseYaml(`
stages:
  - build

build-job:
  stage: build
  script: echo "hi"

test-job:
  stage: nonexistent
  script: echo "test"
`);
    const config = interpretSchema(parsed);
    const errors = validateStageRefs(config);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('nonexistent');
  });

  it('skips hidden jobs', () => {
    const parsed = parseYaml(`
stages:
  - build

.hidden:
  stage: any-stage
  image: node:20

build-job:
  stage: build
  script: echo "hi"
`);
    const config = interpretSchema(parsed);
    const errors = validateStageRefs(config);
    expect(errors).toHaveLength(0);
  });
});
