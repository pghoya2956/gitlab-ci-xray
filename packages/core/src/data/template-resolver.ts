import { BUNDLED_TEMPLATES } from './bundled-templates.js';

/**
 * Look up a GitLab CI template by name from the bundled templates.
 * Template names match GitLab's `include: template:` syntax.
 *
 * Examples:
 *   "Docker.gitlab-ci.yml" → Docker template
 *   "Jobs/Build.gitlab-ci.yml" → Jobs/Build template
 *   "Security/SAST.gitlab-ci.yml" → Security/SAST template
 */
export function lookupTemplate(templateName: string): string | null {
  return BUNDLED_TEMPLATES[templateName] ?? null;
}

/**
 * List all available bundled template names.
 */
export function listTemplates(): string[] {
  return Object.keys(BUNDLED_TEMPLATES);
}
