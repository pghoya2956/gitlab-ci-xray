import type { AntiPatternWarning, Severity } from '../types.js';
import { JOB_KEYWORDS, TOP_LEVEL_KEYWORDS, JOB_KEYWORD_TYPES } from '../data/bundled-schema.js';
import { GLOBAL_KEYWORDS } from '../schema.js';
import { findClosest } from './levenshtein.js';

export interface ValidateSchemaOptions {
  /** include가 있으면 "알 수 없는 키" severity를 downgrade */
  hasIncludes?: boolean;
}

/**
 * Validate raw parsed YAML data against GitLab CI schema.
 * Checks for unknown keys (with typo suggestions) and type mismatches.
 * Runs BEFORE resolver — operates on raw data, not resolved config.
 */
export function validateSchema(
  rawData: Record<string, unknown>,
  options: ValidateSchemaOptions = {},
): AntiPatternWarning[] {
  const warnings: AntiPatternWarning[] = [];

  // SC-003: unknown top-level keys
  for (const key of Object.keys(rawData)) {
    if (GLOBAL_KEYWORDS.has(key)) continue;
    if (TOP_LEVEL_KEYWORDS.has(key)) continue;

    // Job definitions are allowed as top-level keys (any non-global key = job)
    const value = rawData[key];
    if (value != null && typeof value === 'object' && !Array.isArray(value)) continue;

    // Non-object top-level value that isn't a known keyword
    const suggestion = findClosest(key, TOP_LEVEL_KEYWORDS);
    const hint = suggestion ? ` '${suggestion}'를 의미하셨나요?` : '';
    warnings.push({
      ruleId: 'SC-003',
      severity: 'warning',
      message: `'${key}'는 알 수 없는 top-level 키입니다.${hint}`,
      description: '이 키가 최신 GitLab 버전에서 지원되는 키일 수 있습니다.',
      location: { jobName: '', key },
    });
  }

  // Validate each job
  for (const [jobName, jobValue] of Object.entries(rawData)) {
    if (GLOBAL_KEYWORDS.has(jobName)) continue;
    if (TOP_LEVEL_KEYWORDS.has(jobName)) continue;
    if (jobValue == null || typeof jobValue !== 'object' || Array.isArray(jobValue)) continue;

    const job = jobValue as Record<string, unknown>;
    const isHidden = jobName.startsWith('.');
    const hasExtends = job.extends != null;

    for (const [key, value] of Object.entries(job)) {
      // Skip internal keys
      if (key.startsWith('_')) continue;

      // SC-001: unknown job-level key
      if (!JOB_KEYWORDS.has(key)) {
        // Safety: hidden jobs can have custom keys (template fragments)
        if (isHidden) continue;
        // Safety: jobs with extends may inherit unknown keys from parent
        if (hasExtends) continue;

        const suggestion = findClosest(key, JOB_KEYWORDS);
        const hint = suggestion ? ` '${suggestion}'를 의미하셨나요?` : '';
        const severity: Severity = options.hasIncludes ? 'warning' : 'error';

        warnings.push({
          ruleId: 'SC-001',
          severity,
          message: `'${jobName}'에서 '${key}'는 알 수 없는 키입니다.${hint}`,
          description: '이 키가 최신 GitLab 버전에서 지원되는 키일 수 있습니다.',
          location: { jobName, key },
        });
        continue;
      }

      // SC-002: type mismatch
      const typeInfo = JOB_KEYWORD_TYPES[key];
      if (!typeInfo || typeInfo.types.length === 0) continue;
      if (value == null) continue;

      const actualType = Array.isArray(value) ? 'array' : typeof value;
      // Handle "integer" — typeof returns "number"
      const normalizedTypes = typeInfo.types.flatMap((t) => {
        // Some types are comma-joined (e.g., "array,null", "object,null")
        return t.split(',').map((s) => s.trim());
      });
      const allowed = new Set(
        normalizedTypes.map((t) => (t === 'integer' ? 'number' : t)),
      );
      // "null" type — already handled by null check above
      allowed.delete('null');

      if (allowed.size > 0 && !allowed.has(actualType)) {
        const expected = normalizedTypes.filter((t) => t !== 'null').join(' 또는 ');
        warnings.push({
          ruleId: 'SC-002',
          severity: 'error',
          message: `'${jobName}'의 '${key}' 값은 ${expected}이어야 합니다. 현재: ${actualType}`,
          description: `GitLab CI에서 '${key}'에 허용되는 타입: ${expected}`,
          location: { jobName, key },
        });
      }
    }
  }

  return warnings;
}
