import * as vscode from 'vscode';
import type { AnalyzeResult } from '@aspect/gitlab-ci-xray-core';
import { buildDetailedLineMap } from '@aspect/gitlab-ci-xray-core';

/**
 * Update diagnostics from analysis result.
 */
export function updateDiagnostics(
  collection: vscode.DiagnosticCollection,
  document: vscode.TextDocument,
  result: AnalyzeResult,
): void {
  const lineMap = buildDetailedLineMap(document.getText());
  const diagnostics: vscode.Diagnostic[] = [];

  for (const warning of result.warnings) {
    const line = resolveLineNumber(warning.location, lineMap);
    const range = line >= 0
      ? document.lineAt(line).range
      : new vscode.Range(0, 0, 0, 0);

    const severity = warning.severity === 'error'
      ? vscode.DiagnosticSeverity.Error
      : warning.severity === 'warning'
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;

    const diag = new vscode.Diagnostic(range, warning.message, severity);
    diag.source = 'GitLab CI X-Ray';
    diag.code = warning.ruleId;

    if (warning.docUrl) {
      diag.code = {
        value: warning.ruleId,
        target: vscode.Uri.parse(warning.docUrl),
      };
    }

    diagnostics.push(diag);
  }

  collection.set(document.uri, diagnostics);
}

function resolveLineNumber(
  location: { jobName: string; key: string; line?: number },
  lineMap: Map<string, number>,
): number {
  if (location.line != null) return location.line - 1;

  // Try jobName.key first, then jobName
  const fullKey = `${location.jobName}.${location.key}`;
  const line = lineMap.get(fullKey) ?? lineMap.get(location.jobName);
  return line != null ? line - 1 : -1;
}
