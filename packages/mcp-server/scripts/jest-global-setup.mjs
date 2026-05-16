#!/usr/bin/env node
/**
 * Jest globalSetup: ensure src/spec.json exists before any test runs.
 * The bundled spec is gitignored (built from claudedocs/openapi-snapshot.json
 * via copy-spec.mjs), so a fresh clone has to materialize it first.
 *
 * Mirrors packages/cli/scripts/jest-global-setup.mjs.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const specPath = resolve(pkgRoot, 'src', 'spec.json');

export default async function globalSetup() {
  // Always re-copy — cheap, and keeps tests stable when the canonical spec changes.
  const script = resolve(pkgRoot, 'scripts', 'copy-spec.mjs');
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`copy-spec.mjs exited with status ${result.status}`);
  }
  if (!existsSync(specPath)) {
    throw new Error(`expected spec at ${specPath} after copy-spec.mjs`);
  }
}
