import * as vscode from 'vscode';
import type { AnalyzeResult } from '@aspect/gitlab-ci-xray-core';
import { formatForAI } from '@aspect/gitlab-ci-xray-core';

export class XRayWebViewPanel {
  private panel: vscode.WebviewPanel | null = null;
  private extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  show(result: AnalyzeResult): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'gitlabCIXRay',
        'GitLab CI X-Ray',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [this.extensionUri],
        },
      );

      this.panel.onDidDispose(() => {
        this.panel = null;
      });

      this.panel.webview.onDidReceiveMessage(async (msg) => {
        if (msg.type === 'copyForAI') {
          const text = formatForAI(result);
          await vscode.env.clipboard.writeText(text);
          vscode.window.showInformationMessage('X-Ray 분석 결과가 클립보드에 복사되었습니다.');
        }
      });
    }

    this.panel.webview.html = getWebviewContent(result);
  }

  update(result: AnalyzeResult): void {
    if (this.panel) {
      this.panel.webview.html = getWebviewContent(result);
    }
  }

  get isVisible(): boolean {
    return this.panel?.visible ?? false;
  }
}

function getWebviewContent(result: AnalyzeResult): string {
  const dagData = JSON.stringify(result.dag.map(n => ({
    name: n.jobName,
    stage: n.stage,
    needs: n.needs,
    stageNeeds: n.stageNeeds,
    warningCount: n.warnings.length,
  })));

  const warningsData = JSON.stringify(result.warnings.map(w => ({
    ruleId: w.ruleId,
    severity: w.severity,
    message: w.message,
    job: w.location.jobName,
  })));

  const suggestionsData = JSON.stringify(result.suggestions.map(s => ({
    id: s.id,
    type: s.type,
    title: s.title,
    description: s.description,
    impact: s.impact,
    jobs: s.affectedJobs,
  })));

  const stages = [...new Set(result.dag.map(n => n.stage))];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GitLab CI X-Ray</title>
<style>
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --border: var(--vscode-panel-border);
    --accent: #579950;
    --warn-bg: rgba(245,158,11,0.1);
    --err-bg: rgba(231,76,60,0.1);
    --info-bg: rgba(87,153,80,0.1);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--vscode-font-family); color: var(--fg); background: var(--bg); padding: 16px; font-size: 13px; }
  h1 { font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  h2 { font-size: 14px; margin: 16px 0 8px; border-bottom: 1px solid var(--border); padding-bottom: 4px; }
  .summary { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
  .stat { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 4px 10px; border-radius: 4px; font-size: 12px; }
  .dag { display: flex; flex-direction: column; gap: 8px; }
  .stage-lane { border-left: 3px solid var(--accent); padding: 4px 0 4px 12px; }
  .stage-name { font-weight: bold; font-size: 12px; text-transform: uppercase; color: var(--accent); margin-bottom: 4px; }
  .jobs { display: flex; flex-wrap: wrap; gap: 6px; }
  .job { padding: 4px 8px; border-radius: 4px; font-size: 12px; border: 1px solid var(--border); cursor: default; }
  .job.has-warning { border-color: #F59E0B; }
  .job .needs { font-size: 10px; color: var(--vscode-descriptionForeground); }
  .warnings-list, .suggestions-list { list-style: none; }
  .warnings-list li, .suggestions-list li { padding: 6px 8px; margin: 4px 0; border-radius: 4px; font-size: 12px; }
  .warnings-list li.error { background: var(--err-bg); border-left: 3px solid #E74C3C; }
  .warnings-list li.warning { background: var(--warn-bg); border-left: 3px solid #F59E0B; }
  .warnings-list li.info { background: var(--info-bg); border-left: 3px solid #579950; }
  .suggestions-list li { background: var(--info-bg); border-left: 3px solid #579950; }
  .severity { font-weight: bold; margin-right: 4px; }
  .rule-id { opacity: 0.6; font-size: 11px; }
  .impact { font-size: 11px; padding: 1px 6px; border-radius: 3px; margin-left: 4px; }
  .impact.high { background: #E74C3C; color: white; }
  .impact.medium { background: #F59E0B; color: white; }
  .impact.low { background: #579950; color: white; }
  .btn { background: var(--accent); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; margin: 8px 4px 8px 0; }
  .btn:hover { background: #357032; }
  .collapsible { cursor: pointer; user-select: none; }
  .collapsible::before { content: '\\25B6'; margin-right: 6px; font-size: 10px; }
  .collapsible.open::before { content: '\\25BC'; }
  .collapsible-content { display: none; }
  .collapsible-content.open { display: block; }
</style>
</head>
<body>
<h1>GitLab CI X-Ray</h1>

<div class="summary">
  <span class="stat">${result.dag.length} jobs</span>
  <span class="stat">${stages.length} stages</span>
  <span class="stat">${result.warnings.filter(w => w.severity === 'error').length} errors</span>
  <span class="stat">${result.warnings.filter(w => w.severity === 'warning').length} warnings</span>
  <span class="stat">${result.suggestions.length} suggestions</span>
</div>

<button class="btn" onclick="copyForAI()">Copy for AI</button>

<h2>Pipeline DAG</h2>
<div class="dag" id="dag"></div>

<h2 class="collapsible" onclick="toggle(this)">Warnings (${result.warnings.length})</h2>
<div class="collapsible-content">
  <ul class="warnings-list" id="warnings"></ul>
</div>

<h2 class="collapsible" onclick="toggle(this)">Optimization Suggestions (${result.suggestions.length})</h2>
<div class="collapsible-content">
  <ul class="suggestions-list" id="suggestions"></ul>
</div>

<script>
const vscode = acquireVsCodeApi();
const dag = ${dagData};
const warnings = ${warningsData};
const suggestions = ${suggestionsData};

// Render DAG
const dagEl = document.getElementById('dag');
const stageGroups = new Map();
for (const node of dag) {
  if (!stageGroups.has(node.stage)) stageGroups.set(node.stage, []);
  stageGroups.get(node.stage).push(node);
}
for (const [stage, nodes] of stageGroups) {
  const lane = document.createElement('div');
  lane.className = 'stage-lane';
  lane.innerHTML = '<div class="stage-name">' + stage + '</div><div class="jobs">' +
    nodes.map(n => {
      const cls = n.warningCount > 0 ? 'job has-warning' : 'job';
      const needsStr = n.needs.length > 0 ? '<div class="needs">needs: ' + n.needs.join(', ') + '</div>' : '';
      return '<div class="' + cls + '">' + n.name + needsStr + '</div>';
    }).join('') + '</div>';
  dagEl.appendChild(lane);
}

// Render warnings
const warnEl = document.getElementById('warnings');
for (const w of warnings) {
  const li = document.createElement('li');
  li.className = w.severity;
  li.innerHTML = '<span class="rule-id">[' + w.ruleId + ']</span> <strong>' + w.job + '</strong>: ' + w.message;
  warnEl.appendChild(li);
}

// Render suggestions
const sugEl = document.getElementById('suggestions');
for (const s of suggestions) {
  const li = document.createElement('li');
  li.innerHTML = '<strong>' + s.title + '</strong> <span class="impact ' + s.impact + '">' + s.impact + '</span><br>' +
    '<span style="opacity:0.8">' + s.description + '</span><br>' +
    '<span class="rule-id">jobs: ' + s.jobs.join(', ') + '</span>';
  sugEl.appendChild(li);
}

function copyForAI() {
  vscode.postMessage({ type: 'copyForAI' });
}

function toggle(el) {
  el.classList.toggle('open');
  el.nextElementSibling.classList.toggle('open');
}
</script>
</body>
</html>`;
}
