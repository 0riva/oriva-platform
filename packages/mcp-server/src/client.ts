import { rawClient, rawSdk } from '@oriva/sdk';
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

let configuredKey: string | undefined;
let configuredBaseUrl: string | undefined;

function ensureClientConfigured(options: ClientOptions): void {
  const baseUrl = options.baseUrl ?? process.env.ORIVA_API_BASE_URL ?? DEFAULT_BASE_URL;
  if (configuredKey === options.apiKey && configuredBaseUrl === baseUrl) return;

  rawClient.setConfig({
    baseUrl,
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'User-Agent': '@oriva/mcp-server/0.2.0',
    },
  });
  configuredKey = options.apiKey;
  configuredBaseUrl = baseUrl;
}

function pickByKeys(
  args: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> | undefined {
  if (keys.length === 0) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (args[k] !== undefined) out[k] = args[k];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function buildBody(
  args: Record<string, unknown>,
  bodyFields: Array<{ alias: string; original: string }>
): Record<string, unknown> | undefined {
  if (bodyFields.length === 0) return undefined;
  const out: Record<string, unknown> = {};
  for (const { alias, original } of bodyFields) {
    if (args[alias] !== undefined) out[original] = args[alias];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

type SdkFn = (options: Record<string, unknown>) => Promise<{
  data?: unknown;
  error?: unknown;
  response: Response;
}>;

export async function callOperation(
  op: ProjectedOperation,
  args: Record<string, unknown>,
  options: ClientOptions
): Promise<CallResult> {
  ensureClientConfigured(options);

  const fn = (rawSdk as unknown as Record<string, SdkFn>)[op.toolName];
  if (typeof fn !== 'function') {
    throw new Error(`No SDK method for operationId: ${op.toolName}`);
  }

  const sdkOptions: Record<string, unknown> = {};
  const path = pickByKeys(args, op.pathParams);
  const query = pickByKeys(args, op.queryParams);
  const body = buildBody(args, op.bodyFields);
  if (path) sdkOptions.path = path;
  if (query) sdkOptions.query = query;
  if (body) sdkOptions.body = body;

  const result = await fn(sdkOptions);
  const payload = result.data ?? result.error ?? null;
  const text =
    payload === null ? '' : typeof payload === 'string' ? payload : JSON.stringify(payload);

  return {
    status: result.response.status,
    text,
    ok: result.response.ok,
  };
}
