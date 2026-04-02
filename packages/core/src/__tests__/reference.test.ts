import { describe, it, expect } from 'vitest';
import { parseYaml } from '../parser.js';
import { interpretSchema } from '../schema.js';
import { resolveReferences } from '../resolver/reference.js';
import { XRayError, isReferenceMarker } from '../types.js';

function parseAndResolve(yaml: string, lenient = false) {
  const parsed = parseYaml(yaml);
  const config = interpretSchema(parsed);
  return resolveReferences(config, '.gitlab-ci.yml', { lenient });
}

describe('resolveReferences', () => {
  it('resolves !reference to a scalar value', () => {
    const config = parseAndResolve(`
.setup:
  image: node:20

build:
  image: !reference [.setup, image]
  script: echo "hi"
`);
    expect(config.jobs.build.image).toBe('node:20');
  });

  it('resolves !reference to an array and flattens in script', () => {
    const config = parseAndResolve(`
.setup:
  script:
    - echo "setup1"
    - echo "setup2"

build:
  script:
    - !reference [.setup, script]
    - echo "build"
`);
    expect(config.jobs.build.script).toEqual([
      'echo "setup1"',
      'echo "setup2"',
      'echo "build"',
    ]);
  });

  it('resolves nested !reference path', () => {
    const config = parseAndResolve(`
.config:
  artifacts:
    paths:
      - dist/
    expire_in: 1 week

build:
  script: echo "hi"
  artifacts:
    paths: !reference [.config, artifacts, paths]
`);
    const artifacts = config.jobs.build.artifacts;
    expect(artifacts?.paths).toEqual(['dist/']);
  });

  it('throws for non-existent job reference', () => {
    expect(() => parseAndResolve(`
build:
  image: !reference [.nonexistent, image]
  script: echo "hi"
`)).toThrow(XRayError);
  });

  it('throws for non-existent key reference', () => {
    expect(() => parseAndResolve(`
.setup:
  image: node:20

build:
  image: !reference [.setup, nonexistent_key]
  script: echo "hi"
`)).toThrow(XRayError);
  });

  it('resolves !reference to entire job', () => {
    const config = parseAndResolve(`
.setup:
  before_script:
    - echo "before"

build:
  before_script: !reference [.setup, before_script]
  script: echo "hi"
`);
    expect(config.jobs.build.before_script).toEqual(['echo "before"']);
  });

  it('handles config with no references', () => {
    const config = parseAndResolve(`
build:
  stage: build
  script: echo "hi"
`);
    expect(config.jobs.build.script).toEqual(['echo "hi"']);
  });

  it('lenient mode keeps marker for missing job', () => {
    const config = parseAndResolve(`
build:
  image: !reference [.nonexistent, image]
  script: echo "hi"
`, true);
    // In lenient mode, unresolved reference stays as ReferenceMarker
    expect(isReferenceMarker(config.jobs.build.image)).toBe(true);
  });

  it('lenient mode keeps marker in array context', () => {
    const config = parseAndResolve(`
build:
  rules:
    - !reference [.missing_rules, rules]
  script: echo "hi"
`, true);
    const rules = config.jobs.build.rules as unknown[];
    expect(rules).toHaveLength(1);
    expect(isReferenceMarker(rules[0])).toBe(true);
  });
});
