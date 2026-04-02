import type { GitLabCIConfig, AntiPatternWarning, Severity } from '../types.js';

export interface Rule {
  id: string;
  severity: Severity;
  meta: {
    name: string;
    description: string;
    docUrl?: string;
  };
  check(config: GitLabCIConfig): AntiPatternWarning[];
}

export interface RuleEngineOptions {
  /** Minimum severity to report. Default: 'info' (all) */
  minSeverity?: Severity;
  /** Rule IDs to skip */
  exclude?: string[];
}

const SEVERITY_ORDER: Record<Severity, number> = {
  error: 3,
  warning: 2,
  info: 1,
};

/**
 * Run all registered rules against a config and return collected warnings.
 */
export function runRules(
  rules: Rule[],
  config: GitLabCIConfig,
  options: RuleEngineOptions = {},
): AntiPatternWarning[] {
  const minLevel = SEVERITY_ORDER[options.minSeverity ?? 'info'];
  const exclude = new Set(options.exclude ?? []);

  const warnings: AntiPatternWarning[] = [];

  for (const rule of rules) {
    if (exclude.has(rule.id)) continue;

    const results = rule.check(config);
    // Filter by actual warning severity, not rule's default severity
    warnings.push(...results.filter(r => SEVERITY_ORDER[r.severity] >= minLevel));
  }

  // Sort: error > warning > info, then by job name
  return warnings.sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity];
    const sb = SEVERITY_ORDER[b.severity];
    if (sa !== sb) return sb - sa;
    return a.location.jobName.localeCompare(b.location.jobName);
  });
}
