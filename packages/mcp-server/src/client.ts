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

export async function callOperation(
  op: ProjectedOperation,
  args: Record<string, unknown>,
  options: ClientOptions
): Promise<CallResult> {
  const baseUrl = options.baseUrl ?? process.env.ORIVA_API_BASE_URL ?? DEFAULT_BASE_URL;

  let path = op.path;
  for (const name of op.pathParams) {
    const value = args[name];
    if (value === undefined || value === null) {
      throw new Error(`Missing required path parameter: ${name}`);
    }
    path = path.replace(`{${name}}`, encodeURIComponent(String(value)));
  }

  const qs = new URLSearchParams();
  for (const name of op.queryParams) {
    const value = args[name];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) qs.append(name, String(item));
    } else {
      qs.set(name, String(value));
    }
  }
  const queryString = qs.toString();

  let body: string | undefined;
  let contentType: string | undefined;
  const methodAllowsBody = op.method !== 'get' && op.method !== 'head' && op.method !== 'delete';
  if (methodAllowsBody && op.bodyFields.length > 0) {
    const bodyObj: Record<string, unknown> = {};
    for (const { alias, original } of op.bodyFields) {
      if (args[alias] !== undefined) bodyObj[original] = args[alias];
    }
    if (Object.keys(bodyObj).length > 0) {
      body = JSON.stringify(bodyObj);
      contentType = 'application/json';
    }
  }

  const url = `${baseUrl}${path}${queryString ? '?' + queryString : ''}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    Accept: 'application/json',
    'User-Agent': '@oriva/mcp-server/0.1.0',
  };
  if (contentType) headers['Content-Type'] = contentType;

  const res = await fetch(url, {
    method: op.method.toUpperCase(),
    headers,
    body,
  });

  const text = await res.text();
  return { status: res.status, text, ok: res.ok };
}
