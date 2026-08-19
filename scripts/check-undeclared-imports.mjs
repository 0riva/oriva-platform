#!/usr/bin/env node
/**
 * Guard: every package the deployed code imports must be DECLARED.
 *
 * WHY THIS EXISTS (2026-08-15)
 * ----------------------------
 * Removing `aws-sdk` v2 took production down. Not because anything used
 * aws-sdk — the migration to v3 was complete and every gate was green — but
 * because `src/express/routes/photos.ts` imported `uuid`, which was never
 * declared and had only ever been present as a TRANSITIVE dependency of
 * aws-sdk. `npm ls uuid` confirmed aws-sdk was its sole provider. When the
 * parent went, so did the phantom, and every /api/v1/* route answered
 * FUNCTION_INVOCATION_FAILED with:
 *
 *   Cannot find module 'uuid'
 *   Require stack: /var/task/src/express/routes/photos.js
 *
 * Nothing in the repository could see it coming. A type-check passes, because
 * @types resolve independently. Tests pass, because the local tree still had
 * the package. The failure appears only in a deployment built from
 * `package.json` alone.
 *
 * A sweep at the time found a second one: `ws`, imported by three files and
 * declared by none. It survived only because @deepgram/sdk and
 * @supabase/realtime-js happen to pull it. Both are now declared.
 *
 * Scope is deliberately narrow — the code that ships in the serverless bundle:
 *   - `api/` and `src/`
 *   - NOT `packages/*`, which are workspaces with their own package.json
 *   - NOT `tests/`, `examples/`, or `supabase/functions/` (Deno, URL imports)
 *
 * Run: node scripts/check-undeclared-imports.mjs
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';

const ROOTS = ['api', 'src'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '__tests__', 'patterns']);
const SKIP_FILE = /\.(test|spec)\.[jt]sx?$|\.d\.ts$|\.example\.ts$/;

const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]);

/** Files that ship, walked from the roots above. */
const files = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(p);
    } else if (/\.[jt]sx?$/.test(entry) && !SKIP_FILE.test(entry)) {
      files.push(p);
    }
  }
};
ROOTS.forEach(walk);

if (files.length === 0) {
  console.error('✖ [undeclared-imports] scanned no files — has the layout changed?');
  process.exit(1);
}

/**
 * Bare specifiers only. Anchored to real import/require syntax rather than any
 * quoted string, so a template like `Authorization: Bearer <token>` inside a
 * doc comment is not mistaken for a module.
 */
const PATTERNS = [
  /\bimport\s+(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/g,
  /\bexport\s+(?:[\w*{},\s]+\s+)?from\s+['"]([^'"]+)['"]/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/** `@scope/name/sub` -> `@scope/name`; `name/sub` -> `name`. */
const packageOf = (spec) => {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

const undeclared = new Map();
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (const pattern of PATTERNS) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(src)) !== null) {
      const spec = m[1];
      if (spec.startsWith('.') || spec.startsWith('/') || spec.includes('://')) continue;
      const name = packageOf(spec);
      if (builtins.has(name) || declared.has(name)) continue;
      if (!undeclared.has(name)) undeclared.set(name, new Set());
      undeclared.get(name).add(file);
    }
  }
}

if (undeclared.size > 0) {
  console.error(
    `✖ [undeclared-imports] ${undeclared.size} package(s) imported by deployed code but not in package.json:\n`,
  );
  for (const [name, where] of [...undeclared].sort()) {
    console.error(`   ${name}`);
    for (const f of [...where].sort().slice(0, 4)) console.error(`       ${f}`);
  }
  console.error(
    '\n  These resolve locally only while some OTHER dependency happens to pull them in.\n' +
      '  A deployment installs from package.json, so it will fail at require() —\n' +
      '  and the moment that other dependency is removed, so does everything else.\n' +
      '  Fix: npm install <package>  (declare what you import).',
  );
  process.exit(1);
}

console.log(
  `✔ [undeclared-imports] ${files.length} deployed files: every imported package is declared.`,
);
