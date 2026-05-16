#!/usr/bin/env node
// Prebuild step: copy the canonical OpenAPI snapshot into src/ so tsc + resolveJsonModule
// can bundle it into dist/. The snapshot in claudedocs/ stays the source of truth.
//
// Filter: PAT-management operations are stripped from the bundled spec because they
// reject PAT auth (only accept Supabase JWT — chain-of-trust: a PAT shouldn't mint/
// revoke other PATs). Exposing them as MCP tools is a foot-gun — customers asking
// "list my tokens" through their AI agent get a confusing 401. Mint/list/revoke
// stays web-only at /settings/personal-access-tokens.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const src = resolve(pkgRoot, '..', '..', 'claudedocs', 'openapi-snapshot.json');
const dst = resolve(pkgRoot, 'src', 'spec.json');

const MCP_HIDDEN_OPERATION_IDS = new Set([
  'createPersonalAccessToken',
  'listPersonalAccessTokens',
  'revokePersonalAccessToken',
]);

const spec = JSON.parse(readFileSync(src, 'utf8'));
let dropped = 0;
for (const [pathKey, pathItem] of Object.entries(spec.paths ?? {})) {
  for (const method of Object.keys(pathItem)) {
    const op = pathItem[method];
    if (op && typeof op === 'object' && MCP_HIDDEN_OPERATION_IDS.has(op.operationId)) {
      delete pathItem[method];
      dropped += 1;
    }
  }
  if (Object.keys(pathItem).length === 0) {
    delete spec.paths[pathKey];
  }
}

mkdirSync(dirname(dst), { recursive: true });
writeFileSync(dst, JSON.stringify(spec));
console.log(
  `[copy-spec] ${src} -> ${dst} (dropped ${dropped} hidden operations: ${[...MCP_HIDDEN_OPERATION_IDS].join(', ')})`,
);
