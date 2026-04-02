import type { AnalysisResult, DAGNode, IncludeRef } from './types.js';
import type { IncludeError } from './resolver/include.js';

export interface FormatInput extends AnalysisResult {
  includeErrors?: IncludeError[];
}

/**
 * Format analysis results as structured text for AI consumption.
 * Designed to be pasted into AI chat (Claude Code, Cursor, etc.)
 */
export function formatForAI(result: FormatInput): string {
  const sections: string[] = [];

  sections.push('# GitLab CI X-Ray 분석 결과\n');

  // Unresolved includes warning
  if (result.unresolvedIncludes.length > 0 || (result.includeErrors?.length ?? 0) > 0) {
    sections.push('## 미해석 Include\n');
    sections.push(`> 일부 include가 해석되지 않아 분석이 불완전할 수 있습니다.\n`);
    for (const ref of result.unresolvedIncludes) {
      sections.push(`- ${formatIncludeRef(ref)}`);
    }
    for (const err of result.includeErrors ?? []) {
      sections.push(`- ${formatIncludeRef(err.ref)} — 오류: ${err.message}`);
    }
    sections.push('');
  }

  // DAG
  sections.push('## 파이프라인 DAG\n');
  sections.push(formatDAG(result.dag));

  // Warnings
  if (result.warnings.length > 0) {
    sections.push('\n## 안티패턴 경고\n');
    const errors = result.warnings.filter(w => w.severity === 'error');
    const warnings = result.warnings.filter(w => w.severity === 'warning');
    const infos = result.warnings.filter(w => w.severity === 'info');

    if (errors.length > 0) {
      sections.push(`### Error (${errors.length}건)\n`);
      for (const w of errors) {
        sections.push(`- **[${w.ruleId}]** ${w.message}`);
        sections.push(`  ${w.description}`);
      }
    }

    if (warnings.length > 0) {
      sections.push(`\n### Warning (${warnings.length}건)\n`);
      for (const w of warnings) {
        sections.push(`- **[${w.ruleId}]** ${w.message}`);
        sections.push(`  ${w.description}`);
      }
    }

    if (infos.length > 0) {
      sections.push(`\n### Info (${infos.length}건)\n`);
      for (const w of infos) {
        sections.push(`- **[${w.ruleId}]** ${w.message}`);
      }
    }
  } else {
    sections.push('\n## 안티패턴 경고\n\n경고 없음.\n');
  }

  // Suggestions
  if (result.suggestions.length > 0) {
    sections.push('\n## 최적화 제안\n');
    const byImpact = { high: [] as string[], medium: [] as string[], low: [] as string[] };

    for (const s of result.suggestions) {
      byImpact[s.impact].push(
        `- **[${s.type}]** ${s.title}\n  ${s.description}\n  영향 job: ${s.affectedJobs.join(', ')}`
      );
    }

    if (byImpact.high.length > 0) {
      sections.push(`### 높은 영향\n`);
      sections.push(byImpact.high.join('\n'));
    }
    if (byImpact.medium.length > 0) {
      sections.push(`\n### 중간 영향\n`);
      sections.push(byImpact.medium.join('\n'));
    }
    if (byImpact.low.length > 0) {
      sections.push(`\n### 낮은 영향\n`);
      sections.push(byImpact.low.join('\n'));
    }
  }

  // Summary
  sections.push('\n## 요약\n');
  sections.push(`- 전체 job: ${result.dag.length}`);
  sections.push(`- stages: ${[...new Set(result.dag.map(n => n.stage))].join(' → ')}`);
  sections.push(`- 경고: ${result.warnings.length}건 (error ${result.warnings.filter(w => w.severity === 'error').length}, warning ${result.warnings.filter(w => w.severity === 'warning').length}, info ${result.warnings.filter(w => w.severity === 'info').length})`);
  sections.push(`- 최적화 제안: ${result.suggestions.length}건`);

  return sections.join('\n');
}

function formatDAG(dag: DAGNode[]): string {
  if (dag.length === 0) return '(job 없음)\n';

  const lines: string[] = [];
  let currentStage = '';

  for (const node of dag) {
    if (node.stage !== currentStage) {
      currentStage = node.stage;
      lines.push(`\n[${currentStage}]`);
    }

    const deps: string[] = [];
    if (node.needs.length > 0) {
      deps.push(`needs: ${node.needs.join(', ')}`);
    }
    if (node.stageNeeds.length > 0) {
      deps.push(`stage-deps: ${node.stageNeeds.length} jobs`);
    }

    const depStr = deps.length > 0 ? ` (${deps.join('; ')})` : '';
    lines.push(`  ${node.jobName}${depStr}`);
  }

  return lines.join('\n') + '\n';
}

function formatIncludeRef(ref: IncludeRef): string {
  if ('local' in ref) return `local: ${ref.local}`;
  if ('remote' in ref) return `remote: ${ref.remote}`;
  if ('template' in ref) return `template: ${ref.template}`;
  if ('component' in ref) return `component: ${ref.component}`;
  if ('project' in ref) return `project: ${ref.project}/${ref.file}`;
  return 'unknown';
}
