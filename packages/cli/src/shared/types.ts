/**
 * Internal shape for an operation extracted from OpenAPI.
 *
 * Ported from ultra-api-client (~/ultra-network/packages/ultra-api-client/src/types.ts).
 * Adds `tags: string[]` so the CLI can group commands by OpenAPI tag rather than
 * by path segment.
 */
export interface ExtractedOperation {
  /** Tool/command name surfaced to the consumer. Matches SDK function names 1:1 (camelCase). */
  name: string;
  /** Human-readable summary. */
  description: string;
  /** HTTP method. */
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** Path template with `{param}` placeholders. */
  pathTemplate: string;
  /** Combined JSON Schema for the operation's input. */
  inputSchema: Record<string, unknown>;
  /** Param-name buckets so the executor knows where each input goes. */
  pathParams: string[];
  queryParams: string[];
  /**
   * Header parameters. `arg` is the input/flag name (camelCase of the header,
   * e.g. `Idempotency-Key` → `idempotencyKey`); `name` is the header sent.
   */
  headerParams?: Array<{ name: string; arg: string }>;
  /**
   * Operation-level `servers` URLs. When present the operation is served by a
   * different host than the document's default (e.g. agent commerce on
   * https://oriva.io), and the executor sends it there.
   */
  servers?: string[];
  hasBody: boolean;
  bodyContentType?: string;
  /** OpenAPI tags. First tag drives help-grouping. */
  tags: string[];
}

export interface ServerConfig {
  spec: string;
  baseUrl?: string;
  apiKey?: string;
  tagFilter?: string[];
}
