/**
 * @oriva/sdk — typed TypeScript SDK for the Oriva public API.
 *
 * Two ways to use:
 *
 *   1. Ergonomic factory (recommended for app code):
 *      const oriva = createOrivaClient({ apiKey: 'oriva_pk_...' });
 *      const me = await oriva.getCurrentUser();
 *
 *   2. Raw generated SDK (for library code / MCP server / advanced use):
 *      import { client, getCurrentUser } from '@oriva/sdk/generated';
 *      client.setConfig({ baseUrl, headers: { Authorization: '...' } });
 *      const me = await getCurrentUser();
 */

import { client } from './generated/client.gen.js';
import * as sdk from './generated/sdk.gen.js';

export * from './generated/types.gen.js';
export { client as rawClient };
export { sdk as rawSdk };

const DEFAULT_BASE_URL = 'https://api.oriva.io';
const USER_AGENT = '@oriva/sdk/0.1.0';

export interface OrivaClientOptions {
  /**
   * Personal API key from https://api.oriva.io/developer
   * Format: `oriva_pk_live_...` or `oriva_pk_test_...`
   */
  apiKey: string;
  /**
   * Override the API base URL. Defaults to `https://api.oriva.io`.
   * Useful for staging / local dev (e.g. `http://localhost:3000`).
   */
  baseUrl?: string;
  /**
   * Optional custom User-Agent. Defaults to `@oriva/sdk/<version>`.
   */
  userAgent?: string;
}

export type OrivaClient = typeof sdk;

/**
 * Create a configured Oriva API client. Wires authentication, base URL, and User-Agent
 * once, then returns every typed SDK operation pre-bound.
 *
 * @example
 * const oriva = createOrivaClient({ apiKey: process.env.ORIVA_API_KEY! });
 * const me = await oriva.getCurrentUser();
 * const profiles = await oriva.listProfiles({ query: { limit: 10 } });
 */
export function createOrivaClient(options: OrivaClientOptions): OrivaClient {
  client.setConfig({
    baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'User-Agent': options.userAgent ?? USER_AGENT,
    },
  });
  return sdk;
}
