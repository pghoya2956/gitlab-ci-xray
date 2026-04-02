import type { GitLabCIConfig, JobConfig } from '../types.js';
import { XRayError } from '../types.js';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Resolve all `extends:` directives in the config.
 * Deep-merges parent jobs into child jobs following GitLab's merge rules.
 *
 * GitLab merge rules:
 * - Objects are deep-merged (child overrides parent)
 * - Arrays are replaced entirely (not merged)
 * - Scalars are replaced
 * - Multiple extends: processed left to right, later overrides earlier
 */
export function resolveExtends(
  config: GitLabCIConfig,
  file = '.gitlab-ci.yml',
): GitLabCIConfig {
  const resolved: Record<string, JobConfig> = {};
  const resolving = new Set<string>(); // Cycle detection

  function resolve(name: string): JobConfig {
    if (resolved[name]) return resolved[name];

    const job = config.jobs[name];
    if (!job) {
      throw new XRayError(
        `extends '${name}'가 참조하는 job이 존재하지 않습니다.`,
        file,
        null,
        null,
      );
    }

    // No extends → return as-is
    if (!job.extends || job.extends.length === 0) {
      resolved[name] = { ...job };
      return resolved[name];
    }

    // Cycle detection
    if (resolving.has(name)) {
      const chain = [...resolving, name].join(' → ');
      throw new XRayError(
        `extends 순환 참조: ${chain}`,
        file,
        job._sourceLines?.start ?? null,
        null,
      );
    }

    resolving.add(name);

    // Normalize extends to array
    const parents = Array.isArray(job.extends) ? job.extends : [job.extends];

    // Resolve all parents first, then merge left to right
    let merged: Partial<JobConfig> = {};
    const extendsChain: string[] = [];

    for (const parentName of parents) {
      const parent = resolve(parentName);
      extendsChain.push(parentName);
      merged = deepMergeJob(merged, parent);
    }

    // Child overrides merged parents
    const result = deepMergeJob(merged, job);

    // Remove extends from resolved job
    delete result.extends;

    resolving.delete(name);
    resolved[name] = result as JobConfig;
    return resolved[name];
  }

  // Resolve all jobs
  for (const name of Object.keys(config.jobs)) {
    resolve(name);
  }

  return {
    ...config,
    jobs: resolved,
  };
}

/**
 * Deep-merge two job configs following GitLab rules:
 * - Objects: deep-merged (child keys override parent keys)
 * - Arrays: replaced entirely
 * - Scalars: replaced
 */
function deepMergeJob(base: Partial<JobConfig>, override: Partial<JobConfig>): Partial<JobConfig> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    // Skip internal keys from base
    if (key.startsWith('_') && key !== '_hidden') continue;

    const existing = result[key];

    // null in override explicitly removes the key (GitLab behavior)
    if (value === null) {
      delete result[key];
      continue;
    }
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      // Arrays: replace entirely
      result[key] = value;
    } else if (typeof value === 'object' && !isSpecialObject(value)) {
      // Objects: deep-merge
      if (existing != null && typeof existing === 'object' && !Array.isArray(existing)) {
        result[key] = deepMergeJob(
          existing as Partial<JobConfig>,
          value as Partial<JobConfig>,
        );
      } else {
        result[key] = value;
      }
    } else {
      // Scalars and special objects: replace
      result[key] = value;
    }
  }

  return result as Partial<JobConfig>;
}

/** Check if value is a special object that should not be deep-merged */
function isSpecialObject(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false;
  // ReferenceMarker, Symbol-keyed objects
  return Object.getOwnPropertySymbols(value).length > 0;
}
