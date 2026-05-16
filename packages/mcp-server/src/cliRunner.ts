/**
 * Subprocess shim around the `oriva` CLI.
 *
 * Each MCP tool invocation becomes a `child_process.spawn('oriva', [op, ...flags, '--json'])`
 * call. The CLI emits its agent envelope on stdout:
 *
 *   { ok, status, data, error, request_id?, url?, method? }
 *
 * We parse that envelope back into the {status, text, ok} shape that the MCP
 * dispatcher in index.ts already consumes. The text field is the JSON-stringified
 * `data` (success) or `error` (failure) payload, matching the prior SDK-based
 * behaviour byte-for-byte from the MCP client's perspective.
 *
 * Why subprocess instead of in-process import:
 *   - Decouples mcp-server's release cadence from CLI internals
 *   - Pins the CLI version via package.json so upgrades are deliberate
 *   - Matches how external agents call the CLI in tight loops
 *   - Eliminates @oriva/sdk as a transitive dep here (CLI carries it)
 *
 * Resolving the binary:
 *   `createRequire(import.meta.url).resolve('@oriva/cli/bin/oriva.js')` walks
 *   the consumer's node_modules tree the same way Node would for `import`,
 *   so it works in hoisted (npm/yarn workspaces), nested (pnpm), and
 *   global-install topologies.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Cached absolute path to the @oriva/cli bin entry. */
let cachedCliPath: string | undefined;

export function resolveCliBin(): string {
  if (cachedCliPath) return cachedCliPath;
  try {
    cachedCliPath = require.resolve('@oriva/cli/bin/oriva.js');
    return cachedCliPath;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not resolve @oriva/cli/bin/oriva.js — is @oriva/cli installed? (${message})`
    );
  }
}

export interface CliEnvelope {
  ok: boolean;
  status: number;
  data: unknown;
  error: unknown;
  request_id?: string;
  url?: string;
  method?: string;
}

export interface CliRunOptions {
  apiKey: string;
  baseUrl?: string;
  /** Override the CLI binary path (tests). */
  binPath?: string;
  /** Inject a spawn implementation (tests). */
  spawnImpl?: typeof spawn;
}

export interface CliCallArgs {
  /** OpenAPI operationId — also the CLI command name. */
  toolName: string;
  /** Path-parameter names + values (sent as `--<name>=<value>`). */
  pathParams: Record<string, unknown>;
  /** Query-parameter names + values (sent as `--<name>=<value>`). */
  queryParams: Record<string, unknown>;
  /** JSON body object, or undefined for no body. Piped via stdin as `--body=-`. */
  body?: Record<string, unknown>;
}

export interface CliRunResult {
  /** HTTP status from the envelope (0 if network error). */
  status: number;
  /** ok = 2xx. */
  ok: boolean;
  /** JSON-stringified data (success) or error (failure). Empty string for null. */
  text: string;
  /** Raw envelope for callers that need request_id / url / method. */
  envelope: CliEnvelope;
}

/**
 * Render a single CLI flag. Skips undefined; serializes objects to JSON.
 * Arrays become repeated `--key=v1 --key=v2` flags (the CLI parses repeated
 * flags into arrays via parseArgs.ts).
 */
function appendFlag(args: string[], key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    for (const item of value) appendFlag(args, key, item);
    return;
  }
  const serialized =
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : JSON.stringify(value);
  args.push(`--${key}=${serialized}`);
}

export async function runCli(call: CliCallArgs, options: CliRunOptions): Promise<CliRunResult> {
  const binPath = options.binPath ?? resolveCliBin();
  const spawnFn = options.spawnImpl ?? spawn;

  const args: string[] = [call.toolName, '--json', `--api-key=${options.apiKey}`];
  if (options.baseUrl) args.push(`--base-url=${options.baseUrl}`);

  for (const [k, v] of Object.entries(call.pathParams)) appendFlag(args, k, v);
  for (const [k, v] of Object.entries(call.queryParams)) appendFlag(args, k, v);

  const hasBody = call.body !== undefined && Object.keys(call.body).length > 0;
  if (hasBody) args.push('--body=-');

  return new Promise<CliRunResult>((resolve, reject) => {
    // Inherit env so the CLI sees ORIVA_API_BASE_URL and similar overrides
    // without us having to enumerate them. The API key is passed via flag
    // (highest precedence in the CLI's auth chain).
    const child = spawnFn(binPath, args, {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn oriva CLI: ${err.message}`));
    });

    child.on('close', (code: number | null) => {
      // Exit code semantics from the CLI:
      //   0  2xx, 1  4xx, 2  5xx or network, 3  usage/parse, 4  spec load failure
      // For 3 and 4 (CLI-level errors before the request runs), there's no JSON
      // envelope on stdout — surface stderr text as the error.
      if (code === 3 || code === 4) {
        reject(
          new Error(
            `oriva CLI rejected request (exit ${code}): ${stderr.trim() || 'no error message'}`
          )
        );
        return;
      }

      const trimmed = stdout.trim();
      if (!trimmed) {
        reject(
          new Error(
            `oriva CLI returned empty stdout (exit ${code}); stderr: ${stderr.trim() || '<empty>'}`
          )
        );
        return;
      }

      let envelope: CliEnvelope;
      try {
        envelope = JSON.parse(trimmed) as CliEnvelope;
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        reject(
          new Error(`Failed to parse oriva CLI envelope: ${msg}; stdout=${trimmed.slice(0, 200)}`)
        );
        return;
      }

      // Reduce envelope payload to a string matching the prior client.ts contract:
      // success -> JSON.stringify(data); failure -> JSON.stringify(error); null -> ''.
      const payload = envelope.ok ? envelope.data : envelope.error;
      const text =
        payload === null || payload === undefined
          ? ''
          : typeof payload === 'string'
            ? payload
            : JSON.stringify(payload);

      resolve({
        status: envelope.status,
        ok: envelope.ok,
        text,
        envelope,
      });
    });

    if (hasBody) {
      child.stdin?.write(JSON.stringify(call.body));
      child.stdin?.end();
    } else {
      child.stdin?.end();
    }
  });
}
