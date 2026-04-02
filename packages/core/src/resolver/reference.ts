import type { GitLabCIConfig, JobConfig } from '../types.js';
import { isReferenceMarker, REFERENCE_MARKER, XRayError } from '../types.js';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface ResolveReferencesOptions {
  /** When true, missing reference targets are kept as-is instead of throwing. */
  lenient?: boolean;
}

/**
 * Resolve all !reference tags in the config.
 * Replaces ReferenceMarker objects with the actual values they point to.
 *
 * !reference [job_name, key] → value of job_name.key
 * !reference [job_name, key, nested] → value of job_name.key.nested
 *
 * In lenient mode, unresolvable references (e.g., targets in unresolved includes)
 * are kept as ReferenceMarker objects instead of throwing.
 */
export function resolveReferences(
  config: GitLabCIConfig,
  file = '.gitlab-ci.yml',
  options: ResolveReferencesOptions = {},
): GitLabCIConfig {
  const jobs = { ...config.jobs };
  const lenient = options.lenient ?? false;

  for (const [name, job] of Object.entries(jobs)) {
    jobs[name] = resolveJobReferences(job, config.jobs, file, [name], lenient);
  }

  return { ...config, jobs };
}

function resolveJobReferences(
  job: JobConfig,
  allJobs: Record<string, JobConfig>,
  file: string,
  visitPath: string[],
  lenient: boolean,
): JobConfig {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(job)) {
    result[key] = resolveValue(value, allJobs, file, [...visitPath, key], lenient);
  }

  return result as JobConfig;
}

function resolveValue(
  value: unknown,
  allJobs: Record<string, JobConfig>,
  file: string,
  context: string[],
  lenient: boolean,
): unknown {
  // Check if this is a !reference marker
  if (isReferenceMarker(value)) {
    return lookupReference(value.path, allJobs, file, context, lenient);
  }

  // Recurse into arrays
  if (Array.isArray(value)) {
    const resolved: unknown[] = [];
    for (const item of value) {
      if (isReferenceMarker(item)) {
        const refValue = lookupReference(item.path, allJobs, file, context, lenient);
        // If lookup returned the marker itself (lenient mode), keep it
        if (isReferenceMarker(refValue)) {
          resolved.push(refValue);
        } else if (Array.isArray(refValue)) {
          // If the referenced value is an array, flatten it
          resolved.push(...refValue);
        } else {
          resolved.push(refValue);
        }
      } else {
        resolved.push(resolveValue(item, allJobs, file, context, lenient));
      }
    }
    return resolved;
  }

  // Recurse into objects
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(k)) continue;
      result[k] = resolveValue(v, allJobs, file, [...context, k], lenient);
    }
    return result;
  }

  return value;
}

/**
 * Look up a !reference path in the jobs.
 * path: ["job_name", "key", "nested_key", ...]
 */
function lookupReference(
  path: string[],
  allJobs: Record<string, JobConfig>,
  file: string,
  context: string[],
  lenient: boolean,
): unknown {
  if (path.length < 1) {
    throw new XRayError(
      `!reference 경로가 비어 있습니다. (위치: ${context.join('.')})`,
      file,
      null,
      null,
    );
  }

  const [jobName, ...keys] = path;
  const job = allJobs[jobName];

  if (!job) {
    if (lenient) {
      // Target job may exist in unresolved includes — keep marker as-is
      return { [REFERENCE_MARKER]: true, path };
    }
    throw new XRayError(
      `!reference [${path.join(', ')}]가 참조하는 job '${jobName}'이 존재하지 않습니다.`,
      file,
      null,
      null,
    );
  }

  if (keys.length === 0) {
    // Reference to the entire job
    return job;
  }

  // Navigate into the job
  let current: unknown = job;
  for (let i = 0; i < keys.length; i++) {
    if (current == null || typeof current !== 'object') {
      throw new XRayError(
        `!reference [${path.join(', ')}]: '${keys.slice(0, i + 1).join('.')}' 경로를 찾을 수 없습니다.`,
        file,
        null,
        null,
      );
    }

    current = (current as Record<string, unknown>)[keys[i]];
  }

  if (current === undefined) {
    throw new XRayError(
      `!reference [${path.join(', ')}]: '${jobName}.${keys.join('.')}' 값이 존재하지 않습니다.`,
      file,
      null,
      null,
    );
  }

  return current;
}
