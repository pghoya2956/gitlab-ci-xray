import type { FileResolver, GitLabCIConfig, IncludeRef } from '../types.js';
import { XRayError } from '../types.js';
import { parseYaml } from '../parser.js';
import { interpretSchema } from '../schema.js';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface IncludeError {
  ref: IncludeRef;
  message: string;
}

export interface IncludeResult {
  config: GitLabCIConfig;
  unresolvedIncludes: IncludeRef[];
  errors: IncludeError[];
}

/**
 * Resolve all `include:` directives by reading external files
 * and merging them into the config.
 *
 * GitLab include merge order:
 * 1. First included file
 * 2. Second included file (overrides first)
 * 3. ... more includes
 * 4. Main file (overrides all includes)
 */
export async function resolveIncludes(
  config: GitLabCIConfig,
  resolver: FileResolver | null,
  basePath: string,
  file = '.gitlab-ci.yml',
): Promise<IncludeResult> {
  if (config.includes.length === 0 || resolver == null) {
    return { config, unresolvedIncludes: [], errors: [] };
  }

  const unresolved: IncludeRef[] = [];
  const errors: IncludeError[] = [];
  let merged: Record<string, unknown> = {};

  for (const ref of config.includes) {
    try {
      const content = await fetchInclude(ref, resolver, basePath);

      if (content == null) {
        unresolved.push(ref);
        continue;
      }

      const includeFile = getIncludeFileName(ref);
      const parsed = parseYaml(content, includeFile);
      const includeConfig = interpretSchema(parsed, includeFile);

      // Merge include's jobs and variables into accumulated result
      merged = deepMergeRaw(merged, rawFromConfig(includeConfig));
    } catch (err: unknown) {
      unresolved.push(ref);
      errors.push({
        ref,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Main file overrides all includes
  const mainRaw = rawFromConfig(config);
  merged = deepMergeRaw(merged, mainRaw);

  // Re-interpret the merged result
  const mergedParsed = { data: merged, lineMap: new Map<string, number>() };
  const mergedConfig = interpretSchema(mergedParsed, file);

  // Preserve original includes info
  mergedConfig.includes = config.includes;

  return {
    config: mergedConfig,
    unresolvedIncludes: unresolved,
    errors,
  };
}

async function fetchInclude(
  ref: IncludeRef,
  resolver: FileResolver,
  basePath: string,
): Promise<string | null> {
  if ('local' in ref) {
    const path = resolvePath(basePath, ref.local);
    return resolver.readFile(path);
  }

  if ('remote' in ref) {
    return resolver.fetchUrl(ref.remote);
  }

  if ('template' in ref) {
    // TODO: Bundle lookup in Phase 1
    return null;
  }

  if ('component' in ref) {
    // Components require GitLab API access
    return null;
  }

  if ('project' in ref) {
    // Cross-project includes require GitLab API access
    return null;
  }

  return null;
}

function getIncludeFileName(ref: IncludeRef): string {
  if ('local' in ref) return ref.local;
  if ('remote' in ref) return ref.remote;
  if ('template' in ref) return `template:${ref.template}`;
  if ('component' in ref) return `component:${ref.component}`;
  if ('project' in ref) return `${ref.project}/${ref.file}`;
  return 'unknown-include';
}

function resolvePath(basePath: string, localPath: string): string {
  if (!basePath || !basePath.startsWith('/')) {
    throw new XRayError(
      `include 해석에 유효한 basePath가 필요합니다 (현재: '${basePath}')`,
      'include',
      null,
      null,
    );
  }

  // GitLab resolves include:local relative to the project root
  const raw = localPath.startsWith('/')
    ? basePath + localPath
    : `${basePath}/${localPath}`;

  // Normalize path segments and reject traversal outside basePath
  const segments: string[] = [];
  for (const seg of raw.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      segments.pop();
    } else {
      segments.push(seg);
    }
  }
  const normalized = '/' + segments.join('/');

  const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  if (!normalized.startsWith(normalizedBase + '/') && normalized !== normalizedBase) {
    throw new XRayError(
      `include:local 경로가 프로젝트 루트 밖을 참조합니다: ${localPath}`,
      'include',
      null,
      null,
    );
  }

  return normalized;
}

/** Extract a raw object from a GitLabCIConfig for merging */
function rawFromConfig(config: GitLabCIConfig): Record<string, unknown> {
  const raw: Record<string, unknown> = {};

  if (config.stages.length > 0) raw.stages = config.stages;
  if (Object.keys(config.variables).length > 0) raw.variables = config.variables;
  if (Object.keys(config.default).length > 0) raw.default = config.default;
  if (config.workflow) raw.workflow = config.workflow;

  for (const [name, job] of Object.entries(config.jobs)) {
    raw[name] = job;
  }

  return raw;
}

/** Deep merge raw objects following GitLab rules */
function deepMergeRaw(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (DANGEROUS_KEYS.has(key)) continue;

    // null in override explicitly removes the key (consistent with GitLab behavior)
    if (value === null) {
      delete result[key];
      continue;
    }
    if (value === undefined) continue;

    const existing = result[key];

    if (Array.isArray(value)) {
      result[key] = value;
    } else if (typeof value === 'object' && existing != null && typeof existing === 'object' && !Array.isArray(existing)) {
      result[key] = deepMergeRaw(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}
