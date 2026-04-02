import * as vscode from 'vscode';
import type { AnalyzeResult } from '@aspect/gitlab-ci-xray-core';
import { formatForAI } from '@aspect/gitlab-ci-xray-core';

export class XRayWebViewPanel {
  private panel: vscode.WebviewPanel | null = null;
  private extensionUri: vscode.Uri;
  private lastResult: AnalyzeResult | null = null;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  show(result: AnalyzeResult): void {
    this.lastResult = result;

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
        if (msg.type === 'copyForAI' && this.lastResult) {
          const text = formatForAI(this.lastResult);
          await vscode.env.clipboard.writeText(text);
          vscode.window.showInformationMessage('X-Ray 분석 결과가 클립보드에 복사되었습니다.');
        }
      });
    }

    this.panel.webview.html = getWebviewContent(result);
  }

  update(result: AnalyzeResult): void {
    this.lastResult = result;
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
    warningCount: result.warnings.filter(w => w.location.jobName === n.jobName).length,
  })));

  const warningsData = JSON.stringify(result.warnings.map(w => ({
    ruleId: w.ruleId,
    severity: w.severity,
    message: w.message,
    job: w.location.jobName,
    description: w.description,
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
  const errorCount = result.warnings.filter(w => w.severity === 'error').length;
  const warnCount = result.warnings.filter(w => w.severity === 'warning').length;
  const infoCount = result.warnings.filter(w => w.severity === 'info').length;

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
    --fg-dim: var(--vscode-descriptionForeground);
    --border: var(--vscode-panel-border);
    --accent: #579950;
    --accent-dark: #357032;
    --badge-bg: var(--vscode-badge-background);
    --badge-fg: var(--vscode-badge-foreground);
    --input-bg: var(--vscode-input-background);
    --tab-active: var(--vscode-tab-activeBackground, var(--bg));
    --tab-inactive: var(--vscode-tab-inactiveBackground, transparent);
    --err: #E74C3C;
    --warn: #F59E0B;
    --info: #579950;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow: hidden; }
  body { font-family: var(--vscode-font-family, -apple-system, sans-serif); color: var(--fg); background: var(--bg); font-size: 13px; line-height: 1.5; display: flex; flex-direction: column; }

  /* ── Header ── */
  .header { flex-shrink: 0; padding: 10px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .header-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .header h1 { font-size: 14px; font-weight: 600; white-space: nowrap; }
  .badges { display: flex; gap: 5px; flex-wrap: wrap; }
  .badge { font-size: 11px; padding: 1px 7px; border-radius: 10px; font-weight: 500; }
  .badge-default { background: var(--badge-bg); color: var(--badge-fg); }
  .badge-err { background: rgba(231,76,60,0.15); color: var(--err); }
  .badge-warn { background: rgba(245,158,11,0.15); color: var(--warn); }
  .badge-info { background: rgba(87,153,80,0.15); color: var(--info); }

  .copy-btn { background: var(--accent); color: #fff; border: none; padding: 6px 14px; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 600; white-space: nowrap; transition: all 0.15s; display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
  .copy-btn:hover { background: var(--accent-dark); }
  .copy-btn.copied { background: #357032; }
  .copy-btn svg { width: 13px; height: 13px; fill: currentColor; }

  /* ── Tabs ── */
  .tab-bar { flex-shrink: 0; display: flex; border-bottom: 1px solid var(--border); padding: 0 16px; }
  .tab { padding: 7px 16px; font-size: 12px; font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; color: var(--fg-dim); transition: all 0.15s; user-select: none; display: flex; align-items: center; gap: 6px; }
  .tab:hover { color: var(--fg); }
  .tab.active { color: var(--fg); border-bottom-color: var(--accent); }
  .tab .tab-count { font-size: 10px; padding: 0 5px; border-radius: 8px; background: var(--badge-bg); color: var(--badge-fg); }

  /* ── Tab Content ── */
  .tab-content { flex: 1; overflow: hidden; position: relative; }
  .tab-page { position: absolute; inset: 0; overflow: auto; display: none; }
  .tab-page.active { display: block; }

  /* ── DAG ── */
  .dag-page { padding: 0; overflow: auto; }
  .dag-page svg { display: block; min-width: 100%; }
  svg.dag .stage-bg { opacity: 0.04; }
  svg.dag .stage-label { font-size: 11px; font-weight: 700; text-transform: uppercase; fill: var(--accent); }
  svg.dag .node-rect { rx: 6; ry: 6; stroke-width: 1.5; }
  svg.dag .node-rect.normal { fill: var(--input-bg); stroke: var(--border); }
  svg.dag .node-rect.has-warning { fill: var(--input-bg); stroke: var(--warn); stroke-width: 2; }
  svg.dag .node-text { font-size: 11px; fill: var(--fg); text-anchor: middle; dominant-baseline: central; pointer-events: none; }
  svg.dag .edge { fill: none; stroke: var(--fg-dim); stroke-width: 1.2; opacity: 0.45; }
  svg.dag .edge-arrow { fill: var(--fg-dim); opacity: 0.45; }

  /* ── List pages ── */
  .list-page { padding: 12px 16px; }
  .card { padding: 10px 12px; margin: 6px 0; border-radius: 6px; font-size: 12px; line-height: 1.6; }
  .card.error { background: rgba(231,76,60,0.08); border-left: 3px solid var(--err); }
  .card.warning { background: rgba(245,158,11,0.08); border-left: 3px solid var(--warn); }
  .card.info { background: rgba(87,153,80,0.08); border-left: 3px solid var(--info); }
  .card .rule { font-size: 10px; opacity: 0.5; margin-right: 6px; }
  .card .job-name { font-weight: 600; }
  .card .desc { color: var(--fg-dim); font-size: 11px; margin-top: 3px; }

  .sug-card { padding: 10px 12px; margin: 6px 0; border-radius: 6px; background: rgba(87,153,80,0.06); border-left: 3px solid var(--accent); }
  .sug-card .sug-title { font-weight: 600; font-size: 12px; }
  .sug-card .sug-impact { font-size: 10px; padding: 1px 6px; border-radius: 3px; color: #fff; margin-left: 6px; vertical-align: middle; }
  .sug-card .sug-impact.high { background: var(--err); }
  .sug-card .sug-impact.medium { background: var(--warn); }
  .sug-card .sug-impact.low { background: var(--accent); }
  .sug-card .sug-desc { color: var(--fg-dim); font-size: 11px; margin-top: 4px; }
  .sug-card .sug-jobs { font-size: 10px; opacity: 0.5; margin-top: 3px; }

  .empty { color: var(--fg-dim); font-size: 12px; padding: 20px 0; text-align: center; }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <h1>GitLab CI X-Ray</h1>
    <div class="badges">
      <span class="badge badge-default">${result.dag.length} jobs</span>
      <span class="badge badge-default">${stages.length} stages</span>
      ${errorCount > 0 ? `<span class="badge badge-err">${errorCount} E</span>` : ''}
      ${warnCount > 0 ? `<span class="badge badge-warn">${warnCount} W</span>` : ''}
      ${infoCount > 0 ? `<span class="badge badge-info">${infoCount} I</span>` : ''}
    </div>
  </div>
  <button class="copy-btn" id="copyBtn" onclick="copyForAI()">
    <svg viewBox="0 0 16 16"><path d="M4 4v-2h10v10h-2v2H2V4h2zm1-1H3v10h8v-1H5V3zm1-1v8h8V2H6z"/></svg>
    <span id="copyLabel">Copy for AI</span>
  </button>
</div>

<div class="tab-bar">
  <div class="tab active" data-tab="dag" onclick="switchTab('dag')">DAG</div>
  <div class="tab" data-tab="warnings" onclick="switchTab('warnings')">Warnings <span class="tab-count">${result.warnings.length}</span></div>
  <div class="tab" data-tab="suggestions" onclick="switchTab('suggestions')">Suggestions <span class="tab-count">${result.suggestions.length}</span></div>
</div>

<div class="tab-content">
  <div class="tab-page dag-page active" id="page-dag">
    <svg class="dag" id="dagSvg"></svg>
  </div>
  <div class="tab-page list-page" id="page-warnings"></div>
  <div class="tab-page list-page" id="page-suggestions"></div>
</div>

<script>
const vscode = acquireVsCodeApi();
const dag = ${dagData};
const warnings = ${warningsData};
const suggestions = ${suggestionsData};

// ── Tab switching ──
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
}

// ── DAG Graph ──
(function renderDAG() {
  const svg = document.getElementById('dagSvg');
  const container = document.getElementById('page-dag');
  if (dag.length === 0) {
    container.innerHTML = '<div class="empty">No visible jobs</div>';
    return;
  }

  const NODE_W = 140, NODE_H = 34, PAD_X = 24, PAD_Y = 18;
  const STAGE_GAP = 32, STAGE_LABEL_W = 90;
  const LEFT = STAGE_LABEL_W + 16;

  const stageOrder = [];
  const stageMap = new Map();
  for (const n of dag) {
    if (!stageMap.has(n.stage)) { stageOrder.push(n.stage); stageMap.set(n.stage, []); }
    stageMap.get(n.stage).push(n);
  }

  const positions = new Map();
  let y = PAD_Y + 8;
  const stageYRanges = [];

  for (const stage of stageOrder) {
    const nodes = stageMap.get(stage);
    const stageStartY = y;
    const cols = Math.min(nodes.length, 5);
    const rows = Math.ceil(nodes.length / cols);

    for (let i = 0; i < nodes.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const nx = LEFT + col * (NODE_W + PAD_X);
      const ny = y + row * (NODE_H + PAD_Y);
      positions.set(nodes[i].name, { x: nx, y: ny, cx: nx + NODE_W / 2, cy: ny + NODE_H / 2 });
    }

    y += rows * (NODE_H + PAD_Y) + STAGE_GAP;
    stageYRanges.push({ stage, startY: stageStartY - 10, endY: y - STAGE_GAP + 6 });
  }

  const maxCols = Math.max(...[...stageMap.values()].map(n => Math.min(n.length, 5)));
  const svgW = LEFT + maxCols * (NODE_W + PAD_X) + PAD_X;
  const svgH = y + PAD_Y;
  svg.setAttribute('width', svgW);
  svg.setAttribute('height', svgH);
  svg.setAttribute('viewBox', '0 0 ' + svgW + ' ' + svgH);

  let html = '<defs><marker id="ah" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0 0, 10 3.5, 0 7" class="edge-arrow"/></marker></defs>';

  // Stage backgrounds + labels
  for (const { stage, startY, endY } of stageYRanges) {
    html += '<rect class="stage-bg" x="0" y="' + startY + '" width="' + svgW + '" height="' + (endY - startY) + '" fill="currentColor" rx="4"/>';
    html += '<text class="stage-label" x="12" y="' + (startY + 18) + '">' + stage.toUpperCase() + '</text>';
  }

  // Edges
  for (const n of dag) {
    const to = positions.get(n.name);
    if (!to) continue;
    for (const dep of n.needs) {
      const from = positions.get(dep);
      if (!from) continue;
      const x1 = from.cx, y1 = from.cy + NODE_H / 2 + 1;
      const x2 = to.cx, y2 = to.cy - NODE_H / 2 - 1;
      const dy = Math.abs(y2 - y1);
      const cp = Math.min(dy * 0.45, 60);
      html += '<path class="edge" d="M' + x1 + ',' + y1 + ' C' + x1 + ',' + (y1 + cp) + ' ' + x2 + ',' + (y2 - cp) + ' ' + x2 + ',' + y2 + '" marker-end="url(#ah)"/>';
    }
  }

  // Nodes
  for (const n of dag) {
    const p = positions.get(n.name);
    if (!p) continue;
    const cls = n.warningCount > 0 ? 'node-rect has-warning' : 'node-rect normal';
    html += '<rect class="' + cls + '" x="' + p.x + '" y="' + (p.cy - NODE_H / 2) + '" width="' + NODE_W + '" height="' + NODE_H + '"/>';
    const label = n.name.length > 18 ? n.name.slice(0, 17) + '…' : n.name;
    html += '<text class="node-text" x="' + p.cx + '" y="' + p.cy + '">' + escHtml(label) + '</text>';
  }

  svg.innerHTML = html;
})();

// ── Warnings ──
(function() {
  const el = document.getElementById('page-warnings');
  if (warnings.length === 0) { el.innerHTML = '<div class="empty">No warnings</div>'; return; }
  let html = '';
  for (const w of warnings) {
    html += '<div class="card ' + w.severity + '">';
    html += '<span class="rule">' + w.ruleId + '</span> ';
    html += '<span class="job-name">' + escHtml(w.job) + '</span>: ' + escHtml(w.message);
    if (w.description) html += '<div class="desc">' + escHtml(w.description) + '</div>';
    html += '</div>';
  }
  el.innerHTML = html;
})();

// ── Suggestions ──
(function() {
  const el = document.getElementById('page-suggestions');
  if (suggestions.length === 0) { el.innerHTML = '<div class="empty">No suggestions</div>'; return; }
  let html = '';
  for (const s of suggestions) {
    html += '<div class="sug-card">';
    html += '<div><span class="sug-title">' + escHtml(s.title) + '</span><span class="sug-impact ' + s.impact + '">' + s.impact + '</span></div>';
    html += '<div class="sug-desc">' + escHtml(s.description) + '</div>';
    html += '<div class="sug-jobs">jobs: ' + escHtml(s.jobs.join(', ')) + '</div>';
    html += '</div>';
  }
  el.innerHTML = html;
})();

function copyForAI() {
  vscode.postMessage({ type: 'copyForAI' });
  const btn = document.getElementById('copyBtn');
  const label = document.getElementById('copyLabel');
  btn.classList.add('copied');
  label.textContent = 'Copied!';
  setTimeout(() => { btn.classList.remove('copied'); label.textContent = 'Copy for AI'; }, 2000);
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
</script>
</body>
</html>`;
}
