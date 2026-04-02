import * as vscode from 'vscode';
import { buildDetailedLineMap } from '@aspect/gitlab-ci-xray-core';
import { getCachedResult } from '../analyzer.js';

export class XRayCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  refresh(): void {
    this._onDidChange.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const result = getCachedResult(document.uri.toString());
    if (!result) return [];

    const lineMap = buildDetailedLineMap(document.getText());
    const lenses: vscode.CodeLens[] = [];

    // Count warnings per job
    const warningsByJob = new Map<string, number>();
    for (const w of result.warnings) {
      const count = warningsByJob.get(w.location.jobName) ?? 0;
      warningsByJob.set(w.location.jobName, count + 1);
    }

    for (const [jobName, count] of warningsByJob) {
      const lineNum = lineMap.get(jobName);
      if (lineNum == null) continue;

      const range = new vscode.Range(lineNum - 1, 0, lineNum - 1, 0);
      lenses.push(
        new vscode.CodeLens(range, {
          title: `$(warning) ${count} warning${count > 1 ? 's' : ''}`,
          command: 'workbench.action.problems.focus',
        }),
      );
    }

    // DAG view lens at the top of the file
    if (result.dag.length > 0) {
      lenses.unshift(
        new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
          title: `$(graph) ${result.dag.length} jobs | ${[...new Set(result.dag.map(n => n.stage))].length} stages — Open X-Ray`,
          command: 'gitlab-ci-xray.openPreview',
        }),
      );
    }

    return lenses;
  }
}
