/**
 * `oriva` CLI entry point.
 *
 * Boot sequence:
 *   1. parseArgs(process.argv.slice(2))
 *   2. resolveAuth (flag → env → config-file)
 *   3. Load OpenAPI spec (--spec / ORIVA_API_SPEC / bundled snapshot)
 *   4. Extract operations
 *   5. Dispatch:
 *      - help → top-level help
 *      - command-help → per-command help
 *      - version → CLI + spec version
 *      - command → coerce flags, read body, executeOperation, print result
 *
 * Exit codes:
 *   0  2xx response (or help/version)
 *   1  4xx response
 *   2  5xx response or network failure
 *   3  usage/parse error (bad flags, unknown command, missing required input)
 *   4  spec load failure
 *
 * Ported from ultra-cli (~/ultra-network/packages/ultra-cli/src/cli.ts).
 * Adds: --json envelope output, --profile + --api-key, config-file auth,
 * bundled-snapshot default spec source.
 */
import { loadSpec, bundledSnapshotPath, type MinimalOpenApiDoc } from './shared/loadSpec.js';
import { extractOperations } from './shared/toolGenerator.js';
import { executeOperation } from './shared/httpExecutor.js';
import type { ExtractedOperation } from './shared/types.js';
import { parseArgs, type ParsedArgs } from './parseArgs.js';
import { renderTopLevelHelp, renderCommandHelp, renderVersion } from './help.js';
import { coerceArgs } from './coerce.js';
import { readBody } from './readBody.js';
import { resolveAuth } from './auth.js';
import { renderOutput, renderEnvelope } from './output.js';

const CLI_VERSION = '0.1.0';
const DEFAULT_BASE_URL = 'https://api.oriva.io';

export interface RunDeps {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  fetchImpl?: typeof fetch;
  /** Inject a spec for tests; skips loadSpec. */
  specOverride?: MinimalOpenApiDoc;
  /** Override the config-file path for tests. */
  configPath?: string;
}

export async function run(deps: RunDeps = {}): Promise<number> {
  const argv = deps.argv ?? process.argv.slice(2);
  const env = deps.env ?? process.env;
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  const stdin = deps.stdin ?? process.stdin;

  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    stderr.write(`Error: ${(err as Error).message}\n`);
    return 3;
  }

  // Spec source precedence: --spec > ORIVA_API_SPEC > bundled snapshot.
  const specSource =
    parsed.global.spec || (env.ORIVA_API_SPEC || '').trim() || bundledSnapshotPath();

  const tagFilter = (env.ORIVA_API_TAGS || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  let doc: MinimalOpenApiDoc;
  try {
    doc = deps.specOverride ?? (await loadSpec(specSource));
  } catch (err) {
    stderr.write(`Failed to load OpenAPI spec from ${specSource}: ${(err as Error).message}\n`);
    return 4;
  }

  const operations = extractOperations(doc, { tagFilter });
  const opsByName = new Map(operations.map((o) => [o.name, o]));

  if (parsed.kind === 'help') {
    stdout.write(renderTopLevelHelp(operations));
    stdout.write('\n');
    return 0;
  }
  if (parsed.kind === 'version') {
    stdout.write(renderVersion(CLI_VERSION, doc.info?.version));
    stdout.write('\n');
    return 0;
  }
  if (parsed.kind === 'command-help') {
    const op = opsByName.get(parsed.command!);
    if (!op) return unknownCommand(parsed.command!, operations, stderr);
    stdout.write(renderCommandHelp(op));
    stdout.write('\n');
    return 0;
  }

  // kind === 'command'
  const op = opsByName.get(parsed.command!);
  if (!op) return unknownCommand(parsed.command!, operations, stderr);

  // Resolve auth: flag > env > config-file.
  const auth = await resolveAuth({
    flagApiKey: parsed.global.apiKey,
    envApiKey: (env.ORIVA_API_KEY || '').trim() || undefined,
    profile: parsed.global.profile,
    configPath: deps.configPath,
  });

  if (!auth.apiKey && !parsed.global.quiet) {
    stderr.write(
      '[oriva] WARNING: no API key resolved (flag → ORIVA_API_KEY → ~/.config/oriva/config.json) — call will likely 401.\n'
    );
  }

  let args: Record<string, unknown>;
  try {
    args = coerceArgs(parsed.flags, op.inputSchema);
  } catch (err) {
    stderr.write(`Argument error: ${(err as Error).message}\n`);
    return 3;
  }
  try {
    const body = await readBody(parsed.bodySource, stdin);
    if (body !== undefined) args.body = body;
  } catch (err) {
    stderr.write(`Body error: ${(err as Error).message}\n`);
    return 3;
  }
  if (op.hasBody && args.body === undefined && requiresBody(op)) {
    stderr.write(`This command requires --body=<json|@file|->. Run \`oriva ${op.name} --help\`.\n`);
    return 3;
  }

  const baseUrl =
    parsed.global.baseUrl ||
    (env.ORIVA_API_BASE_URL || '').trim() ||
    auth.baseUrl ||
    doc.servers?.[0]?.url ||
    DEFAULT_BASE_URL;

  let result: Awaited<ReturnType<typeof executeOperation>>;
  try {
    result = await executeOperation(
      op,
      args,
      { baseUrl, apiKey: auth.apiKey, userAgent: `oriva-cli/${CLI_VERSION}` },
      deps.fetchImpl
    );
  } catch (err) {
    if (parsed.global.json) {
      // Emit envelope-shaped error so agents can parse network failures uniformly.
      const envelope = {
        ok: false,
        status: 0,
        data: null,
        error: { message: (err as Error).message, kind: 'network' },
        request_id: undefined,
      };
      stdout.write(JSON.stringify(envelope, null, 2));
      stdout.write('\n');
    } else {
      stderr.write(`Network error: ${(err as Error).message}\n`);
    }
    return 2;
  }

  if (parsed.global.showStatus && !parsed.global.quiet) {
    stderr.write(
      `HTTP ${result.status}${result.request_id ? ` (request_id=${result.request_id})` : ''}\n`
    );
  }

  stdout.write(renderOutput(result, { raw: parsed.global.raw, json: parsed.global.json }));
  stdout.write('\n');

  if (result.status >= 500) return 2;
  if (result.status >= 400) return 1;
  return 0;
}

function unknownCommand(
  name: string,
  operations: ExtractedOperation[],
  stderr: NodeJS.WritableStream
): number {
  stderr.write(`Unknown command: ${name}\n`);
  const suggestions = operations
    .map((o) => o.name)
    .filter((n) =>
      n
        .toLowerCase()
        .startsWith(name.toLowerCase().slice(0, Math.max(3, Math.floor(name.length / 2))))
    )
    .slice(0, 5);
  if (suggestions.length) {
    stderr.write(`Did you mean: ${suggestions.join(', ')}?\n`);
  }
  stderr.write('Run `oriva --help` to list commands.\n');
  return 3;
}

function requiresBody(op: ExtractedOperation): boolean {
  const required = (op.inputSchema as { required?: string[] }).required ?? [];
  return required.includes('body');
}

// Re-export for tests + bin shim.
export { renderEnvelope };
