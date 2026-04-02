import * as vscode from 'vscode';
import { formatForAI } from '@aspect/gitlab-ci-xray-core';
import { analyzeDocument, isGitLabCI, getCachedResult, clearCache } from './analyzer.js';
import { updateDiagnostics } from './providers/diagnostics.js';
import { XRayCodeActionProvider } from './providers/codeaction.js';
import { XRayHoverProvider } from './providers/hover.js';
import { XRayCodeLensProvider } from './providers/codelens.js';
import { XRayWebViewPanel } from './providers/webview.js';

const YAML_SELECTOR = { language: 'yaml', scheme: 'file' };
const DEBOUNCE_MS = 300;

export function activate(context: vscode.ExtensionContext) {
  const diagnostics = vscode.languages.createDiagnosticCollection('gitlab-ci-xray');
  const codeLensProvider = new XRayCodeLensProvider();
  const webviewPanel = new XRayWebViewPanel(context.extensionUri);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Register providers
  context.subscriptions.push(
    diagnostics,
    vscode.languages.registerCodeActionsProvider(YAML_SELECTOR, new XRayCodeActionProvider(), {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }),
    vscode.languages.registerHoverProvider(YAML_SELECTOR, new XRayHoverProvider()),
    vscode.languages.registerCodeLensProvider(YAML_SELECTOR, codeLensProvider),
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('gitlab-ci-xray.openPreview', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !isGitLabCI(editor.document)) {
        vscode.window.showWarningMessage('GitLab CI YAML 파일을 열고 실행하세요.');
        return;
      }

      const result = await analyzeDocument(editor.document);
      if (result) {
        webviewPanel.show(result);
      }
    }),

    vscode.commands.registerCommand('gitlab-ci-xray.copyForAI', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const result = getCachedResult(editor.document.uri.toString());
      if (!result) {
        vscode.window.showWarningMessage('먼저 GitLab CI YAML 파일을 분석하세요.');
        return;
      }

      const text = formatForAI(result);
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage('X-Ray 분석 결과가 클립보드에 복사되었습니다.');
    }),

    vscode.commands.registerCommand('gitlab-ci-xray.exportMarkdown', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const result = getCachedResult(editor.document.uri.toString());
      if (!result) return;

      const text = formatForAI(result);
      const uri = await vscode.window.showSaveDialog({
        filters: { 'Markdown': ['md'] },
        defaultUri: vscode.Uri.file('xray-report.md'),
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
        vscode.window.showInformationMessage(`보고서 저장: ${uri.fsPath}`);
      }
    }),

    vscode.commands.registerCommand('gitlab-ci-xray.exportJSON', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const result = getCachedResult(editor.document.uri.toString());
      if (!result) return;

      const json = JSON.stringify({
        dag: result.dag,
        warnings: result.warnings,
        suggestions: result.suggestions,
      }, null, 2);

      const uri = await vscode.window.showSaveDialog({
        filters: { 'JSON': ['json'] },
        defaultUri: vscode.Uri.file('xray-report.json'),
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(json));
        vscode.window.showInformationMessage(`보고서 저장: ${uri.fsPath}`);
      }
    }),
  );

  // Real-time analysis on document change
  async function analyzeAndUpdate(document: vscode.TextDocument) {
    if (!isGitLabCI(document)) return;

    const result = await analyzeDocument(document);
    if (result) {
      updateDiagnostics(diagnostics, document, result);
      codeLensProvider.refresh();

      if (webviewPanel.isVisible) {
        webviewPanel.update(result);
      }
    }
  }

  // Analyze on open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => analyzeAndUpdate(doc)),
  );

  // Analyze on change (debounced)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => analyzeAndUpdate(event.document), DEBOUNCE_MS);
    }),
  );

  // Clean up on close
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(doc => {
      diagnostics.delete(doc.uri);
      clearCache(doc.uri.toString());
    }),
  );

  // Analyze already-open documents
  for (const editor of vscode.window.visibleTextEditors) {
    analyzeAndUpdate(editor.document);
  }
}

export function deactivate() {}
