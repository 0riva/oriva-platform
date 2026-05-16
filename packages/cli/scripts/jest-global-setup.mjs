/**
 * Jest globalSetup — ensure openapi-snapshot.json exists before any test
 * exercises the bundled-snapshot default loader path.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export default async function setup() {
  const here = dirname(fileURLToPath(import.meta.url));
  const script = resolve(here, 'copy-spec.mjs');
  const r = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (r.status !== 0) {
    throw new Error(`jest-global-setup: copy-spec.mjs exited ${r.status}`);
  }
}
