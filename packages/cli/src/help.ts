/**
 * Help text rendering for the `oriva` CLI.
 *
 * Ported from ultra-cli (~/ultra-network/packages/ultra-cli/src/help.ts);
 * key deviation: group commands by OpenAPI `tags[0]` instead of path segment.
 * The Oriva spec has 13 clean tags (Auth/Profiles/Groups/Entries/…) that map
 * cleaner than path roots (which all start with `/api/v1/...`).
 */

import type { ExtractedOperation } from './shared/types.js';

const HEADER = `oriva — Oriva public API CLI

A spec-driven wrapper over every operation in the @oriva/sdk surface. Every
endpoint becomes a subcommand. Use \`oriva <command> --help\` for per-command
flags. Command names match @oriva/sdk function names 1:1.

ENVIRONMENT
  ORIVA_API_KEY        Bearer key (oriva_pk_live_… / oriva_pk_test_…)
  ORIVA_API_SPEC       OpenAPI source (default: bundled snapshot)
  ORIVA_API_BASE_URL   Override server base URL (default: https://api.oriva.io)
  ORIVA_API_TAGS       CSV tag filter for which operations are exposed

CONFIG FILE
  ~/.config/oriva/config.json  Multi-profile auth — see README

GLOBAL FLAGS
  --api-key=<key>      Override ORIVA_API_KEY for this invocation
  --profile=<name>     Select a config-file profile (default: activeProfile)
  --spec=<url|path>    Override the spec source for this invocation
  --base-url=<url>     Override the base URL for this invocation
  --show-status        Print HTTP status + request_id to stderr
  --raw                Print response body unchanged (no JSON pretty-print)
  --json               Emit { ok, status, data, error, request_id } envelope
  --quiet              Suppress progress lines on stderr
  --help, -h           Show this help (or per-command help)
  --version, -V        Print CLI + spec version
`;

export function renderTopLevelHelp(operations: ExtractedOperation[]): string {
  const out: string[] = [HEADER, 'COMMANDS'];
  if (operations.length === 0) {
    out.push('  (no operations available — check ORIVA_API_SPEC)');
    return out.join('\n');
  }

  // Group by first OpenAPI tag; ops without tags go to 'misc'.
  const groups = new Map<string, ExtractedOperation[]>();
  for (const op of operations) {
    const group = op.tags?.[0] || 'misc';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(op);
  }

  const nameWidth = Math.min(40, Math.max(...operations.map((o) => o.name.length)));

  for (const [group, ops] of [...groups.entries()].sort()) {
    out.push('');
    out.push(`  ${group}`);
    for (const op of ops.sort((a, b) => a.name.localeCompare(b.name))) {
      const padded = op.name.padEnd(nameWidth);
      out.push(`    ${padded}  ${op.description}`);
    }
  }
  out.push('');
  out.push('Run `oriva <command> --help` for input details.');
  return out.join('\n');
}

export function renderCommandHelp(op: ExtractedOperation): string {
  const out: string[] = [];
  out.push(`oriva ${op.name}`);
  out.push('');
  out.push(`  ${op.description}`);
  out.push(`  ${op.method.toUpperCase()} ${op.pathTemplate}`);
  if (op.tags?.length) {
    out.push(`  tags: ${op.tags.join(', ')}`);
  }
  out.push('');

  const schema = op.inputSchema as {
    properties?: Record<string, { description?: string; type?: string; enum?: unknown[] }>;
    required?: string[];
  };
  const required = new Set(schema.required ?? []);
  const props = schema.properties ?? {};

  if (op.pathParams.length) {
    out.push('PATH PARAMETERS (required)');
    for (const name of op.pathParams) {
      out.push(formatParam(name, props[name], required.has(name)));
    }
    out.push('');
  }
  if (op.queryParams.length) {
    out.push('QUERY PARAMETERS');
    for (const name of op.queryParams) {
      out.push(formatParam(name, props[name], required.has(name)));
    }
    out.push('');
  }
  if (op.hasBody) {
    out.push('REQUEST BODY');
    out.push(`  --body=<json> | --body=@path/to/file.json | --body=-  (stdin)`);
    out.push(`  Content-Type: ${op.bodyContentType || 'application/json'}`);
    if (required.has('body')) out.push('  (required)');
    out.push('');
  }

  out.push('EXAMPLE');
  out.push(formatExample(op));
  return out.join('\n');
}

function formatParam(
  name: string,
  schema: { description?: string; type?: string; enum?: unknown[] } | undefined,
  isRequired: boolean
): string {
  const tag = isRequired ? ' (required)' : '';
  const type = schema?.type ? ` <${schema.type}>` : '';
  const desc = schema?.description ? `  — ${schema.description}` : '';
  const enumVals = schema?.enum?.length ? `  [${schema.enum.join('|')}]` : '';
  return `  --${name}${type}${tag}${enumVals}${desc}`;
}

function formatExample(op: ExtractedOperation): string {
  const parts: string[] = ['  oriva', op.name];
  for (const p of op.pathParams) parts.push(`--${p}=<${p}>`);
  for (const q of op.queryParams.slice(0, 2)) parts.push(`--${q}=<value>`);
  if (op.hasBody) parts.push(`--body='{"…":"…"}'`);
  return parts.join(' ');
}

export function renderVersion(cliVersion: string, specVersion: string | undefined): string {
  return `oriva ${cliVersion}\nspec  ${specVersion ?? '(unknown)'}`;
}
