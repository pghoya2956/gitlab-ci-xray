import * as vscode from 'vscode';
import { applyFix } from 'gitlab-ci-xray-core';
import { getCachedResult } from '../analyzer.js';

export class XRayCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const result = getCachedResult(document.uri.toString());
    if (!result) return [];

    const actions: vscode.CodeAction[] = [];

    for (const diag of context.diagnostics) {
      if (diag.source !== 'GitLab CI X-Ray') continue;

      // Find matching warning with a fix
      const ruleId = typeof diag.code === 'object' ? diag.code.value : diag.code;
      const warning = result.warnings.find(
        w => w.ruleId === ruleId && w.fix && w.location.jobName === getJobNameFromRange(document, diag.range),
      );

      if (warning?.fix) {
        const action = new vscode.CodeAction(
          warning.fix.title,
          vscode.CodeActionKind.QuickFix,
        );
        action.diagnostics = [diag];

        const newText = applyFix(document.getText(), warning.fix);
        if (newText !== document.getText()) {
          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length),
          );
          action.edit = new vscode.WorkspaceEdit();
          action.edit.replace(document.uri, fullRange, newText);
          actions.push(action);
        }
      }
    }

    return actions;
  }
}

function getJobNameFromRange(document: vscode.TextDocument, range: vscode.Range): string {
  // Walk backwards from the diagnostic line to find the job name (top-level key)
  for (let i = range.start.line; i >= 0; i--) {
    const text = document.lineAt(i).text;
    const match = text.match(/^([a-zA-Z_.][a-zA-Z0-9_.-]*):/);
    if (match) return match[1];
  }
  return '';
}
