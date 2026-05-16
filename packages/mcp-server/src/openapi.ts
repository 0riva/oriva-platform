import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  HttpMethod,
  JsonSchema,
  MCPTool,
  OpenApiDoc,
  OpenApiOperation,
  OpenApiParameter,
  OperationIndex,
  ProjectedOperation,
} from './types.js';

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

const ANNOTATION_KEYS = [
  'type',
  'description',
  'enum',
  'format',
  'pattern',
  'minimum',
  'maximum',
  'minLength',
  'maxLength',
  'example',
  'items',
  'nullable',
  'default',
] as const;

function loadSpec(): OpenApiDoc {
  const here = dirname(fileURLToPath(import.meta.url));
  const specPath = resolve(here, 'spec.json');
  const raw = readFileSync(specPath, 'utf-8');
  return JSON.parse(raw) as OpenApiDoc;
}

const SPEC = loadSpec();

function resolveRef(node: JsonSchema | undefined, seen: Set<string> = new Set()): JsonSchema {
  if (!node || typeof node !== 'object') return {};
  if (node.$ref && typeof node.$ref === 'string') {
    if (seen.has(node.$ref)) return {}; // cycle guard
    const nextSeen = new Set(seen);
    nextSeen.add(node.$ref);
    const path = node.$ref.replace(/^#\//, '').split('/');
    let resolved: unknown = SPEC;
    for (const segment of path) {
      resolved = (resolved as Record<string, unknown>)?.[segment];
    }
    if (!resolved) {
      throw new Error(`Unresolved $ref: ${node.$ref}`);
    }
    return resolveRef(resolved as JsonSchema, nextSeen);
  }
  const out: JsonSchema = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'properties' && v && typeof v === 'object') {
      const props: Record<string, JsonSchema> = {};
      for (const [pk, pv] of Object.entries(v as Record<string, JsonSchema>)) {
        props[pk] = resolveRef(pv, new Set(seen));
      }
      out.properties = props;
    } else if (k === 'items' && v && typeof v === 'object') {
      out.items = resolveRef(v as JsonSchema, new Set(seen));
    } else if (k === 'additionalProperties' && v && typeof v === 'object') {
      out.additionalProperties = resolveRef(v as JsonSchema, new Set(seen));
    } else {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

function preserveAnnotations(schema: JsonSchema, param?: OpenApiParameter): JsonSchema {
  const out: JsonSchema = {};
  for (const key of ANNOTATION_KEYS) {
    const value = schema[key as keyof JsonSchema];
    if (value !== undefined) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  if (param?.description && !out.description) out.description = param.description;
  if (!out.type) out.type = 'string';
  return out;
}

interface BuiltSchema {
  schema: JsonSchema;
  operation: Pick<ProjectedOperation, 'pathParams' | 'queryParams' | 'bodyFields'>;
}

function buildInputSchema(op: OpenApiOperation): BuiltSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  const pathParams: string[] = [];
  const queryParams: string[] = [];
  const bodyFields: Array<{ alias: string; original: string }> = [];

  for (const p of op.parameters ?? []) {
    if (p.in !== 'path' && p.in !== 'query') continue;
    const resolved = p.schema ? resolveRef(p.schema) : {};
    properties[p.name] = preserveAnnotations(resolved, p);
    if (p.in === 'path') {
      pathParams.push(p.name);
      if (!required.includes(p.name)) required.push(p.name);
    } else {
      queryParams.push(p.name);
      if (p.required && !required.includes(p.name)) required.push(p.name);
    }
  }

  const bodySchema = op.requestBody?.content?.['application/json']?.schema;
  if (bodySchema) {
    const resolvedBody = resolveRef(bodySchema);
    const bodyRequired = new Set(resolvedBody.required ?? []);
    const bodyIsRequired = op.requestBody?.required === true;
    for (const [key, sub] of Object.entries(resolvedBody.properties ?? {})) {
      const collision = key in properties;
      const alias = collision ? `body_${key}` : key;
      properties[alias] = resolveRef(sub);
      bodyFields.push({ alias, original: key });
      const isRequired = bodyRequired.has(key) || (bodyIsRequired && bodyRequired.size === 0);
      if (isRequired && !required.includes(alias)) required.push(alias);
    }
  }

  return {
    schema: { type: 'object', properties, required, additionalProperties: false },
    operation: { pathParams, queryParams, bodyFields },
  };
}

export interface ProjectionResult {
  tools: MCPTool[];
  index: OperationIndex;
}

export function projectTools(): ProjectionResult {
  const tools: MCPTool[] = [];
  const index: OperationIndex = new Map();
  const seenNames = new Set<string>();

  for (const [path, methods] of Object.entries(SPEC.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = methods[method];
      if (!op?.operationId) continue;
      if (seenNames.has(op.operationId)) {
        throw new Error(`Duplicate operationId in spec: ${op.operationId}`);
      }
      seenNames.add(op.operationId);

      const { schema, operation } = buildInputSchema(op);
      const description =
        [op.summary, op.description].filter(Boolean).join(' — ') ||
        `${method.toUpperCase()} ${path}`;

      tools.push({ name: op.operationId, description, inputSchema: schema });
      index.set(op.operationId, {
        toolName: op.operationId,
        path,
        method,
        ...operation,
      });
    }
  }

  return { tools, index };
}

export function getSpecInfo(): { paths: number; schemas: number } {
  return {
    paths: Object.keys(SPEC.paths ?? {}).length,
    schemas: Object.keys(SPEC.components?.schemas ?? {}).length,
  };
}
