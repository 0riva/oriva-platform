#!/usr/bin/env node
/**
 * Prebuild / pretest step: copy the canonical OpenAPI snapshot from
 * claudedocs/openapi-snapshot.json into packages/cli/ so the tarball ships
 * a fully self-contained spec.
 *
 * Unlike packages/mcp-server, the CLI does NOT filter PAT operations —
 * agents calling the CLI directly are operating with explicit developer
 * intent (vs MCP's "AI agent maybe surprised by token-mint tool"). The
 * 49-op surface matches @oriva/sdk 1:1.
 *
 * The snapshot in claudedocs/ stays the source of truth. CI drift-guard
 * (cli-ci.yml) catches uncommitted regenerations.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const src = resolve(pkgRoot, '..', '..', 'claudedocs', 'openapi-snapshot.json');
const dst = resolve(pkgRoot, 'openapi-snapshot.json');

// Verbatim copy of the canonical file. The canonical is Prettier-formatted
// (printWidth:80, compact short arrays), and the CLI does not filter operations
// (unlike packages/mcp-server which drops PAT ops). Verbatim copy guarantees
// byte-for-byte match, which lets cli-ci.yml drift-guard catch uncommitted
// regenerations of the canonical snapshot.
const raw = readFileSync(src, 'utf8');
writeFileSync(dst, raw);

const spec = JSON.parse(raw);
let opCount = 0;
for (const pathItem of Object.values(spec.paths ?? {})) {
  for (const method of Object.keys(pathItem)) {
    if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) opCount += 1;
  }
}
console.log(`[copy-spec] ${src} -> ${dst} (${opCount} operations)`);
