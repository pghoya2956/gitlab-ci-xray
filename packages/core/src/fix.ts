import type { OptimizationSuggestion } from './types.js';
import { parseYaml } from './parser.js';

/**
 * Apply an optimization suggestion to a YAML string.
 * Operates at text level to preserve formatting and comments.
 * Validates the result by re-parsing.
 */
export function applyFix(yaml: string, suggestion: OptimizationSuggestion): string {
  const { affectedJobs, before, after } = suggestion;

  if (affectedJobs.length === 0) return yaml;

  let result = yaml;

  // Try direct replacement first
  if (result.includes(before)) {
    result = result.replace(before, after);
  } else {
    // Fall back to job-level insertion for key-based fixes
    for (const jobName of affectedJobs) {
      result = insertKeyInJob(result, jobName, suggestion);
    }
  }

  // Validate result
  try {
    parseYaml(result);
  } catch {
    return yaml;
  }

  return result;
}

/**
 * Insert a key-value pair into a job block in the YAML string.
 * Preserves relative indentation from the suggestion's `after` snippet.
 */
function insertKeyInJob(
  yaml: string,
  jobName: string,
  suggestion: OptimizationSuggestion,
): string {
  const lines = yaml.split('\n');
  const jobPattern = new RegExp(`^${escapeRegex(jobName)}:`);

  let jobLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    // Skip comments
    if (lines[i].trimStart().startsWith('#')) continue;
    if (jobPattern.test(lines[i])) {
      jobLineIdx = i;
      break;
    }
  }

  if (jobLineIdx === -1) return yaml;

  // Find end of job (next top-level key or EOF)
  let jobEndIdx = lines.length;
  for (let i = jobLineIdx + 1; i < lines.length; i++) {
    if (/^\S/.test(lines[i]) && lines[i].trim() !== '' && !lines[i].trimStart().startsWith('#')) {
      jobEndIdx = i;
      break;
    }
  }

  // Detect indent of job's children
  let jobIndent = '  ';
  for (let i = jobLineIdx + 1; i < jobEndIdx; i++) {
    const m = lines[i].match(/^(\s+)\S/);
    if (m) {
      jobIndent = m[1];
      break;
    }
  }

  // Extract new lines from `after`, preserving relative indentation
  const afterLines = suggestion.after.split('\n');
  const newLines: string[] = [];

  // Find the base indent of the after snippet (first indented line)
  let snippetBaseIndent = '';
  for (const line of afterLines) {
    const m = line.match(/^(\s+)\S/);
    if (m) {
      snippetBaseIndent = m[1];
      break;
    }
  }

  for (const line of afterLines) {
    // Skip the job name line itself
    if (/^\S+:/.test(line)) continue;
    if (line.trim() === '') continue;

    // Check if key already exists in job block
    const keyMatch = line.match(/^\s+(\S+):/);
    if (keyMatch) {
      const existsInJob = lines.slice(jobLineIdx + 1, jobEndIdx).some(l =>
        l.match(new RegExp(`^${escapeRegex(jobIndent)}${escapeRegex(keyMatch[1])}:`))
      );
      if (existsInJob) continue;
    }

    // Re-indent: replace snippet's base indent with job's indent
    if (snippetBaseIndent && line.startsWith(snippetBaseIndent)) {
      const relative = line.slice(snippetBaseIndent.length);
      newLines.push(jobIndent + relative);
    } else {
      const stripped = line.replace(/^\s+/, '');
      if (stripped) newLines.push(jobIndent + stripped);
    }
  }

  if (newLines.length === 0) return yaml;

  lines.splice(jobEndIdx, 0, ...newLines);
  return lines.join('\n');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
