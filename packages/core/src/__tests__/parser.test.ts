import { describe, it, expect } from 'vitest';
import { parseYaml, buildDetailedLineMap } from '../parser.js';
import { isReferenceMarker, XRayError } from '../types.js';

describe('parseYaml', () => {
  it('parses a simple YAML document', () => {
    const { data } = parseYaml(`
stages:
  - build
  - test

build-job:
  stage: build
  script:
    - echo "hello"
`);
    expect(data.stages).toEqual(['build', 'test']);
    expect(data['build-job']).toBeDefined();
  });

  it('preserves anchor/alias resolution', () => {
    const { data } = parseYaml(`
.common: &common
  image: node:20
  tags:
    - docker

build:
  <<: *common
  script:
    - npm run build
`);
    const build = data.build as Record<string, unknown>;
    expect(build.image).toBe('node:20');
    expect(build.tags).toEqual(['docker']);
    expect(build.script).toEqual(['npm run build']);
  });

  it('parses !reference tags into ReferenceMarker', () => {
    const { data } = parseYaml(`
.setup:
  script:
    - echo "setup"

job:
  script:
    - !reference [.setup, script]
`);
    const job = data.job as Record<string, unknown>;
    const script = job.script as unknown[];
    expect(script).toHaveLength(1);
    expect(isReferenceMarker(script[0])).toBe(true);
    if (isReferenceMarker(script[0])) {
      expect(script[0].path).toEqual(['.setup', 'script']);
    }
  });

  it('builds top-level line map', () => {
    const { lineMap } = parseYaml(`stages:
  - build

build-job:
  stage: build

test-job:
  stage: test
`);
    expect(lineMap.get('stages')).toBe(1);
    expect(lineMap.get('build-job')).toBe(4);
    expect(lineMap.get('test-job')).toBe(7);
  });

  it('throws XRayError for empty YAML', () => {
    expect(() => parseYaml('')).toThrow(XRayError);
  });

  it('throws XRayError for invalid YAML', () => {
    try {
      parseYaml('  invalid:\n  yaml: [}');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(XRayError);
      expect((err as XRayError).file).toBe('.gitlab-ci.yml');
    }
  });

  it('throws XRayError for non-object YAML', () => {
    expect(() => parseYaml('- item1\n- item2')).toThrow(XRayError);
  });

  it('preserves custom file name in errors', () => {
    try {
      parseYaml('', 'custom/ci.yml');
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as XRayError).file).toBe('custom/ci.yml');
    }
  });

  it('handles duplicate keys (last wins)', () => {
    const { data } = parseYaml(`
build:
  stage: build
  script: echo "first"
  script: echo "second"
`);
    const build = data.build as Record<string, unknown>;
    expect(build.script).toBe('echo "second"');
  });
});

describe('buildDetailedLineMap', () => {
  it('maps nested keys within jobs', () => {
    const map = buildDetailedLineMap(`build-job:
  stage: build
  script:
    - echo "hello"
  artifacts:
    paths:
      - dist/
`);
    expect(map.get('build-job')).toBe(1);
    expect(map.get('build-job.stage')).toBe(2);
    expect(map.get('build-job.script')).toBe(3);
    expect(map.get('build-job.artifacts')).toBe(5);
  });
});
