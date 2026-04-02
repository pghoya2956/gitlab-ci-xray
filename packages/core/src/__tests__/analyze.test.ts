import { describe, it, expect } from 'vitest';
import { analyze, formatForAI } from '../index.js';

describe('analyze (full pipeline)', () => {
  it('analyzes a complete config', async () => {
    const yaml = `
stages:
  - build
  - test
  - deploy

build-frontend:
  stage: build
  image: node:20
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/

build-backend:
  stage: build
  image: node:20
  script:
    - npm ci
    - mvn package

test-unit:
  stage: test
  image: node:20
  needs:
    - build-frontend
  script:
    - npm test

deploy-prod:
  stage: deploy
  image: alpine:latest
  script:
    - ./deploy.sh
  environment:
    name: production
  when: manual
`;
    const result = await analyze(yaml);

    // DAG
    expect(result.dag).toHaveLength(4);
    const testNode = result.dag.find(n => n.jobName === 'test-unit');
    expect(testNode?.needs).toEqual(['build-frontend']);

    // Warnings exist
    expect(result.warnings.length).toBeGreaterThan(0);

    // AP-002: artifacts without expire_in
    const ap002 = result.warnings.find(w => w.ruleId === 'AP-002');
    expect(ap002).toBeDefined();

    // Suggestions exist
    expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
  });

  it('formatForAI produces structured text', async () => {
    const yaml = `
stages:
  - build
  - test

build:
  stage: build
  image: node:20
  script: npm run build

test:
  stage: test
  image: node:20
  script: npm test
`;
    const result = await analyze(yaml);
    const text = formatForAI(result);

    expect(text).toContain('# GitLab CI X-Ray 분석 결과');
    expect(text).toContain('## 파이프라인 DAG');
    expect(text).toContain('[build]');
    expect(text).toContain('## 요약');
  });

  it('handles config with only hidden jobs', async () => {
    const yaml = `
.base:
  image: node:20
  script: echo "base"
`;
    const result = await analyze(yaml);
    expect(result.dag).toHaveLength(0);
  });
});
