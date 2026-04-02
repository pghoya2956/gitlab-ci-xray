// ── GitLab CI Config types ──

export interface GitLabCIConfig {
  stages: string[];
  variables: Record<string, string | VariableConfig>;
  default: Partial<JobConfig>;
  workflow: WorkflowConfig | null;
  jobs: Record<string, JobConfig>;
  includes: IncludeRef[];
  /** Jobs after extends/include/!reference resolution */
  resolvedJobs: Record<string, ResolvedJob>;
}

export interface VariableConfig {
  value: string;
  description?: string;
  options?: string[];
}

export interface WorkflowConfig {
  name?: string;
  rules?: RuleConfig[];
}

// ── Job types ──

export interface JobConfig {
  stage: string;
  script?: string[];
  before_script?: string[];
  after_script?: string[];
  image?: string | ImageConfig;
  services?: ServiceConfig[];
  variables?: Record<string, string | VariableConfig>;
  rules?: RuleConfig[];
  only?: OnlyExceptConfig;
  except?: OnlyExceptConfig;
  needs?: (string | NeedRef)[];
  dependencies?: string[];
  artifacts?: ArtifactsConfig;
  cache?: CacheConfig | CacheConfig[];
  extends?: string | string[];
  tags?: string[];
  allow_failure?: boolean | AllowFailureConfig;
  retry?: number | RetryConfig;
  timeout?: string;
  parallel?: number | ParallelMatrix;
  trigger?: TriggerConfig;
  resource_group?: string;
  environment?: string | EnvironmentConfig;
  release?: ReleaseConfig;
  interruptible?: boolean;
  when?: WhenValue;
  coverage?: string;
  secrets?: Record<string, SecretConfig>;
  pages?: Record<string, unknown>;
  /** True if job name starts with `.` */
  _hidden?: boolean;
  /** Raw YAML for line tracking */
  _sourceLines?: { start: number; end: number };
  [key: string]: unknown;
}

export type WhenValue =
  | 'on_success'
  | 'on_failure'
  | 'always'
  | 'manual'
  | 'delayed'
  | 'never';

export interface ResolvedJob extends JobConfig {
  _resolution: {
    extendsChain: string[];
    includeOrigin: string | null;
    overriddenKeys: string[];
  };
}

// ── Sub-types ──

export interface ImageConfig {
  name: string;
  entrypoint?: string[];
  pull_policy?: string;
}

export interface ServiceConfig {
  name: string;
  alias?: string;
  entrypoint?: string[];
  command?: string[];
  variables?: Record<string, string>;
}

export interface RuleConfig {
  if?: string;
  changes?: string[] | { paths: string[]; compare_to?: string };
  exists?: string[];
  allow_failure?: boolean;
  when?: WhenValue;
  variables?: Record<string, string>;
  needs?: (string | NeedRef)[];
}

export type OnlyExceptConfig = string[] | {
  refs?: string[];
  variables?: string[];
  changes?: string[];
  kubernetes?: string;
};

export interface NeedRef {
  job: string;
  project?: string;
  ref?: string;
  artifacts?: boolean;
  optional?: boolean;
  pipeline?: string;
}

export interface ArtifactsConfig {
  paths?: string[];
  exclude?: string[];
  expire_in?: string;
  expose_as?: string;
  name?: string;
  untracked?: boolean;
  when?: 'on_success' | 'on_failure' | 'always';
  reports?: Record<string, string | string[]>;
}

export interface CacheConfig {
  key?: string | CacheKeyConfig;
  paths?: string[];
  untracked?: boolean;
  unprotect?: boolean;
  when?: 'on_success' | 'on_failure' | 'always';
  policy?: 'pull' | 'push' | 'pull-push';
  fallback_keys?: string[];
}

export interface CacheKeyConfig {
  files?: string[];
  prefix?: string;
}

export interface AllowFailureConfig {
  exit_codes: number | number[];
}

export interface RetryConfig {
  max?: number;
  when?: string | string[];
}

export interface ParallelMatrix {
  matrix: Record<string, string | string[]>[];
}

export interface TriggerConfig {
  project?: string;
  branch?: string;
  strategy?: string;
  include?: string | IncludeRef[];
  forward?: { yaml_variables?: boolean; pipeline_variables?: boolean };
}

export interface EnvironmentConfig {
  name: string;
  url?: string;
  on_stop?: string;
  action?: 'start' | 'stop' | 'prepare' | 'verify' | 'access';
  auto_stop_in?: string;
  kubernetes?: Record<string, unknown>;
  deployment_tier?: string;
}

export interface ReleaseConfig {
  tag_name: string;
  name?: string;
  description?: string;
  ref?: string;
  milestones?: string[];
  released_at?: string;
  assets?: { links: { name: string; url: string; link_type?: string }[] };
}

export interface SecretConfig {
  vault: string | { engine: { name: string; path: string }; path: string; field: string };
}

// ── Include types ──

export type IncludeRef =
  | { local: string }
  | { template: string }
  | { remote: string }
  | { component: string; inputs?: Record<string, string> }
  | { project: string; file: string | string[]; ref?: string };

// ── File Resolver ──

export interface FileResolver {
  readFile(path: string): Promise<string | null>;
  fetchUrl(url: string): Promise<string | null>;
}

// ── Analysis Result ──

export interface AnalysisResult {
  config: GitLabCIConfig;
  dag: DAGNode[];
  warnings: AntiPatternWarning[];
  suggestions: OptimizationSuggestion[];
  unresolvedIncludes: IncludeRef[];
}

export interface AnalysisOptions {
  locale?: 'ko' | 'en';
  severity?: 'error' | 'warning' | 'info';
}

// ── DAG ──

export interface DAGNode {
  jobName: string;
  stage: string;
  needs: string[];
  stageNeeds: string[];
  warnings: AntiPatternWarning[];
  suggestions: OptimizationSuggestion[];
}

// ── Anti-pattern ──

export type Severity = 'error' | 'warning' | 'info';

export interface AntiPatternWarning {
  ruleId: string;
  severity: Severity;
  message: string;
  description: string;
  location: { jobName: string; key: string; line?: number };
  docUrl?: string;
  fix?: OptimizationSuggestion;
}

// ── Optimization ──

export type OptimizationType =
  | 'parallelization'
  | 'cache'
  | 'artifacts'
  | 'structure'
  | 'security';

export interface OptimizationSuggestion {
  id: string;
  type: OptimizationType;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  before: string;
  after: string;
  affectedJobs: string[];
}

// ── Errors ──

export class XRayError extends Error {
  constructor(
    message: string,
    public file: string,
    public line: number | null,
    public column: number | null,
  ) {
    super(message);
    this.name = 'XRayError';
  }

  toString(): string {
    const loc = this.line != null ? `:${this.line}${this.column != null ? `:${this.column}` : ''}` : '';
    return `${this.file}${loc} — ${this.message}`;
  }
}

// ── Internal markers ──

/** Marker for unresolved !reference tags during parsing */
export const REFERENCE_MARKER = Symbol.for('gitlab-ci-xray:reference');

export interface ReferenceMarker {
  [REFERENCE_MARKER]: true;
  path: string[];
}

export function isReferenceMarker(value: unknown): value is ReferenceMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    REFERENCE_MARKER in value &&
    (value as Record<symbol, unknown>)[REFERENCE_MARKER] === true
  );
}
