#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyze, formatForAI } from 'gitlab-ci-xray-core';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  gitlab-ci-xray [file] [options]

  Arguments:
    file            Path to .gitlab-ci.yml (default: .gitlab-ci.yml)

  Options:
    --json          Output as JSON
    --ai            Output in AI-friendly format (for pasting into AI chat)
    --help, -h      Show this help
`);
  process.exit(0);
}

const flags = args.filter(a => a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('-'));
const filePath = positional[0] ?? '.gitlab-ci.yml';
const outputJson = flags.includes('--json');
const outputAI = flags.includes('--ai');

const resolved = resolve(filePath);

let source: string;
try {
  source = readFileSync(resolved, 'utf-8');
} catch {
  console.error(`파일을 찾을 수 없습니다: ${resolved}`);
  process.exit(2);
}

try {
  const result = await analyze(source, {
    file: filePath,
    basePath: resolve(filePath, '..'),
  });

  if (outputJson) {
    console.log(JSON.stringify({
      version: 1,
      dag: result.dag.map(n => ({
        job: n.jobName,
        stage: n.stage,
        needs: n.needs,
        stageNeeds: n.stageNeeds,
      })),
      warnings: result.warnings.map(w => ({
        ruleId: w.ruleId,
        severity: w.severity,
        message: w.message,
        description: w.description,
        job: w.location.jobName,
        key: w.location.key,
        line: w.location.line ?? null,
        docUrl: w.docUrl ?? null,
        fix: w.fix ? {
          id: w.fix.id,
          title: w.fix.title,
          before: w.fix.before,
          after: w.fix.after,
        } : null,
      })),
      suggestions: result.suggestions.map(s => ({
        id: s.id,
        type: s.type,
        title: s.title,
        description: s.description,
        impact: s.impact,
        jobs: s.affectedJobs,
        before: s.before,
        after: s.after,
      })),
      summary: {
        jobs: result.dag.length,
        stages: [...new Set(result.dag.map(n => n.stage))],
        warnings: result.warnings.length,
        suggestions: result.suggestions.length,
      },
    }, null, 2));
  } else if (outputAI) {
    console.log(formatForAI(result));
  } else {
    // Default: human-readable summary
    const visible = result.dag;
    console.log(`\n  GitLab CI X-Ray: ${filePath}\n`);
    console.log(`  Stages:    ${[...new Set(visible.map(n => n.stage))].join(' → ')}`);
    console.log(`  Jobs:      ${visible.length}`);
    console.log(`  Warnings:  ${result.warnings.length} (error ${result.warnings.filter(w => w.severity === 'error').length}, warning ${result.warnings.filter(w => w.severity === 'warning').length}, info ${result.warnings.filter(w => w.severity === 'info').length})`);
    console.log(`  Suggest:   ${result.suggestions.length}`);

    if (visible.length > 0) {
      console.log(`\n  Pipeline:`);
      let currentStage = '';
      for (const node of visible) {
        if (node.stage !== currentStage) {
          currentStage = node.stage;
          console.log(`    [${currentStage}]`);
        }
        const deps = node.needs.length > 0
          ? ` → needs: ${node.needs.join(', ')}`
          : '';
        console.log(`      ${node.jobName}${deps}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log(`\n  Top warnings:`);
      for (const w of result.warnings.slice(0, 10)) {
        const icon = w.severity === 'error' ? 'E' : w.severity === 'warning' ? 'W' : 'I';
        console.log(`    [${icon}] ${w.ruleId}: ${w.message}`);
      }
      if (result.warnings.length > 10) {
        console.log(`    ... and ${result.warnings.length - 10} more`);
      }
    }

    console.log('');
  }

  const hasErrors = result.warnings.some(w => w.severity === 'error');
  process.exit(hasErrors ? 1 : 0);
} catch (err: unknown) {
  console.error(`분석 실패: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
}
