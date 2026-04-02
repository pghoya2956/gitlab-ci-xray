#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '@aspect/gitlab-ci-xray-core';

const args = process.argv.slice(2);
const filePath = args[0] ?? '.gitlab-ci.yml';

const resolved = resolve(filePath);

let source: string;
try {
  source = readFileSync(resolved, 'utf-8');
} catch {
  console.error(`파일을 찾을 수 없습니다: ${resolved}`);
  process.exit(2);
}

try {
  const { config, warnings } = await parse(source, {
    file: filePath,
    basePath: resolve(filePath, '..'),
  });

  const jobNames = Object.keys(config.jobs);
  const visible = jobNames.filter(n => !n.startsWith('.'));
  const hidden = jobNames.filter(n => n.startsWith('.'));

  console.log(`\n  GitLab CI X-Ray: ${filePath}\n`);
  console.log(`  Stages:    ${config.stages.join(' → ')}`);
  console.log(`  Jobs:      ${visible.length} visible, ${hidden.length} hidden`);
  console.log(`  Includes:  ${config.includes.length}`);
  console.log(`  Variables: ${Object.keys(config.variables).length}`);

  if (config.workflow?.rules) {
    console.log(`  Workflow:  ${config.workflow.rules.length} rules`);
  }

  if (visible.length > 0) {
    console.log(`\n  Jobs:`);
    const byStage = new Map<string, string[]>();
    for (const name of visible) {
      const stage = config.jobs[name].stage;
      if (!byStage.has(stage)) byStage.set(stage, []);
      byStage.get(stage)!.push(name);
    }
    for (const stage of config.stages) {
      const jobs = byStage.get(stage);
      if (jobs && jobs.length > 0) {
        console.log(`    [${stage}] ${jobs.join(', ')}`);
      }
    }
  }

  if (warnings.length > 0) {
    console.log(`\n  Warnings:`);
    for (const w of warnings) {
      console.log(`    - ${w.message}`);
    }
  }

  console.log('');
  process.exit(warnings.length > 0 ? 1 : 0);
} catch (err: unknown) {
  console.error(`분석 실패: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
}
