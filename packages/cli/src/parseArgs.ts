/**
 * Argv parser for the `oriva` CLI.
 *
 * Ported from ultra-cli (~/ultra-network/packages/ultra-cli/src/parseArgs.ts).
 * Adds three new global flags: --json, --profile, --api-key.
 *
 * Grammar:
 *   oriva                                     → { kind: 'help' }
 *   oriva --help | -h                         → { kind: 'help' }
 *   oriva --version | -V                      → { kind: 'version' }
 *   oriva <command>                           → { kind: 'command', command, flags }
 *   oriva <command> --help                    → { kind: 'command-help', command }
 *   oriva <command> --flag=value …            → flags['flag'] = 'value'
 *   oriva <command> --flag value …            → flags['flag'] = 'value'
 *   oriva <command> --flag …                  → flags['flag'] = true (boolean)
 *   oriva <command> --body=@path | -          → bodySource = { kind:'file', path } / { kind:'stdin' }
 *   oriva <command> --body=<json>             → bodySource = { kind:'inline', text }
 *   oriva <command> --repeated=a --repeated=b → flags['repeated'] = ['a','b']
 *
 * Global flags (apply before OR after the command — forgiving UX):
 *   --spec=<url|path>     Override OpenAPI spec source
 *   --base-url=<url>      Override server base URL
 *   --show-status         Print HTTP status to stderr alongside body
 *   --raw                 Print response body unchanged (no JSON pretty-print)
 *   --json                Emit envelope { ok, status, data, error, request_id }
 *   --quiet               Suppress progress lines on stderr
 *   --profile=<name>      Select a config-file profile
 *   --api-key=<key>       Override ORIVA_API_KEY for this invocation
 */

export interface ParsedArgs {
  kind: 'help' | 'command-help' | 'command' | 'version';
  command?: string;
  flags: Record<string, string | string[] | boolean>;
  bodySource?:
    | { kind: 'inline'; text: string }
    | { kind: 'file'; path: string }
    | { kind: 'stdin' };
  global: {
    spec?: string;
    baseUrl?: string;
    showStatus?: boolean;
    raw?: boolean;
    json?: boolean;
    quiet?: boolean;
    profile?: string;
    apiKey?: string;
  };
}

const GLOBAL_FLAGS = new Set([
  'spec',
  'base-url',
  'show-status',
  'raw',
  'json',
  'quiet',
  'profile',
  'api-key',
]);

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | string[] | boolean> = {};
  const global: ParsedArgs['global'] = {};
  let command: string | undefined;
  let bodySource: ParsedArgs['bodySource'];
  let wantsHelp = false;
  let wantsVersion = false;

  const tokens = [...argv];

  // Phase 1: peel off global flags + locate the command.
  const remaining: string[] = [];
  while (tokens.length) {
    const t = tokens.shift()!;
    if (t === '--help' || t === '-h') {
      wantsHelp = true;
      continue;
    }
    if (t === '--version' || t === '-V') {
      wantsVersion = true;
      continue;
    }
    const m = /^--([^=]+)(?:=(.*))?$/.exec(t);
    if (m && GLOBAL_FLAGS.has(m[1])) {
      const key = m[1];
      // For boolean-style globals, allow `--status` (no value) → true.
      // For value-style globals, consume the next token if not flag-shaped.
      const isBooleanGlobal = ['show-status', 'raw', 'json', 'quiet'].includes(key);
      let value: string;
      if (m[2] !== undefined) {
        value = m[2];
      } else if (!isBooleanGlobal && tokens[0] !== undefined && !tokens[0].startsWith('--')) {
        value = tokens.shift()!;
      } else {
        value = 'true';
      }
      if (key === 'spec') global.spec = value;
      else if (key === 'base-url') global.baseUrl = value;
      else if (key === 'show-status') global.showStatus = value === 'true' || value === '';
      else if (key === 'raw') global.raw = value === 'true' || value === '';
      else if (key === 'json') global.json = value === 'true' || value === '';
      else if (key === 'quiet') global.quiet = value === 'true' || value === '';
      else if (key === 'profile') global.profile = value;
      else if (key === 'api-key') global.apiKey = value;
      continue;
    }
    if (!command && !t.startsWith('-')) {
      command = t;
      continue;
    }
    remaining.push(t);
  }

  if (wantsVersion) return { kind: 'version', flags, global };
  if (!command) return { kind: 'help', flags, global };
  if (wantsHelp) return { kind: 'command-help', command, flags, global };

  // Phase 2: parse per-command flags from `remaining`.
  while (remaining.length) {
    const t = remaining.shift()!;
    const m = /^--([^=]+)(?:=(.*))?$/.exec(t);
    if (!m) {
      throw new Error(`Unexpected positional argument: ${t}`);
    }
    const key = m[1];
    let value: string | undefined = m[2];
    if (value === undefined) {
      if (remaining[0] !== undefined && !remaining[0].startsWith('--')) {
        value = remaining.shift();
      }
    }

    if (key === 'body') {
      if (value === undefined) throw new Error('--body requires a value');
      if (value === '-') bodySource = { kind: 'stdin' };
      else if (value.startsWith('@')) bodySource = { kind: 'file', path: value.slice(1) };
      else bodySource = { kind: 'inline', text: value };
      continue;
    }

    if (value === undefined) {
      flags[key] = true;
      continue;
    }
    const existing = flags[key];
    if (existing === undefined) {
      flags[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else if (typeof existing === 'string') {
      flags[key] = [existing, value];
    } else {
      flags[key] = value;
    }
  }

  return { kind: 'command', command, flags, bodySource, global };
}
