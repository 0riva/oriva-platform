/**
 * Coerce string CLI flags to the JSON types the API expects.
 *
 * Ported verbatim from ultra-cli (~/ultra-network/packages/ultra-cli/src/coerce.ts) —
 * type-coercion semantics are universal.
 */

interface PropSchema {
  type?: string;
  items?: PropSchema;
}

export function coerceArgs(
  rawFlags: Record<string, string | string[] | boolean>,
  inputSchema: Record<string, unknown>
): Record<string, unknown> {
  const props = (inputSchema as { properties?: Record<string, PropSchema> }).properties ?? {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawFlags)) {
    const schema = props[k];
    out[k] = coerceOne(v, schema);
  }
  return out;
}

function coerceOne(v: string | string[] | boolean, schema: PropSchema | undefined): unknown {
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map((x) => coerceScalar(x, schema?.items ?? schema));
  return coerceScalar(v, schema);
}

function coerceScalar(s: string, schema: PropSchema | undefined): unknown {
  const t = schema?.type;
  if (t === 'integer') {
    const n = Number.parseInt(s, 10);
    if (Number.isNaN(n)) throw new Error(`Expected integer, got: ${s}`);
    return n;
  }
  if (t === 'number') {
    const n = Number(s);
    if (Number.isNaN(n)) throw new Error(`Expected number, got: ${s}`);
    return n;
  }
  if (t === 'boolean') {
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
    throw new Error(`Expected boolean, got: ${s}`);
  }
  return s;
}
