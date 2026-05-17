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

  // Extract the Oriva-internal invocation ID injected by the CallToolRequestSchema handler.
  // This field is NOT part of the OpenAPI spec, so we strip it from args before passing to
  // buildBody / pickByKeys, then merge it into the request body's metadata field so that
  // downstream tools (e.g. createPaymentLink) can thread it into Stripe payment-link metadata.
  const invocationId = args._oriva_invocation_id as string | undefined;
  const cleanArgs = invocationId
    ? Object.fromEntries(Object.entries(args).filter(([k]) => k !== '_oriva_invocation_id'))
    : args;

  const body = buildBody(cleanArgs, op.bodyFields);

  // Merge invocation tracking into the body metadata field if the tool supports it
  // (i.e. the body is non-empty, so this is a mutating operation tool like createPaymentLink).
  if (invocationId && Object.keys(body).length > 0) {
    const existingMetadata =
      body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : {};
    body.metadata = {
      ...existingMetadata,
      oriva_invocation_id: invocationId,
    };
  }

  const result = await runCli(
    {
      toolName: op.toolName,
      pathParams: pickByKeys(cleanArgs, op.pathParams),
      queryParams: pickByKeys(cleanArgs, op.queryParams),
      body,
    },
    {
      apiKey: options.apiKey,
      baseUrl: baseUrl === DEFAULT_BASE_URL ? undefined : baseUrl,
    }
  );

  return { status: result.status, text: result.text, ok: result.ok };
}
