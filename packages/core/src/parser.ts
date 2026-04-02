import yaml from 'js-yaml';
import { REFERENCE_MARKER, type ReferenceMarker, XRayError } from './types.js';

/**
 * Custom YAML type for GitLab CI's !reference tag.
 * Parses `!reference [job_name, key, ...]` into a ReferenceMarker object.
 */
const referenceType = new yaml.Type('!reference', {
  kind: 'sequence',
  resolve(data: unknown): boolean {
    return Array.isArray(data) && data.length >= 1;
  },
  construct(data: unknown[]): ReferenceMarker {
    return {
      [REFERENCE_MARKER]: true,
      path: data.map(String),
    };
  },
  represent(obj: object): string[] {
    return (obj as ReferenceMarker).path;
  },
});

const GITLAB_CI_SCHEMA = yaml.DEFAULT_SCHEMA.extend([referenceType]);

export interface ParseResult {
  /** Raw parsed YAML object (may contain ReferenceMarker values) */
  data: Record<string, unknown>;
  /** Source line mapping for top-level keys */
  lineMap: Map<string, number>;
}

/**
 * Parse a GitLab CI YAML string into a JavaScript object.
 * Handles !reference tags, anchors, aliases, and merge keys.
 */
export function parseYaml(source: string, file = '.gitlab-ci.yml'): ParseResult {
  try {
    const data = yaml.load(source, { schema: GITLAB_CI_SCHEMA, json: true }) as Record<string, unknown> | null;

    if (data == null || typeof data !== 'object' || Array.isArray(data)) {
      throw new XRayError('YAML이 비어 있거나 유효한 매핑이 아닙니다.', file, null, null);
    }

    const lineMap = buildLineMap(source);

    return { data, lineMap };
  } catch (err: unknown) {
    if (err instanceof XRayError) throw err;
    if (err instanceof yaml.YAMLException) {
      const mark = err.mark;
      throw new XRayError(
        `YAML 구문 오류: ${err.reason ?? err.message}`,
        file,
        mark?.line != null ? mark.line + 1 : null,
        mark?.column != null ? mark.column + 1 : null,
      );
    }
    throw new XRayError(
      `YAML 파싱 실패: ${String(err)}`,
      file,
      null,
      null,
    );
  }
}

/**
 * Build a map of top-level YAML keys to their line numbers.
 * Simple heuristic: a line that starts with a non-space/non-tab character
 * followed by a colon is a top-level key.
 */
function buildLineMap(source: string): Map<string, number> {
  const map = new Map<string, number>();
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Top-level key: starts at column 0, has a colon
    const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_.-]*):/);
    if (match) {
      map.set(match[1], i + 1); // 1-based line number
    }
  }

  return map;
}

/**
 * Build a more detailed line map that includes nested keys within jobs.
 * Returns a map of "jobName.key" → line number.
 */
export function buildDetailedLineMap(source: string): Map<string, number> {
  const map = new Map<string, number>();
  const lines = source.split('\n');
  let currentTopLevel: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Top-level key
    const topMatch = line.match(/^([a-zA-Z_.][a-zA-Z0-9_.-]*):/);
    if (topMatch) {
      currentTopLevel = topMatch[1];
      map.set(currentTopLevel, i + 1);
      continue;
    }

    // Nested key (any indent depth > 0)
    if (currentTopLevel) {
      const nestedMatch = line.match(/^(\s+)([a-zA-Z_][a-zA-Z0-9_]*):/);
      if (nestedMatch) {
        map.set(`${currentTopLevel}.${nestedMatch[2]}`, i + 1);
      }
    }
  }

  return map;
}
