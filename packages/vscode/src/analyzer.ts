import * as vscode from 'vscode';
import { analyze, type AnalyzeResult } from 'gitlab-ci-xray-core';
import { VSCodeFileResolver, getWorkspaceRoot } from './resolver.js';

const GITLAB_CI_PATTERN = /\.gitlab-ci\.yml$/;

/** Cache of analysis results per document URI */
const resultCache = new Map<string, AnalyzeResult>();

/**
 * Check if a document is a GitLab CI YAML file.
 */
export function isGitLabCI(document: vscode.TextDocument): boolean {
  if (document.languageId !== 'yaml') return false;
  return GITLAB_CI_PATTERN.test(document.fileName);
}

/**
 * Analyze a GitLab CI document and cache the result.
 */
export async function analyzeDocument(
  document: vscode.TextDocument,
): Promise<AnalyzeResult | null> {
  if (!isGitLabCI(document)) return null;

  const source = document.getText();
  if (!source.trim()) return null;

  try {
    const root = getWorkspaceRoot(document);
    const resolver = root ? new VSCodeFileResolver(root) : undefined;
    const basePath = root?.fsPath ?? '';

    const result = await analyze(source, {
      file: document.fileName,
      resolver,
      basePath,
    });

    resultCache.set(document.uri.toString(), result);
    return result;
  } catch {
    resultCache.delete(document.uri.toString());
    return null;
  }
}

export function getCachedResult(uri: string): AnalyzeResult | null {
  return resultCache.get(uri) ?? null;
}

export function clearCache(uri: string): void {
  resultCache.delete(uri);
}
