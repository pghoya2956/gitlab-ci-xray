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
  .tab-page { position: absolute; inset: 0; overflow: auto; visibility: hidden; z-index: 0; background: var(--bg); }
  .tab-page.active { visibility: visible; z-index: 1; }

  /* ── DAG ── */
  .dag-page { padding: 0; }
  .dag-wrap { padding: 16px; display: inline-block; min-width: 100%; box-sizing: border-box; }
  .dag-page svg { display: block; width: 100%; height: auto; }
  .zoom-bar { position: sticky; top: 8px; left: 0; z-index: 10; display: flex; gap: 2px; padding: 0 12px; pointer-events: none; }
  .zoom-bar button { pointer-events: auto; width: 28px; height: 28px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--fg); font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0.8; transition: opacity 0.15s; }
  .zoom-bar button:hover { opacity: 1; background: var(--input-bg); }
  .zoom-bar .zoom-level { pointer-events: none; font-size: 11px; color: var(--fg-dim); display: flex; align-items: center; padding: 0 6px; }
  svg.dag .stage-bg { opacity: 0.04; }
  svg.dag .stage-label { font-size: 11px; font-weight: 700; text-transform: uppercase; fill: var(--accent); }
  svg.dag .node-rect { rx: 6; ry: 6; stroke-width: 1.5; }
  svg.dag .node-rect.normal { fill: var(--input-bg); stroke: var(--border); }
  svg.dag .node-rect.has-warning { fill: var(--input-bg); stroke: var(--warn); stroke-width: 2; }
  svg.dag .node-text { font-size: 11px; fill: var(--fg); text-anchor: middle; dominant-baseline: central; pointer-events: none; }
  svg.dag .edge { fill: none; stroke: var(--fg-dim); stroke-width: 1.5; opacity: 0.4; }
  svg.dag .edge-arrow { fill: var(--fg-dim); opacity: 0.5; }

  /* ── List pages ── */
  .list-page { padding: 16px 20px 40px; }
  .card { padding: 12px 14px; margin: 8px 0; border-radius: 6px; font-size: 12px; line-height: 1.7; }
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
    <div class="zoom-bar">
      <button onclick="dagZoom(-1)" title="Zoom out">-</button>
      <button onclick="dagZoom(1)" title="Zoom in">+</button>
      <button onclick="dagZoom(0)" title="Reset" class="zoom-reset"><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 2.5v3.5H7"/><path d="M3.5 6C4.5 3.5 6.5 2 8.5 2A5 5 0 1 1 4 12.5"/></svg></button>
      <span class="zoom-level" id="zoomLevel">100%</span>
    </div>
    <div class="dag-wrap" id="dagWrap">
      <svg class="dag" id="dagSvg"></svg>
    </div>
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

  const NODE_W = 150, NODE_H = 34, PAD_X = 28, PAD_Y = 48;
  const STAGE_GAP = 40, STAGE_LABEL_W = 90;
  const LEFT = STAGE_LABEL_W + 16;
  const MAX_COLS = 5;

  // Group by stage
  const stageOrder = [];
  const stageMap = new Map();
  for (const n of dag) {
    if (!stageMap.has(n.stage)) { stageOrder.push(n.stage); stageMap.set(n.stage, []); }
    stageMap.get(n.stage).push(n);
  }

  // Build intra-stage dependency depth for proper row assignment
  // Nodes that depend on other nodes in the SAME stage go to a later row
  const nodeDepth = new Map(); // name -> depth within its stage
  for (const [stage, nodes] of stageMap) {
    const stageNames = new Set(nodes.map(n => n.name));
    const localDeps = new Map(); // name -> [deps within same stage]
    for (const n of nodes) {
      localDeps.set(n.name, n.needs.filter(d => stageNames.has(d)));
    }
    // Topological depth assignment
    const depth = new Map();
    function getDepth(name) {
      if (depth.has(name)) return depth.get(name);
      const deps = localDeps.get(name) || [];
      const d = deps.length === 0 ? 0 : Math.max(...deps.map(dep => getDepth(dep) + 1));
      depth.set(name, d);
      return d;
    }
    for (const n of nodes) getDepth(n.name);
    for (const [name, d] of depth) nodeDepth.set(name, d);
  }

  // Layout: group by stage, then by depth rows within stage
  const positions = new Map();
  let y = PAD_Y + 8;
  const stageYRanges = [];
  let globalMaxCol = 0;

  for (const stage of stageOrder) {
    const nodes = stageMap.get(stage);
    const stageStartY = y;

    // Group nodes by depth
    const byDepth = new Map();
    for (const n of nodes) {
      const d = nodeDepth.get(n.name) || 0;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d).push(n);
    }
    const depths = [...byDepth.keys()].sort((a, b) => a - b);

    for (const d of depths) {
      const rowNodes = byDepth.get(d);
      const cols = Math.min(rowNodes.length, MAX_COLS);
      globalMaxCol = Math.max(globalMaxCol, cols);
      const subRows = Math.ceil(rowNodes.length / cols);

      for (let i = 0; i < rowNodes.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const nx = LEFT + col * (NODE_W + PAD_X);
        const ny = y + row * (NODE_H + PAD_Y);
        positions.set(rowNodes[i].name, { x: nx, y: ny, cx: nx + NODE_W / 2, cy: ny + NODE_H / 2 });
      }
      y += subRows * (NODE_H + PAD_Y);
    }

    y += STAGE_GAP;
    stageYRanges.push({ stage, startY: stageStartY - 10, endY: y - STAGE_GAP + 6 });
  }
  const svgW = LEFT + globalMaxCol * (NODE_W + PAD_X) + PAD_X;
  const svgH = y + PAD_Y;
  svg.setAttribute('viewBox', '0 0 ' + svgW + ' ' + svgH);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const ARROW_W = 7, ARROW_H = 5;
  let html = '';

  // Stage backgrounds + labels
  for (const { stage, startY, endY } of stageYRanges) {
    html += '<rect class="stage-bg" x="0" y="' + startY + '" width="' + svgW + '" height="' + (endY - startY) + '" fill="currentColor" rx="4"/>';
    html += '<text class="stage-label" x="12" y="' + (startY + 18) + '">' + stage.toUpperCase() + '</text>';
  }

  // Edges — line + manual arrowhead triangle
  for (const n of dag) {
    const to = positions.get(n.name);
    if (!to) continue;
    for (const dep of n.needs) {
      const from = positions.get(dep);
      if (!from) continue;
      const x1 = from.cx;
      const y1 = from.cy + NODE_H / 2;
      const x2 = to.cx;
      const y2 = to.cy - NODE_H / 2 - ARROW_H;
      const dy = Math.abs(y2 - y1);
      const cp = Math.max(dy * 0.35, 20);
      // Bezier curve ending just above the arrowhead
      html += '<path class="edge" d="M' + x1 + ',' + y1 + ' C' + x1 + ',' + (y1 + cp) + ' ' + x2 + ',' + (y2 - cp) + ' ' + x2 + ',' + y2 + '"/>';
      // Arrowhead triangle pointing down, tip touching node top
      const tipY = to.cy - NODE_H / 2;
      html += '<polygon class="edge-arrow" points="' + (x2 - ARROW_W) + ',' + (tipY - ARROW_H * 2) + ' ' + (x2 + ARROW_W) + ',' + (tipY - ARROW_H * 2) + ' ' + x2 + ',' + tipY + '"/>';
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

// ── Zoom ──
let zoomScale = 1;
const ZOOM_STEP = 0.15;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;

function dagZoom(dir) {
  if (dir === 0) { zoomScale = 1; }
  else { zoomScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomScale + dir * ZOOM_STEP)); }
  applyZoom();
}

function applyZoom() {
  const wrap = document.getElementById('dagWrap');
  const label = document.getElementById('zoomLevel');
  if (wrap) {
    const pct = zoomScale * 100;
    wrap.style.width = pct + '%';
    wrap.style.minWidth = pct < 100 ? '0' : '100%';
  }
  if (label) label.textContent = Math.round(zoomScale * 100) + '%';
}

// Ctrl+wheel zoom on DAG page
document.getElementById('page-dag').addEventListener('wheel', function(e) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    zoomScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomScale + dir * ZOOM_STEP));
    applyZoom();
  }
}, { passive: false });

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
