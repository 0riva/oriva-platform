/**
 * MCP tool dispatcher — translates a ProjectedOperation (from openapi.ts) into
 * an `oriva` CLI invocation via cliRunner.runCli.
 *
 * Replaces the prior @oriva/sdk implementation (v0.2.x). Contract preserved:
 *   callOperation returns { status, text, ok } — index.ts is unchanged.
 *
 * Why the CLI hop:
 *   - Mcp-server no longer carries @oriva/sdk; the CLI owns SDK access
 *   - Spec-driven CLI handles all 46 endpoints uniformly — no per-method SDK
 *     function lookup, no `(rawSdk as Record<string, SdkFn>)[name]` cast
 *   - Subprocess isolation: a hung tool call can't deadlock the MCP server's
 *     event loop the way a misbehaving in-process fetch could
 */
import { runCli } from './cliRunner.js';
import type { ProjectedOperation } from './types.js';

const DEFAULT_BASE_URL = 'https://api.oriva.io';

export interface CallResult {
  status: number;
  text: string;
  ok: boolean;
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
}

function pickByKeys(args: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (args[k] !== undefined) out[k] = args[k];
  }
  return out;
}

/**
 * Reconstruct the request body from MCP-side args, reversing the alias
 * applied in openapi.ts when a body field name collides with a path/query
 * param ("foo" path + "foo" body -> body alias becomes "body_foo").
 */
function buildBody(
  args: Record<string, unknown>,
  bodyFields: Array<{ alias: string; original: string }>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const { alias, original } of bodyFields) {
    if (args[alias] !== undefined) out[original] = args[alias];
  }
  return out;
}

export async function callOperation(
  op: ProjectedOperation,
  args: Record<string, unknown>,
  options: ClientOptions
): Promise<CallResult> {
  const baseUrl = options.baseUrl ?? process.env.ORIVA_API_BASE_URL ?? DEFAULT_BASE_URL;

  const result = await runCli(
    {
      toolName: op.toolName,
      pathParams: pickByKeys(args, op.pathParams),
      queryParams: pickByKeys(args, op.queryParams),
      body: buildBody(args, op.bodyFields),
    },
    {
      apiKey: options.apiKey,
      baseUrl: baseUrl === DEFAULT_BASE_URL ? undefined : baseUrl,
    }
  );

  return { status: result.status, text: result.text, ok: result.ok };
}
