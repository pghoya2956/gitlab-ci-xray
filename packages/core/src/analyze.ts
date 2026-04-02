import type {
  AnalysisResult,
  AnalysisOptions,
  FileResolver,
  GitLabCIConfig,
  IncludeRef,
} from './types.js';
import { parseYaml } from './parser.js';
import { interpretSchema } from './schema.js';
import { resolveExtends } from './resolver/extends.js';
import { resolveReferences } from './resolver/reference.js';
import { resolveIncludes, type IncludeError } from './resolver/include.js';
import { buildDAG } from './dag.js';
import { allRules, runRules } from './rules/index.js';
import { generateSuggestions } from './optimizer.js';

export interface AnalyzeOptions {
  file?: string;
  resolver?: FileResolver;
  basePath?: string;
  analysis?: AnalysisOptions;
}

export interface AnalyzeResult extends AnalysisResult {
  unresolvedIncludes: IncludeRef[];
  includeErrors: IncludeError[];
}

/**
 * Full analysis pipeline: parse → resolve → DAG → rules → optimize.
 */
export async function analyze(
  source: string,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  const { file = '.gitlab-ci.yml', resolver, basePath = '', analysis = {} } = options;

  // Parse + resolve
  const parsed = parseYaml(source, file);
  let config = interpretSchema(parsed, file);

  let unresolvedIncludes: IncludeRef[] = [];
  let includeErrors: IncludeError[] = [];
  if (resolver && config.includes.length > 0) {
    const result = await resolveIncludes(config, resolver, basePath, file);
    config = result.config;
    unresolvedIncludes = result.unresolvedIncludes;
    includeErrors = result.errors;
  }

  config = resolveExtends(config, file);
  config = resolveReferences(config, file, { lenient: config.includes.length > 0 });

  // Build DAG
  const dag = buildDAG(config, file);

  // Run anti-pattern rules
  const warnings = runRules(allRules, config, {
    minSeverity: analysis.severity,
  });

  // Generate optimization suggestions
  const suggestions = generateSuggestions(config, dag);

  return {
    config,
    dag,
    warnings,
    suggestions,
    unresolvedIncludes,
    includeErrors,
  };
}
