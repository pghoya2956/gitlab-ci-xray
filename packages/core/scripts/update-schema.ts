/**
 * Download the latest GitLab CI JSON Schema.
 * Run manually: tsx scripts/update-schema.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SCHEMA_URL =
  'https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/assets/javascripts/editor/schema/ci.json';
const OUTPUT = join(import.meta.dirname, '..', 'src', 'data', 'ci-schema.json');

const res = await fetch(SCHEMA_URL);
if (!res.ok) {
  console.error(`Failed to fetch schema: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const schema = await res.text();
writeFileSync(OUTPUT, schema);
console.log(`Updated CI schema → ${OUTPUT} (${schema.length} bytes)`);
