// Copies packages/shared/src into supabase/functions/_shared/rules so edge
// functions (Deno) use exactly the same business rules as the apps.
// Run: node scripts/sync-shared.mjs        (write)
//      node scripts/sync-shared.mjs --check (fail if out of date, for CI)
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'packages/shared/src');
const dst = join(root, 'supabase/functions/_shared/rules');
const check = process.argv.includes('--check');
mkdirSync(dst, { recursive: true });
let stale = 0;
for (const f of readdirSync(src).filter((x) => x.endsWith('.ts') && !x.endsWith('.test.ts'))) {
  const body = readFileSync(join(src, f), 'utf8').replace(/from '(\.\/[\w-]+)'/g, "from '$1.ts'");
  const out = `// GENERATED from packages/shared/src/${f} by scripts/sync-shared.mjs. Do not edit.\n${body}`;
  const target = join(dst, f);
  if (check) {
    if (!existsSync(target) || readFileSync(target, 'utf8') !== out) { console.error(`out of date: ${f}`); stale++; }
  } else writeFileSync(target, out);
}
if (check && stale) process.exit(1);
console.log(check ? 'shared rules in sync' : `synced to ${dst}`);
