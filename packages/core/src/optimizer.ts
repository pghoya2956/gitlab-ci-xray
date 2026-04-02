import type { GitLabCIConfig, DAGNode, OptimizationSuggestion, NeedRef } from './types.js';

/**
 * Generate optimization suggestions based on config and DAG analysis.
 */
export function generateSuggestions(
  config: GitLabCIConfig,
  dag: DAGNode[],
): OptimizationSuggestion[] {
  return [
    ...suggestParallelization(config, dag),
    ...suggestCacheImprovements(config),
    ...suggestArtifactsOptimization(config),
    ...suggestSecurityImprovements(config),
  ];
}

function suggestParallelization(
  config: GitLabCIConfig,
  dag: DAGNode[],
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  // Find jobs that only depend on stage ordering and could use needs
  const jobsByStage = new Map<string, DAGNode[]>();
  for (const node of dag) {
    if (!jobsByStage.has(node.stage)) jobsByStage.set(node.stage, []);
    jobsByStage.get(node.stage)!.push(node);
  }

  for (const [stage, nodes] of jobsByStage) {
    // Jobs with stageNeeds but no explicit needs — candidates for DAG optimization
    const candidates = nodes.filter(n =>
      n.needs.length === 0 && n.stageNeeds.length > 0
    );

    if (candidates.length >= 2) {
      suggestions.push({
        id: `opt-parallel-${stage}`,
        type: 'parallelization',
        title: `[${stage}] stage의 job에 needs 추가`,
        description: `${candidates.length}개 job이 stage 순서에만 의존합니다. needs를 사용하면 필요한 job만 기다리고 더 빨리 시작할 수 있습니다.`,
        impact: 'high',
        before: candidates.map(c => `${c.jobName}:\n  stage: ${stage}`).join('\n\n'),
        after: candidates.map(c => `${c.jobName}:\n  stage: ${stage}\n  needs: [...]  # 실제 의존 job만 지정`).join('\n\n'),
        affectedJobs: candidates.map(c => c.jobName),
      });
    }
  }

  return suggestions;
}

function suggestCacheImprovements(config: GitLabCIConfig): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  for (const [name, job] of Object.entries(config.jobs)) {
    if (job._hidden) continue;
    if (!job.cache) continue;

    const caches = Array.isArray(job.cache) ? job.cache : [job.cache];
    for (const cache of caches) {
      // Suggest file-based cache key if using string key
      if (typeof cache.key === 'string' && cache.paths?.length) {
        const hasLockfile = cache.paths.some(p =>
          p.includes('node_modules') || p.includes('vendor') || p.includes('.cache')
        );
        if (hasLockfile) {
          suggestions.push({
            id: `opt-cache-key-${name}`,
            type: 'cache',
            title: `'${name}'의 cache key를 파일 기반으로 변경`,
            description: 'lockfile 기반 cache key를 사용하면 의존성 변경 시에만 캐시가 갱신됩니다.',
            impact: 'medium',
            before: `cache:\n  key: "${cache.key}"\n  paths:\n    - ${cache.paths[0]}`,
            after: `cache:\n  key:\n    files:\n      - package-lock.json\n  paths:\n    - ${cache.paths[0]}`,
            affectedJobs: [name],
          });
        }
      }
    }
  }

  return suggestions;
}

function suggestArtifactsOptimization(config: GitLabCIConfig): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  // Find jobs with artifacts but no downstream consumers
  const artifactProducers = new Set<string>();
  const artifactConsumers = new Set<string>();

  for (const [name, job] of Object.entries(config.jobs)) {
    if (job._hidden) continue;
    if (job.artifacts?.paths?.length) artifactProducers.add(name);
    if (job.dependencies) {
      for (const dep of job.dependencies) artifactConsumers.add(dep);
    }
    if (job.needs) {
      for (const need of job.needs) {
        const needName = typeof need === 'string' ? need : (need as NeedRef).job;
        const needArtifacts = typeof need === 'string' ? true : ((need as NeedRef).artifacts !== false);
        if (needArtifacts) artifactConsumers.add(needName);
      }
    }
  }

  const stageIndex = new Map<string, number>();
  for (let i = 0; i < config.stages.length; i++) {
    stageIndex.set(config.stages[i], i);
  }

  for (const producer of artifactProducers) {
    if (artifactConsumers.has(producer)) continue;

    const job = config.jobs[producer];
    // Skip if artifacts have reports (test reports are consumed by GitLab UI)
    if (job.artifacts?.reports) continue;

    // Check for implicit consumers: jobs in later stages without needs/dependencies
    const prodStageIdx = stageIndex.get(job.stage) ?? -1;
    const hasImplicitConsumer = Object.entries(config.jobs).some(([dName, dJob]) => {
      if (dJob._hidden || dName === producer) return false;
      if (dJob.needs != null || dJob.dependencies != null) return false;
      const consStageIdx = stageIndex.get(dJob.stage) ?? -1;
      return consStageIdx > prodStageIdx;
    });
    if (hasImplicitConsumer) continue;

    suggestions.push({
      id: `opt-artifacts-unused-${producer}`,
      type: 'artifacts',
      title: `'${producer}'의 artifacts에 소비자가 없음`,
      description: '이 job의 artifacts를 다운로드하는 downstream job이 없습니다. 불필요하면 제거하거나 expire_in을 짧게 설정하세요.',
      impact: 'low',
      before: `${producer}:\n  artifacts:\n    paths:\n      - dist/`,
      after: `${producer}:\n  artifacts:\n    paths:\n      - dist/\n    expire_in: 1 day`,
      affectedJobs: [producer],
    });
  }

  return suggestions;
}

function suggestSecurityImprovements(config: GitLabCIConfig): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  for (const [name, job] of Object.entries(config.jobs)) {
    if (job._hidden) continue;

    // Deploy jobs without protection
    const isDeployStage = job.stage === 'deploy' || job.stage === 'production' || job.stage === 'staging';
    const hasEnvironment = job.environment != null;

    if ((isDeployStage || hasEnvironment) && job.when !== 'manual') {
      const envName = typeof job.environment === 'string' ? job.environment : job.environment?.name;
      const isProd = envName && /prod/i.test(envName);

      if (isProd) {
        suggestions.push({
          id: `opt-security-manual-${name}`,
          type: 'security',
          title: `'${name}' 프로덕션 배포에 when: manual 추가`,
          description: '프로덕션 배포는 수동 승인을 거치는 것이 안전합니다.',
          impact: 'high',
          before: `${name}:\n  stage: ${job.stage}\n  environment: ${envName}`,
          after: `${name}:\n  stage: ${job.stage}\n  environment: ${envName}\n  when: manual`,
          affectedJobs: [name],
        });
      }
    }
  }

  return suggestions;
}
