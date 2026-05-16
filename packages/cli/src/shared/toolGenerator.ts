/**
 * Walk an OpenAPI 3.1 document and emit one ExtractedOperation per
 * (method, path) pair.
 *
 * Ported from ultra-api-client; key deviations:
 *   - Drop `toSnake()` — keep `operationId` verbatim (camelCase) so command
 *     names match SDK function names 1:1 (`oriva listProfiles`).
 *   - Carry `tags` through onto ExtractedOperation for tag-grouped help.
 */
import type { MinimalOpenApiDoc } from './loadSpec.js';
import type { ExtractedOperation } from './types.js';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

interface RawOp {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Array<{
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie';
    required?: boolean;
    description?: string;
    schema?: Record<string, unknown>;
  }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: Record<string, unknown> }>;
  };
}

function deriveToolName(method: string, path: string): string {
  // Fallback for ops without operationId — derive camelCase verb + segments
  // (e.g. `get /trips/{id}` -> `getTripsById`).
  const segments = path
    .replace(/^\/+/, '')
    .split('/')
    .map((seg, i) => {
      const param = /^\{(.+)\}$/.exec(seg);
      const word = param ? `By${capitalize(param[1])}` : seg;
      return i === 0 ? word : capitalize(word.replace(/^by/i, 'By'));
    });
  return (
    method +
    segments
      .map(capitalize)
      .join('')
      .replace(/[^A-Za-z0-9]/g, '')
  );
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function extractOperations(
  doc: MinimalOpenApiDoc,
  opts: { tagFilter?: string[] } = {}
): ExtractedOperation[] {
  const out: ExtractedOperation[] = [];
  const tagFilter = (opts.tagFilter ?? []).map((t) => t.toLowerCase());

  for (const [pathTemplate, pathItem] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = (pathItem as Record<string, RawOp>)[method];
      if (!op) continue;
      const opTags = (op.tags ?? []).map((t) => t);
      const lowerTags = opTags.map((t) => t.toLowerCase());
      if (tagFilter.length && !lowerTags.some((t) => tagFilter.includes(t))) continue;

      const params = op.parameters ?? [];
      const pathParams = params.filter((p) => p.in === 'path').map((p) => p.name);
      const queryParams = params.filter((p) => p.in === 'query').map((p) => p.name);

      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const p of params) {
        if (p.in !== 'path' && p.in !== 'query') continue;
        const schema = (p.schema ?? { type: 'string' }) as Record<string, unknown>;
        properties[p.name] = p.description ? { ...schema, description: p.description } : schema;
        if (p.required) required.push(p.name);
      }

      let hasBody = false;
      let bodyContentType: string | undefined;
      if (op.requestBody?.content) {
        const ct = Object.keys(op.requestBody.content)[0];
        if (ct) {
          bodyContentType = ct;
          const bodySchema = op.requestBody.content[ct].schema;
          if (bodySchema) {
            properties.body = bodySchema;
            hasBody = true;
            if (op.requestBody.required) required.push('body');
          }
        }
      }

      const inputSchema: Record<string, unknown> = {
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
      };

      out.push({
        name: op.operationId ? op.operationId : deriveToolName(method, pathTemplate),
        description: op.summary || op.description || `${method.toUpperCase()} ${pathTemplate}`,
        method,
        pathTemplate,
        inputSchema,
        pathParams,
        queryParams,
        hasBody,
        bodyContentType,
        tags: opTags,
      });
    }
  }

  // Defensive de-dup — operationId collisions silently shadow each other otherwise.
  const seen = new Set<string>();
  return out.filter((o) => {
    if (seen.has(o.name)) return false;
    seen.add(o.name);
    return true;
  });
}
