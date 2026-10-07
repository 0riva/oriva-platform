/**
 * Agent commerce — an owner's AI agent buys and lists in the Oriva marketplace.
 *
 * These three operations are served by the Oriva web app at https://oriva.io
 * (o-core), NOT by the public API host api.oriva.io. The OpenAPI spec marks
 * them with an operation-level `servers` entry, but the generated client
 * ignores per-operation servers, so these wrappers supply the right base URL.
 *
 * `buyListing` spends the API key owner's real money, within the limits the
 * owner set at https://oriva.io/settings/agent-buying. It always sends an
 * `Idempotency-Key`: the caller's, or a fresh one generated here. The key used
 * is returned as `idempotencyKey` so the caller can retry the SAME purchase
 * without buying twice.
 */
import * as sdk from './generated/sdk.gen.js';
import type { Options } from './generated/sdk.gen.js';
import type {
  BuyListingData,
  CreateListingData,
  ListAgentPurchasesData,
} from './generated/types.gen.js';

export const DEFAULT_APP_BASE_URL = 'https://oriva.io';

/** Header the purchase route reads to recognise a retry of the same attempt. */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/** A fresh idempotency key (UUID v4). Not a secret — only needs to be unique. */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback for runtimes without Web Crypto (Node 18 without the global).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function defaultAppBaseUrl(): string {
  const env = typeof process !== 'undefined' ? process.env?.ORIVA_APP_BASE_URL?.trim() : undefined;
  return env || DEFAULT_APP_BASE_URL;
}

function readIdempotencyKey(headers: unknown): string | undefined {
  if (!headers) return undefined;
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return headers.get(IDEMPOTENCY_HEADER) ?? undefined;
  }
  if (typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      if (k.toLowerCase() === IDEMPOTENCY_HEADER.toLowerCase() && typeof v === 'string' && v) {
        return v;
      }
    }
  }
  return undefined;
}

/**
 * Build the three agent operations bound to an app base URL.
 * `createOrivaClient` calls this; use it directly with the raw client.
 */
export function makeAgentOperations(appBaseUrl: string = defaultAppBaseUrl()) {
  return {
    /**
     * Buy a marketplace listing with the owner's money, within their limits.
     * 201 bought · 200 repeat of an earlier key · 202 not finished (do not buy
     * again; check listAgentPurchases) · 403 refused, final · 402 not charged.
     */
    async buyListing<ThrowOnError extends boolean = false>(
      options: Options<BuyListingData, ThrowOnError>
    ) {
      const idempotencyKey = readIdempotencyKey(options.headers) ?? newIdempotencyKey();
      const result = await sdk.buyListing<ThrowOnError>({
        ...options,
        baseUrl: options.baseUrl ?? appBaseUrl,
        headers: {
          ...(options.headers as Record<string, string> | undefined),
          [IDEMPOTENCY_HEADER]: idempotencyKey,
        },
      });
      return Object.assign(result, { idempotencyKey });
    },

    /** List an item for sale in the owner's name (agent listing must be switched on). */
    createListing<ThrowOnError extends boolean = false>(
      options: Options<CreateListingData, ThrowOnError>
    ) {
      return sdk.createListing<ThrowOnError>({
        ...options,
        baseUrl: options.baseUrl ?? appBaseUrl,
      });
    },

    /** The owner's 50 most recent agent purchases, refused ones included. */
    listAgentPurchases<ThrowOnError extends boolean = false>(
      options?: Options<ListAgentPurchasesData, ThrowOnError>
    ) {
      return sdk.listAgentPurchases<ThrowOnError>({
        ...options,
        baseUrl: options?.baseUrl ?? appBaseUrl,
      });
    },
  };
}

export type AgentOperations = ReturnType<typeof makeAgentOperations>;
