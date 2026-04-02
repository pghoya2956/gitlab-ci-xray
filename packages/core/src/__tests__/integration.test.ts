import { describe, it, expect } from 'vitest';
import { parse } from '../index.js';

describe('parse (full pipeline)', () => {
  it('parses a complete GitLab CI config', async () => {
    const yaml = `
stages:
  - build
  - test
  - deploy

variables:
  NODE_VERSION: "20"

.base:
  image: node:20
  before_script:
    - npm ci

build-frontend:
  extends: .base
  stage: build
  script:
    - npm run build
  artifacts:
    paths:
      - dist/

build-backend:
  extends: .base
  stage: build
  script:
    - mvn package

test-unit:
  extends: .base
  stage: test
  needs:
    - build-frontend
    - build-backend
  script:
    - npm test

deploy-prod:
  stage: deploy
  image: alpine:latest
  script:
    - ./deploy.sh
  when: manual
  environment:
    name: production
    url: https://example.com
`;
    const { config } = await parse(yaml);

    // Stages
    expect(config.stages).toEqual(['build', 'test', 'deploy']);

    // Variables
    expect(config.variables.NODE_VERSION).toBe('20');

    // Jobs resolved
    expect(Object.keys(config.jobs).filter(n => !n.startsWith('.'))).toHaveLength(4);

    // extends resolved — build-frontend has image from .base
    expect(config.jobs['build-frontend'].image).toBe('node:20');
    expect(config.jobs['build-frontend'].before_script).toEqual(['npm ci']);
    expect(config.jobs['build-frontend'].extends).toBeUndefined();

    // deploy-prod has its own image
    expect(config.jobs['deploy-prod'].image).toBe('alpine:latest');
    expect(config.jobs['deploy-prod'].when).toBe('manual');
  });

  it('handles !reference in full pipeline', async () => {
    const yaml = `
.common-setup:
  before_script:
    - echo "installing deps"
    - npm ci

.common-artifacts:
  artifacts:
    paths:
      - dist/
    expire_in: 1 week

build:
  stage: build
  before_script:
    - !reference [.common-setup, before_script]
  script:
    - npm run build
  artifacts: !reference [.common-artifacts, artifacts]
`;
    const { config } = await parse(yaml);

    expect(config.jobs.build.before_script).toEqual([
      'echo "installing deps"',
      'npm ci',
    ]);
    expect(config.jobs.build.artifacts?.paths).toEqual(['dist/']);
    expect(config.jobs.build.artifacts?.expire_in).toBe('1 week');
  });

  it('handles extends + !reference combination', async () => {
    const yaml = `
.base:
  tags:
    - docker

.scripts:
  script:
    - echo "common"

build:
  extends: .base
  script:
    - !reference [.scripts, script]
    - echo "build"
`;
    const { config } = await parse(yaml);

    expect(config.jobs.build.tags).toEqual(['docker']);
    expect(config.jobs.build.script).toEqual(['echo "common"', 'echo "build"']);
  });

  it('handles config with includes (no resolver)', async () => {
    const yaml = `
include:
  - local: /ci/build.yml

stages:
  - test

test-job:
  stage: test
  script: echo "test"
`;
    const { config, unresolvedIncludes } = await parse(yaml);

    // Without resolver, includes are not resolved
    expect(config.includes).toHaveLength(1);
    expect(unresolvedIncludes).toHaveLength(0); // No resolver = not attempted
    expect(config.jobs['test-job']).toBeDefined();
  });

  it('handles config with includes (with resolver)', async () => {
    const mainYaml = `
include:
  - local: /ci/build.yml

stages:
  - build
  - test

test-job:
  stage: test
  script: echo "test"
`;
    const includeYaml = `
build-job:
  stage: build
  script: echo "build"
`;

    const { config } = await parse(mainYaml, {
      resolver: {
        async readFile(path) {
          if (path === '/project/ci/build.yml') return includeYaml;
          return null;
        },
        async fetchUrl() { return null; },
      },
      basePath: '/project',
    });

    expect(config.jobs['build-job']).toBeDefined();
    expect(config.jobs['test-job']).toBeDefined();
  });
});
