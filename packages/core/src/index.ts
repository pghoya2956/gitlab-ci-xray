// ── Public API ──

export {
  // Types
  type GitLabCIConfig,
  type JobConfig,
  type ResolvedJob,
  type IncludeRef,
  type FileResolver,
  type AnalysisResult,
  type AnalysisOptions,
  type DAGNode,
  type AntiPatternWarning,
  type OptimizationSuggestion,
  type Severity,
  type OptimizationType,
  type VariableConfig,
  type WorkflowConfig,
  type RuleConfig,
  type NeedRef,
  type ArtifactsConfig,
  type CacheConfig,
  XRayError,
} from './types.js';

export { parseYaml, buildDetailedLineMap, type ParseResult } from './parser.js';
export { interpretSchema, validateStageRefs } from './schema.js';
export { resolveExtends } from './resolver/extends.js';
export { resolveReferences, type ResolveReferencesOptions } from './resolver/reference.js';
export { resolveIncludes, type IncludeResult, type IncludeError } from './resolver/include.js';
export { buildDAG } from './dag.js';
export { runRules, allRules, type Rule, type RuleEngineOptions } from './rules/index.js';
export { generateSuggestions } from './optimizer.js';
export { applyFix } from './fix.js';
export { formatForAI } from './format.js';
export { analyze, type AnalyzeOptions, type AnalyzeResult } from './analyze.js';
export { lookupTemplate, listTemplates } from './data/template-resolver.js';
export { validateSchema, type ValidateSchemaOptions } from './schema/validator.js';

// ── Convenience: full parse + resolve pipeline ──

import type { FileResolver, GitLabCIConfig, IncludeRef } from './types.js';
import { XRayError } from './types.js';
import { parseYaml } from './parser.js';
import { interpretSchema, validateStageRefs } from './schema.js';
import { resolveExtends } from './resolver/extends.js';
import { resolveReferences } from './resolver/reference.js';
import { resolveIncludes } from './resolver/include.js';
import type { IncludeError } from './resolver/include.js';

export interface ParseOptions {
  file?: string;
  resolver?: FileResolver;
  basePath?: string;
}

export interface PipelineParseResult {
  config: GitLabCIConfig;
  unresolvedIncludes: IncludeRef[];
  includeErrors: IncludeError[];
  warnings: XRayError[];
}

/**
 * Full parse + resolve pipeline.
 * 1. Parse YAML
 * 2. Interpret as GitLab CI schema
 * 3. Resolve includes (if resolver provided)
 * 4. Resolve extends
 * 5. Resolve !reference tags
 */
export async function parse(
  source: string,
  options: ParseOptions = {},
): Promise<PipelineParseResult> {
  const { file = '.gitlab-ci.yml', resolver, basePath = '' } = options;

  // Step 1: Parse YAML
  const parsed = parseYaml(source, file);

  // Step 2: Interpret schema
  let config = interpretSchema(parsed, file);

  // Step 3: Resolve includes
  let unresolvedIncludes: IncludeRef[] = [];
  let includeErrors: IncludeError[] = [];
  if (resolver && config.includes.length > 0) {
    const includeResult = await resolveIncludes(config, resolver, basePath, file);
    config = includeResult.config;
    unresolvedIncludes = includeResult.unresolvedIncludes;
    includeErrors = includeResult.errors;
  }

  // Step 4: Resolve extends
  config = resolveExtends(config, file);

  // Step 5: Resolve !reference tags
  // Use lenient mode when includes exist — referenced jobs may live in unresolved include files
  const hasIncludes = config.includes.length > 0;
  config = resolveReferences(config, file, { lenient: hasIncludes });

  // Validate stage references
  const warnings = validateStageRefs(config, file);

  return { config, unresolvedIncludes, includeErrors, warnings };
}
