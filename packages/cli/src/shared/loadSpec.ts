/**
 * Load an OpenAPI document from a URL, local file path, or the bundled
 * snapshot that ships inside the CLI tarball.
 *
 * Ported from ultra-api-client (~/ultra-network/packages/ultra-api-client/src/loadSpec.ts);
 * adds the bundled-snapshot default so `oriva <op>` has sub-second cold start
 * with zero network — critical for agents calling in tight loops.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface MinimalOpenApiDoc {
  openapi: string;
  info?: { title?: string; version?: string };
  servers?: Array<{ url: string; description?: string }>;
  paths?: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, unknown> };
}

/**
 * Resolve the bundled-snapshot path. The snapshot lives at the package root.
 * This function self-locates from its own module URL (dist/shared/loadSpec.js
 * → ../../openapi-snapshot.json) so it doesn't depend on the caller's CWD or
 * import-meta location.
 */
export function bundledSnapshotPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/shared/loadSpec.js -> ../../openapi-snapshot.json
  return resolve(here, '..', '..', 'openapi-snapshot.json');
}

export async function loadSpec(source: string): Promise<MinimalOpenApiDoc> {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch OpenAPI spec from ${source}: HTTP ${res.status}`);
    }
    return (await res.json()) as MinimalOpenApiDoc;
  }
  const text = await readFile(source, 'utf8');
  return JSON.parse(text) as MinimalOpenApiDoc;
}
