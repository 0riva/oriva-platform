#!/usr/bin/env node
// Post-build: tsc strips the executable bit; re-add it so the bin entry is runnable.
// Also copy spec.json into dist/ since tsc doesn't emit JSON imports as files (it inlines via resolveJsonModule).
import { chmodSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const distEntry = resolve(pkgRoot, 'dist', 'index.js');
const srcSpec = resolve(pkgRoot, 'src', 'spec.json');
const distSpec = resolve(pkgRoot, 'dist', 'spec.json');

if (existsSync(srcSpec)) {
  copyFileSync(srcSpec, distSpec);
  console.log(`[post-build] copied spec.json -> dist/`);
}

if (existsSync(distEntry)) {
  chmodSync(distEntry, 0o755);
  console.log(`[post-build] chmod +x ${distEntry}`);
}
