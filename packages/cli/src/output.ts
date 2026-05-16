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
}

export function renderEnvelope(result: ExecuteResult): Envelope {
  const ok = result.status >= 200 && result.status < 300;
  // Body may be a structured error object (e.g. { error: {...} }) or a success payload.
  // Heuristic: if body has an `error` field AND we got a 4xx/5xx, surface that as `error`.
  let data: unknown = null;
  let error: unknown = null;
  if (ok) {
    data = result.body;
  } else {
    error =
      result.body &&
      typeof result.body === 'object' &&
      'error' in (result.body as Record<string, unknown>)
        ? (result.body as Record<string, unknown>).error
        : result.body;
  }
  return {
    ok,
    status: result.status,
    data,
    error,
    request_id: result.request_id,
    url: result.url,
    method: result.method,
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
