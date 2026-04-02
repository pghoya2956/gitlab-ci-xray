import { describe, it, expect } from 'vitest';
import { parseYaml } from '../parser.js';
import { interpretSchema } from '../schema.js';
import { resolveExtends } from '../resolver/extends.js';
import { XRayError } from '../types.js';

function parseAndResolve(yaml: string) {
  const parsed = parseYaml(yaml);
  const config = interpretSchema(parsed);
  return resolveExtends(config);
}

describe('resolveExtends', () => {
  it('resolves single extends', () => {
    const config = parseAndResolve(`
.base:
  image: node:20
  tags:
    - docker

build:
  extends: .base
  stage: build
  script: npm run build
`);
    expect(config.jobs.build.image).toBe('node:20');
    expect(config.jobs.build.tags).toEqual(['docker']);
    expect(config.jobs.build.script).toEqual(['npm run build']);
  });

  it('resolves multiple extends (left to right)', () => {
    const config = parseAndResolve(`
.image:
  image: node:20

.tags:
  tags:
    - docker

build:
  extends:
    - .image
    - .tags
  script: npm run build
`);
    expect(config.jobs.build.image).toBe('node:20');
    expect(config.jobs.build.tags).toEqual(['docker']);
  });

  it('child overrides parent', () => {
    const config = parseAndResolve(`
.base:
  image: node:18
  script:
    - echo "parent"

build:
  extends: .base
  image: node:20
  script:
    - echo "child"
`);
    expect(config.jobs.build.image).toBe('node:20');
    expect(config.jobs.build.script).toEqual(['echo "child"']);
  });

  it('deep merges objects', () => {
    const config = parseAndResolve(`
.base:
  variables:
    FOO: bar
    BAZ: qux

build:
  extends: .base
  variables:
    FOO: overridden
    NEW: added
  script: echo "hi"
`);
    const vars = config.jobs.build.variables as Record<string, string>;
    expect(vars.FOO).toBe('overridden');
    expect(vars.BAZ).toBe('qux');
    expect(vars.NEW).toBe('added');
  });

  it('replaces arrays (does not merge)', () => {
    const config = parseAndResolve(`
.base:
  tags:
    - docker
    - linux

build:
  extends: .base
  tags:
    - k8s
  script: echo "hi"
`);
    expect(config.jobs.build.tags).toEqual(['k8s']);
  });

  it('resolves chain inheritance', () => {
    const config = parseAndResolve(`
.grandparent:
  image: node:18

.parent:
  extends: .grandparent
  tags:
    - docker

build:
  extends: .parent
  script: echo "hi"
`);
    expect(config.jobs.build.image).toBe('node:18');
    expect(config.jobs.build.tags).toEqual(['docker']);
  });

  it('removes extends from resolved jobs', () => {
    const config = parseAndResolve(`
.base:
  image: node:20

build:
  extends: .base
  script: echo "hi"
`);
    expect(config.jobs.build.extends).toBeUndefined();
  });

  it('throws on circular reference', () => {
    expect(() => parseAndResolve(`
.a:
  extends: .b
  script: echo "a"

.b:
  extends: .a
  script: echo "b"

build:
  extends: .a
  stage: build
`)).toThrow(XRayError);
  });

  it('throws on non-existent extends target', () => {
    expect(() => parseAndResolve(`
build:
  extends: .nonexistent
  script: echo "hi"
`)).toThrow(XRayError);
  });

  it('handles job with no extends', () => {
    const config = parseAndResolve(`
build:
  stage: build
  script: echo "hi"
`);
    expect(config.jobs.build.script).toEqual(['echo "hi"']);
  });

  it('null in child removes parent key', () => {
    const config = parseAndResolve(`
.base:
  image: node:20
  before_script:
    - npm ci
  cache:
    key: deps
    paths:
      - node_modules/

build:
  extends: .base
  before_script: null
  cache: null
  script: echo "build"
`);
    expect(config.jobs.build.image).toBe('node:20');
    expect(config.jobs.build.before_script).toBeUndefined();
    expect(config.jobs.build.cache).toBeUndefined();
  });

  it('deep merges nested objects (3+ levels)', () => {
    const config = parseAndResolve(`
.base:
  artifacts:
    reports:
      junit: parent-report.xml
    paths:
      - dist/

build:
  extends: .base
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage.xml
  script: echo "build"
`);
    const artifacts = config.jobs.build.artifacts as Record<string, unknown>;
    const reports = artifacts.reports as Record<string, unknown>;
    expect(reports.junit).toBe('parent-report.xml');
    expect(reports.coverage_report).toBeDefined();
    expect(artifacts.paths).toEqual(['dist/']);
  });
});
