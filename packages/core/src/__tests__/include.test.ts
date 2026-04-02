import { describe, it, expect } from 'vitest';
import { parseYaml } from '../parser.js';
import { interpretSchema } from '../schema.js';
import { resolveIncludes } from '../resolver/include.js';
import type { FileResolver } from '../types.js';
import { XRayError } from '../types.js';

function mockResolver(files: Record<string, string>): FileResolver {
  return {
    async readFile(path: string) {
      return files[path] ?? null;
    },
    async fetchUrl(url: string) {
      return files[url] ?? null;
    },
  };
}

describe('resolveIncludes', () => {
  it('resolves include:local', async () => {
    const mainYaml = `
include:
  - local: /ci/build.yml

test-job:
  stage: test
  script: echo "test"
`;
    const includeYaml = `
build-job:
  stage: build
  script: echo "build"
`;
    const parsed = parseYaml(mainYaml);
    const config = interpretSchema(parsed);
    const resolver = mockResolver({ '/project/ci/build.yml': includeYaml });

    const { config: resolved, unresolvedIncludes } = await resolveIncludes(
      config,
      resolver,
      '/project',
    );

    expect(unresolvedIncludes).toHaveLength(0);
    expect(resolved.jobs['build-job']).toBeDefined();
    expect(resolved.jobs['test-job']).toBeDefined();
  });

  it('main file overrides include', async () => {
    const mainYaml = `
include:
  - local: /ci/base.yml

build-job:
  stage: build
  script: echo "main"
  image: node:20
`;
    const includeYaml = `
build-job:
  stage: build
  script: echo "include"
  image: node:18
  tags:
    - docker
`;
    const parsed = parseYaml(mainYaml);
    const config = interpretSchema(parsed);
    const resolver = mockResolver({ '/project/ci/base.yml': includeYaml });

    const { config: resolved } = await resolveIncludes(config, resolver, '/project');

    // Main file overrides
    expect(resolved.jobs['build-job'].script).toEqual(['echo "main"']);
    expect(resolved.jobs['build-job'].image).toBe('node:20');
    // Include's tags are preserved (not in main)
    expect(resolved.jobs['build-job'].tags).toEqual(['docker']);
  });

  it('marks unresolved includes', async () => {
    const mainYaml = `
include:
  - local: /ci/missing.yml
  - template: Jobs/Build.gitlab-ci.yml

build-job:
  script: echo "hi"
`;
    const parsed = parseYaml(mainYaml);
    const config = interpretSchema(parsed);
    const resolver = mockResolver({}); // No files available

    const { unresolvedIncludes } = await resolveIncludes(config, resolver, '/project');

    expect(unresolvedIncludes).toHaveLength(2);
  });

  it('handles no includes', async () => {
    const mainYaml = `
build-job:
  script: echo "hi"
`;
    const parsed = parseYaml(mainYaml);
    const config = interpretSchema(parsed);
    const resolver = mockResolver({});

    const { config: resolved, unresolvedIncludes } = await resolveIncludes(
      config,
      resolver,
      '/project',
    );

    expect(unresolvedIncludes).toHaveLength(0);
    expect(resolved.jobs['build-job']).toBeDefined();
  });

  it('handles null resolver', async () => {
    const mainYaml = `
include:
  - local: /ci/build.yml

build-job:
  script: echo "hi"
`;
    const parsed = parseYaml(mainYaml);
    const config = interpretSchema(parsed);

    const { unresolvedIncludes } = await resolveIncludes(config, null, '/project');

    expect(unresolvedIncludes).toHaveLength(0); // No resolver = no resolution attempted
  });

  it('resolves include:remote', async () => {
    const mainYaml = `
include:
  - remote: https://example.com/ci.yml

test-job:
  script: echo "test"
`;
    const remoteYaml = `
remote-job:
  stage: build
  script: echo "remote"
`;
    const parsed = parseYaml(mainYaml);
    const config = interpretSchema(parsed);
    const resolver = mockResolver({ 'https://example.com/ci.yml': remoteYaml });

    const { config: resolved } = await resolveIncludes(config, resolver, '/project');

    expect(resolved.jobs['remote-job']).toBeDefined();
    expect(resolved.jobs['test-job']).toBeDefined();
  });

  it('merges multiple includes in order', async () => {
    const mainYaml = `
include:
  - local: /ci/first.yml
  - local: /ci/second.yml

main-job:
  script: echo "main"
`;
    const firstYaml = `
shared-job:
  image: node:18
  script: echo "first"
`;
    const secondYaml = `
shared-job:
  image: node:20
  tags:
    - docker
`;
    const parsed = parseYaml(mainYaml);
    const config = interpretSchema(parsed);
    const resolver = mockResolver({
      '/project/ci/first.yml': firstYaml,
      '/project/ci/second.yml': secondYaml,
    });

    const { config: resolved } = await resolveIncludes(config, resolver, '/project');

    // Second include overrides first
    expect(resolved.jobs['shared-job'].image).toBe('node:20');
    // First include's script is overridden (arrays replace)
    expect(resolved.jobs['shared-job'].tags).toEqual(['docker']);
  });

  it('rejects path traversal in include:local', async () => {
    const mainYaml = `
include:
  - local: /../../../etc/passwd

build-job:
  script: echo "hi"
`;
    const parsed = parseYaml(mainYaml);
    const config = interpretSchema(parsed);
    const resolver = mockResolver({});

    const { errors } = await resolveIncludes(config, resolver, '/project');

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('프로젝트 루트 밖');
  });

  it('preserves parse error details in errors array', async () => {
    const mainYaml = `
include:
  - local: /ci/broken.yml

build-job:
  script: echo "hi"
`;
    const brokenYaml = `  invalid:\n  yaml: [}`;
    const parsed = parseYaml(mainYaml);
    const config = interpretSchema(parsed);
    const resolver = mockResolver({ '/project/ci/broken.yml': brokenYaml });

    const { unresolvedIncludes, errors } = await resolveIncludes(config, resolver, '/project');

    expect(unresolvedIncludes).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBeTruthy();
  });
});
