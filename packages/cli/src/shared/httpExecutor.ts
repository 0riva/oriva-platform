/**
 * Execute an operation against the live HTTP API.
 *
 * Ported from ultra-api-client (~/ultra-network/packages/ultra-api-client/src/httpExecutor.ts);
 * key deviation: API-key regex swapped to Oriva's `oriva_pk_(live|test)_*` format
 * matching @oriva/sdk's documented convention.
 */
import type { ExtractedOperation } from './types.js';

export interface ExecuteOptions {
  baseUrl: string;
  apiKey?: string;
  userAgent?: string;
}

export interface ExecuteResult {
  status: number;
  body: unknown;
  request_id?: string;
  /** Reconstructed for envelope output. */
  url: string;
  method: string;
}

const ORIVA_KEY_PATTERN = /^oriva_pk_(live|test)_[A-Za-z0-9_-]+$/;

export async function executeOperation(
  op: ExtractedOperation,
  args: Record<string, unknown>,
  opts: ExecuteOptions,
  fetchImpl: typeof fetch = fetch
): Promise<ExecuteResult> {
  let path = op.pathTemplate;
  for (const name of op.pathParams) {
    const v = args[name];
    if (v === undefined || v === null) {
      throw new Error(`Missing required path parameter: ${name}`);
    }
    path = path.replace(`{${name}}`, encodeURIComponent(String(v)));
  }

  const url = new URL(opts.baseUrl.replace(/\/$/, '') + path);
  for (const name of op.queryParams) {
    const v = args[name];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      v.forEach((item) => url.searchParams.append(name, String(item)));
    } else {
      url.searchParams.set(name, String(v));
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': opts.userAgent || 'oriva-cli/0.1.0',
  };
  if (opts.apiKey) {
    // Reject malformed keys BEFORE handing to fetch — runtime Headers.append
    // echoes invalid values in error messages, which leaks the key into logs/
    // transcripts. Validate first; throw a sanitized error if bad.
    if (!ORIVA_KEY_PATTERN.test(opts.apiKey)) {
      throw new Error(
        'Invalid API key format (expected `oriva_pk_live_…` or `oriva_pk_test_…`). ' +
          'Check that ORIVA_API_KEY contains exactly one key value — ' +
          'multi-line input or a grep with multiple matches will fail here.'
      );
    }
    headers.Authorization = `Bearer ${opts.apiKey}`;
  }

  let body: string | undefined;
  if (op.hasBody && args.body !== undefined) {
    headers['Content-Type'] = op.bodyContentType || 'application/json';
    body = typeof args.body === 'string' ? args.body : JSON.stringify(args.body);
  }

  const method = op.method.toUpperCase();
  const res = await fetchImpl(url.toString(), { method, headers, body });

  const contentType = res.headers.get('content-type') || '';
  const parsed: unknown = contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : await res.text();

  return {
    status: res.status,
    body: parsed,
    request_id: res.headers.get('x-request-id') ?? undefined,
    url: url.toString(),
    method,
  };
}
