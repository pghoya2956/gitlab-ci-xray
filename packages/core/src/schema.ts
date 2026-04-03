import type { GitLabCIConfig, IncludeRef, JobConfig, VariableConfig, WorkflowConfig } from './types.js';
import { XRayError } from './types.js';
import type { ParseResult } from './parser.js';

/** Global keywords that are NOT job definitions */
export const GLOBAL_KEYWORDS = new Set([
  'stages',
  'variables',
  'default',
  'workflow',
  'include',
  'image',
  'services',
  'before_script',
  'after_script',
  'cache',
  'pages',
]);

/** Default stages when none specified */
const DEFAULT_STAGES = ['.pre', 'build', 'test', 'deploy', '.post'];

/**
 * Interpret a raw parsed YAML object as a GitLab CI configuration.
 * Extracts stages, global keywords, jobs, and include references.
 */
export function interpretSchema(parsed: ParseResult, file = '.gitlab-ci.yml'): GitLabCIConfig {
  const { data, lineMap } = parsed;

  const stages = extractStages(data);
  const variables = extractVariables(data.variables);
  const defaultConfig = extractDefault(data);
  const workflow = extractWorkflow(data.workflow);
  const includes = extractIncludes(data.include);
  const jobs = extractJobs(data, lineMap, file);

  return {
    stages,
    variables,
    default: defaultConfig,
    workflow,
    jobs,
    includes,
    resolvedJobs: {}, // Populated after resolution
  };
}

function extractStages(data: Record<string, unknown>): string[] {
  if (!('stages' in data)) return DEFAULT_STAGES;

  const raw = data.stages;
  if (!Array.isArray(raw)) return DEFAULT_STAGES;

  return raw.map(String);
}

function extractVariables(raw: unknown): Record<string, string | VariableConfig> {
  if (raw == null || typeof raw !== 'object') return {};

  const result: Record<string, string | VariableConfig> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = String(value);
    } else if (typeof value === 'object' && value !== null) {
      const v = value as Record<string, unknown>;
      result[key] = {
        value: String(v.value ?? ''),
        description: v.description != null ? String(v.description) : undefined,
        options: Array.isArray(v.options) ? v.options.map(String) : undefined,
      };
    }
  }
  return result;
}

function extractDefault(data: Record<string, unknown>): Partial<JobConfig> {
  const def = data.default;
  if (def == null || typeof def !== 'object' || Array.isArray(def)) {
    // Global-level image/services/before_script etc. act as defaults
    const result: Partial<JobConfig> = {};
    if (data.image != null) result.image = data.image as JobConfig['image'];
    if (data.services != null) result.services = data.services as JobConfig['services'];
    if (data.before_script != null) result.before_script = data.before_script as string[];
    if (data.after_script != null) result.after_script = data.after_script as string[];
    if (data.cache != null) result.cache = data.cache as JobConfig['cache'];
    return result;
  }
  return def as Partial<JobConfig>;
}

function extractWorkflow(raw: unknown): WorkflowConfig | null {
  if (raw == null || typeof raw !== 'object') return null;
  return raw as WorkflowConfig;
}

function extractIncludes(raw: unknown): IncludeRef[] {
  if (raw == null) return [];

  // Single include
  if (typeof raw === 'string') {
    return [{ local: raw }];
  }

  // Single object
  if (!Array.isArray(raw) && typeof raw === 'object') {
    return [normalizeInclude(raw as Record<string, unknown>)];
  }

  // Array
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      if (typeof item === 'string') return { local: item } as IncludeRef;
      return normalizeInclude(item as Record<string, unknown>);
    });
  }

  return [];
}

function normalizeInclude(obj: Record<string, unknown>): IncludeRef {
  if ('local' in obj) return { local: String(obj.local) } as IncludeRef;
  if ('template' in obj) return { template: String(obj.template) } as IncludeRef;
  if ('remote' in obj) return { remote: String(obj.remote) } as IncludeRef;
  if ('component' in obj) {
    return {
      component: String(obj.component),
      inputs: obj.inputs as Record<string, string> | undefined,
    } as IncludeRef;
  }
  if ('project' in obj) {
    return {
      project: String(obj.project),
      file: obj.file as string | string[],
      ref: obj.ref != null ? String(obj.ref) : undefined,
    } as IncludeRef;
  }
  // Unknown include format — wrap as local for best-effort handling
  const keys = Object.keys(obj);
  if (keys.length > 0) {
    return { local: String(obj[keys[0]]) } as IncludeRef;
  }
  return { local: '' } as IncludeRef;
}

function extractJobs(
  data: Record<string, unknown>,
  lineMap: Map<string, number>,
  file: string,
): Record<string, JobConfig> {
  const jobs: Record<string, JobConfig> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip global keywords
    if (GLOBAL_KEYWORDS.has(key)) continue;

    // Jobs must be objects
    if (value == null || typeof value !== 'object' || Array.isArray(value)) continue;

    const raw = value as Record<string, unknown>;

    // Determine stage
    let stage = 'test'; // default stage
    if (typeof raw.stage === 'string') {
      stage = raw.stage;
    }

    const isHidden = key.startsWith('.');

    const job: JobConfig = {
      ...raw,
      stage,
      _hidden: isHidden,
      _sourceLines: lineMap.has(key)
        ? { start: lineMap.get(key)!, end: lineMap.get(key)! }
        : undefined,
    } as JobConfig;

    // Normalize script fields to arrays
    if (typeof job.script === 'string') job.script = [job.script];
    if (typeof job.before_script === 'string') job.before_script = [job.before_script];
    if (typeof job.after_script === 'string') job.after_script = [job.after_script];

    // Normalize extends to array
    if (typeof job.extends === 'string') job.extends = [job.extends];

    jobs[key] = job;
  }

  return jobs;
}

/**
 * Validate that all job stages reference defined stages.
 * Returns warnings for undefined stage references.
 */
export function validateStageRefs(config: GitLabCIConfig, file = '.gitlab-ci.yml'): XRayError[] {
  const errors: XRayError[] = [];
  const validStages = new Set(config.stages);

  for (const [name, job] of Object.entries(config.jobs)) {
    if (job._hidden) continue; // Hidden jobs don't need valid stages
    if (job.trigger != null) continue; // Trigger jobs don't have stages

    if (!validStages.has(job.stage)) {
      errors.push(new XRayError(
        `'${name}' job이 정의되지 않은 stage '${job.stage}'를 참조합니다. stages에 정의된 값: [${config.stages.join(', ')}]`,
        file,
        job._sourceLines?.start ?? null,
        null,
      ));
    }
  }

  return errors;
}
