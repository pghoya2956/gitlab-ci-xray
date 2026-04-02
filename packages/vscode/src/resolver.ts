import * as vscode from 'vscode';
import type { FileResolver } from '@aspect/gitlab-ci-xray-core';

/**
 * VS Code workspace.fs-based FileResolver.
 * Reads files from the workspace and fetches URLs.
 */
export class VSCodeFileResolver implements FileResolver {
  constructor(private workspaceRoot: vscode.Uri) {}

  async readFile(path: string): Promise<string | null> {
    try {
      const uri = vscode.Uri.joinPath(this.workspaceRoot, path);
      const data = await vscode.workspace.fs.readFile(uri);
      return new TextDecoder().decode(data);
    } catch {
      return null;
    }
  }

  async fetchUrl(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  }
}

/**
 * Detect workspace root for a given document.
 */
export function getWorkspaceRoot(document: vscode.TextDocument): vscode.Uri | null {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  return folder?.uri ?? null;
}
