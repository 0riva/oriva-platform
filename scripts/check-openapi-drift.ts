#!/usr/bin/env ts-node
/**
 * OpenAPI drift detector.
 *
 * Checks that spec paths ↔ Express route registrations stay in sync.
 * Exit 0 = clean. Exit 1 = drift detected (blocks CI).
 *
 * Rules:
 *   - Every path in the spec must have a corresponding Express route (stale spec check).
 *   - Every public Express route must be in the spec OR in EXCLUDED_EXPRESS_ROUTES (undocumented check).
 *
 * When adding a new route:
 *   → Register it in src/openapi/schemas/<tag>.ts first (schema-first pattern).
 *   → If the route is intentionally internal/admin/deprecated, add it to EXCLUDED_EXPRESS_ROUTES below.
 */

import { openApiDocument } from '../src/openapi/spec';
import * as fs from 'fs';
import * as path from 'path';

// ── Exclusion list ────────────────────────────────────────────────────────────
// Express routes that are intentionally absent from the public spec.
// Format: "METHOD /openapi/style/path" (Express :param → {param}).

const EXCLUDED_EXPRESS_ROUTES = new Set([
  // Infrastructure / health / test
  'GET /health',
  'GET /api/v1/health',
  'GET /api/v1/test',
  // Dev / debug — never ship to 3rd parties
  'GET /dev-profiles',
  'GET /api/v1/debug/cors',
  'GET /api/v1/dev/permissions',
  // Redirect alias — documented as GET /api/v1/user/me
  'GET /api/v1/users/me',
  // Admin — internal operations only
  'GET /api/v1/admin/apps/pending',
  'POST /api/v1/admin/apps/{appId}/review',
  // Marketplace: seller-side item mutations (not yet public developer API)
  'POST /api/v1/marketplace/items',
  'PUT /api/v1/marketplace/items/{id}',
  'DELETE /api/v1/marketplace/items/{id}',
  // Marketplace: admin-only category mutations
  'POST /api/v1/marketplace/categories',
  'PUT /api/v1/marketplace/categories/{id}',
  'DELETE /api/v1/marketplace/categories/{id}',
  // Shadowed duplicate: a second GET /api/v1/marketplace/categories registration
  // (no-auth, collections-table version at line ~3395) is shadowed by the
  // validateApiKey registration — Express uses first match. Already in spec.
  // Spec infrastructure — not part of the API contract
  'GET /api/openapi.json',
]);

// Route path prefixes that are entirely excluded (deprecated tenant API).
const EXCLUDED_PREFIXES = ['/api/v1/tenant/'];

// ── Extract Express routes from api/index.ts ──────────────────────────────────

const indexPath = path.resolve(__dirname, '../api/index.ts');
const source = fs.readFileSync(indexPath, 'utf-8');

// Matches: app.get('/path') or app.post( '/path') or app.delete("/path")
const routePattern = /app\.(get|post|put|patch|delete)\s*\(\s*['"`](\/[^'"`\n]+)['"`]/gi;

const expressRoutes = new Set<string>();
let m: RegExpExecArray | null;

while ((m = routePattern.exec(source)) !== null) {
  const method = m[1].toUpperCase();
  // Convert Express :param → OpenAPI {param}
  const openApiPath = m[2].replace(/:([^/\s]+)/g, '{$1}');
  expressRoutes.add(`${method} ${openApiPath}`);
}

// ── Extract spec paths ────────────────────────────────────────────────────────

const specEntries = new Set<string>();
const methods = ['get', 'post', 'put', 'patch', 'delete'];

for (const [specPath, pathItem] of Object.entries(openApiDocument.paths ?? {})) {
  for (const method of methods) {
    if (method in (pathItem as object)) {
      specEntries.add(`${method.toUpperCase()} ${specPath}`);
    }
  }
}

// ── Compare ───────────────────────────────────────────────────────────────────

const stalePaths: string[] = [];
const undocumented: string[] = [];

// 1. Spec paths not found in Express (stale spec entry)
for (const entry of specEntries) {
  if (!expressRoutes.has(entry)) {
    stalePaths.push(entry);
  }
}

// 2. Express routes not in spec and not excluded (undocumented public route)
for (const entry of expressRoutes) {
  const routePath = entry.split(' ')[1];
  if (EXCLUDED_PREFIXES.some((prefix) => routePath.startsWith(prefix))) continue;
  if (EXCLUDED_EXPRESS_ROUTES.has(entry)) continue;
  if (!specEntries.has(entry)) {
    undocumented.push(entry);
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

let drift = false;

if (stalePaths.length > 0) {
  console.error('\n❌ STALE SPEC ENTRIES — in spec but not in Express:');
  stalePaths.forEach((p) => console.error(`   ${p}`));
  console.error('   → Remove from src/openapi/schemas/ or add the missing Express route.\n');
  drift = true;
}

if (undocumented.length > 0) {
  console.error('\n❌ UNDOCUMENTED ROUTES — in Express but not in spec:');
  undocumented.forEach((p) => console.error(`   ${p}`));
  console.error(
    '\n   → Register in src/openapi/schemas/<tag>.ts (see api/patterns/openapi-schema-first.md)' +
      '\n   → OR add to EXCLUDED_EXPRESS_ROUTES in scripts/check-openapi-drift.ts if intentionally internal.\n'
  );
  drift = true;
}

if (!drift) {
  console.log(
    `✅ OpenAPI spec in sync — ${specEntries.size} spec paths, ` +
      `${expressRoutes.size} Express routes (${EXCLUDED_EXPRESS_ROUTES.size} excluded).`
  );
  process.exit(0);
} else {
  process.exit(1);
}
