/**
 * Output rendering for the `oriva` CLI.
 *
 * Three modes:
 *   default: pretty-printed JSON of the response body
 *   --raw:   response body unchanged (no re-serialization)
 *   --json:  agent-friendly envelope
 *            { ok, status, data, error, request_id, url?, method? }
 *
 * The envelope is always parseable regardless of HTTP status — agents calling
 * the CLI in tight loops want `JSON.parse(stdout).ok` not `if (exit === 0) ...`.
 */
import type { ExecuteResult } from './shared/httpExecutor.js';

export interface OutputOptions {
  raw?: boolean;
  json?: boolean;
}

export interface Envelope {
  ok: boolean;
  status: number;
  data: unknown;
  error: unknown;
  request_id?: string;
  url?: string;
  method?: string;
  /**
   * Other top-level fields of an error body besides `error` (e.g. `refused`,
   * `hint`, `purchaseId`), so they are not lost when `error` is a string.
   */
  details?: Record<string, unknown>;
  /** The Idempotency-Key the request carried, when the operation takes one. */
  idempotency_key?: string;
}

/** Envelope-level keys already represented by `ok`/`error`. */
const ERROR_BODY_SKIP = new Set(['error', 'ok', 'success']);

export function renderEnvelope(result: ExecuteResult): Envelope {
  const ok = result.status >= 200 && result.status < 300;
  // Body may be a structured error object (e.g. { error: {...} }) or a success payload.
  // Heuristic: if body has an `error` field AND we got a 4xx/5xx, surface that as `error`.
  let data: unknown = null;
  let error: unknown = null;
  let details: Record<string, unknown> | undefined;
  if (ok) {
    data = result.body;
  } else {
    const isErrorObject =
      result.body &&
      typeof result.body === 'object' &&
      !Array.isArray(result.body) &&
      'error' in (result.body as Record<string, unknown>);
    error = isErrorObject ? (result.body as Record<string, unknown>).error : result.body;
    if (isErrorObject) {
      const rest = Object.entries(result.body as Record<string, unknown>).filter(
        ([k]) => !ERROR_BODY_SKIP.has(k)
      );
      if (rest.length) details = Object.fromEntries(rest);
    }
  }
  return {
    ok,
    status: result.status,
    data,
    error,
    request_id: result.request_id,
    url: result.url,
    method: result.method,
    ...(details ? { details } : {}),
    ...(result.idempotency_key ? { idempotency_key: result.idempotency_key } : {}),
  };
}

export function renderOutput(result: ExecuteResult, opts: OutputOptions): string {
  if (opts.json) {
    return JSON.stringify(renderEnvelope(result), null, 2);
  }
  if (opts.raw) {
    return typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
  }
  return JSON.stringify(result.body, null, 2);
}
