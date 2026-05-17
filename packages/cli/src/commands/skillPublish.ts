/**
 * `oriva skill-publish` — publish a skill manifest from a local skill.yaml.
 *
 * Flow:
 *   1. Load skill.yaml from CWD (or --file=<path>)
 *   2. Validate against JSON schema (fast-fail with field-level errors)
 *   3. POST to /api/v1/skills/manifests with auth headers
 *   4. Print { manifest_id, status, warning? } on success
 *   5. Exit non-zero on validation or API error
 *
 * Auth: uses the same resolveAuth() chain as the rest of the CLI
 * (flag → ORIVA_API_KEY env → ~/.config/oriva/config.json).
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { resolveAuth } from '../auth.js';

// CJS modules — js-yaml and ajv are CJS-only in the versions available.
const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsYaml = _require('js-yaml') as { load(src: string): unknown };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv = _require('ajv') as new (opts?: { allErrors?: boolean }) => {
  validate(schema: unknown, data: unknown): boolean;
  errors: Array<{ dataPath?: string; instancePath?: string; message?: string }> | null;
};
import skillManifestSchema from '../schemas/skillManifest.schema.json' with { type: 'json' };

const DEFAULT_BASE_URL = 'https://api.oriva.io';

export interface SkillPublishRunOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  cwd?: string;
  configPath?: string;
  /** Override fetch implementation (tests). */
  fetchImpl?: typeof fetch;
}

export async function run(opts: SkillPublishRunOptions = {}): Promise<number> {
  const argv = opts.argv ?? [];
  const env = opts.env ?? process.env;
  const stdout = opts.stdout ?? process.stdout;
  const stderr = opts.stderr ?? process.stderr;
  const cwd = opts.cwd ?? process.cwd();

  // Parse minimal flags: --help, --file=<path>, --api-key=<key>, --base-url=<url>, --profile=<name>
  let showHelp = false;
  let filePath: string | undefined;
  let flagApiKey: string | undefined;
  let flagBaseUrl: string | undefined;
  let flagProfile: string | undefined;

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      showHelp = true;
    } else if (arg.startsWith('--file=')) {
      filePath = arg.slice('--file='.length);
    } else if (arg.startsWith('--api-key=')) {
      flagApiKey = arg.slice('--api-key='.length);
    } else if (arg.startsWith('--base-url=')) {
      flagBaseUrl = arg.slice('--base-url='.length);
    } else if (arg.startsWith('--profile=')) {
      flagProfile = arg.slice('--profile='.length);
    }
  }

  if (showHelp) {
    stdout.write(
      [
        'Usage: oriva skill-publish [options]',
        '',
        'Publish a skill manifest from a local skill.yaml file.',
        '',
        'Options:',
        '  --file=<path>      Path to skill.yaml (default: ./skill.yaml)',
        '  --api-key=<key>    Override ORIVA_API_KEY for this invocation',
        '  --base-url=<url>   Override API base URL',
        '  --profile=<name>   Select a config-file profile',
        '  --help             Show this help',
        '',
        'skill.yaml required fields:',
        '  mcp_tool_name        Canonical MCP tool identifier',
        '  version              Semver (e.g. 1.0.0)',
        '  pricing_model        Must be: per-outcome',
        '  revenue_share_bps    Integer 0–10000 (basis points)',
        '  outcome_verifier_type  Must be: stripe_webhook',
        '  outcome_verifier_config  Object (verifier-specific config)',
        '',
      ].join('\n')
    );
    return 0;
  }

  // Load skill.yaml
  const yamlPath = filePath ? resolve(filePath) : resolve(cwd, 'skill.yaml');
  let rawYaml: string;
  try {
    rawYaml = readFileSync(yamlPath, 'utf8');
  } catch (err) {
    stderr.write(`Error: could not read ${yamlPath}: ${(err as Error).message}\n`);
    return 3;
  }

  // Parse YAML
  let manifest: unknown;
  try {
    manifest = jsYaml.load(rawYaml);
  } catch (err) {
    stderr.write(`Error: skill.yaml is not valid YAML: ${(err as Error).message}\n`);
    return 3;
  }

  // Validate against JSON schema
  const ajv = new Ajv({ allErrors: true });
  const valid = ajv.validate(skillManifestSchema, manifest);
  if (!valid) {
    const errors = ajv.errors ?? [];
    stderr.write('Error: skill.yaml validation failed:\n');
    for (const e of errors) {
      const path = e.instancePath || e.dataPath || '';
      const field = path ? `skill.yaml${path}` : 'skill.yaml';
      stderr.write(`  ${field}: ${e.message ?? 'invalid'}\n`);
    }
    return 3;
  }

  // Resolve auth
  const auth = await resolveAuth({
    flagApiKey,
    envApiKey: (env.ORIVA_API_KEY || '').trim() || undefined,
    profile: flagProfile,
    configPath: opts.configPath,
  });

  if (!auth.apiKey) {
    stderr.write(
      '[oriva] WARNING: no API key resolved (--api-key flag → ORIVA_API_KEY → ~/.config/oriva/config.json) — request will likely 401.\n'
    );
  }

  const baseUrl =
    flagBaseUrl || (env.ORIVA_API_BASE_URL || '').trim() || auth.baseUrl || DEFAULT_BASE_URL;
  const url = `${baseUrl}/api/v1/skills/manifests`;

  const fetchFn = opts.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth.apiKey ? { Authorization: `Bearer ${auth.apiKey}` } : {}),
        'User-Agent': 'oriva-cli/0.1.1',
      },
      body: JSON.stringify(manifest),
    });
  } catch (err) {
    stderr.write(`Network error: ${(err as Error).message}\n`);
    return 2;
  }

  let responseText: string;
  try {
    responseText = await response.text();
  } catch (err) {
    stderr.write(`Error reading response: ${(err as Error).message}\n`);
    return 2;
  }

  if (response.status >= 500) {
    stderr.write(`HTTP ${response.status}: ${responseText}\n`);
    return 2;
  }
  if (response.status >= 400) {
    stderr.write(`HTTP ${response.status}: ${responseText}\n`);
    return 1;
  }

  // Success — print manifest_id + status
  let parsed: { manifest_id?: string; status?: string; warning?: string } = {};
  try {
    parsed = JSON.parse(responseText) as typeof parsed;
  } catch {
    // Non-JSON success — print raw
    stdout.write(responseText);
    stdout.write('\n');
    return 0;
  }

  stdout.write(JSON.stringify(parsed, null, 2));
  stdout.write('\n');

  if (parsed.warning) {
    stderr.write(`Warning: ${parsed.warning}\n`);
  }

  return 0;
}
