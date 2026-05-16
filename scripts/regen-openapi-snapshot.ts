#!/usr/bin/env ts-node
/**
 * Regenerate the canonical OpenAPI snapshot from Zod schemas.
 *
 * Run after adding/modifying any path in src/openapi/schemas/*.ts.
 * The CLI bundled snapshot (packages/cli/openapi-snapshot.json) and the
 * MCP server's filtered spec.json are derived from this canonical file
 * via packages/{cli,mcp-server}/scripts/copy-spec.mjs.
 *
 * Usage: npx ts-node scripts/regen-openapi-snapshot.ts
 *
 * Note: output is pretty-printed (2-space indent) to match Prettier's
 * JSON format with printWidth:80. After writing, the CLI copy-spec.mjs
 * pretty-prints with the same indent, so byte-for-byte comparison works.
 */
import { openApiDocument } from '../src/openapi/spec';
import * as fs from 'fs';
import * as path from 'path';

const dst = path.resolve(__dirname, '..', 'claudedocs', 'openapi-snapshot.json');
const json = JSON.stringify(openApiDocument, null, 2) + '\n';
fs.writeFileSync(dst, json);

let opCount = 0;
for (const pathItem of Object.values(openApiDocument.paths ?? {})) {
  for (const method of Object.keys(pathItem as object)) {
    if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) opCount += 1;
  }
}
console.log(`[regen-snapshot] wrote ${dst} (${opCount} operations)`);
