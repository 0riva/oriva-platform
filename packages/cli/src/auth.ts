/**
 * API-key resolution for the `oriva` CLI.
 *
 * Precedence (highest wins):
 *   1. --api-key=<key>                          (flag)
 *   2. ORIVA_API_KEY env var
 *   3. ~/.config/oriva/config.json
 *      - if --profile=<name> set: profiles[<name>].apiKey
 *      - else: profiles[activeProfile].apiKey
 *      - else: profiles.default.apiKey
 *   4. undefined (caller decides whether to warn)
 *
 * Config-file schema:
 *   {
 *     "activeProfile": "staging",
 *     "profiles": {
 *       "default": { "apiKey": "oriva_pk_live_..." },
 *       "staging": { "apiKey": "oriva_pk_test_...", "baseUrl": "https://staging.api.oriva.io" }
 *     }
 *   }
 *
 * `baseUrl` can also live on a profile and is returned alongside the key.
 */
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

export interface ResolvedAuth {
  apiKey?: string;
  baseUrl?: string;
  /** Provenance for diagnostics — "flag" | "env" | "config:<profile>" | "none". */
  source: string;
}

export interface ConfigProfile {
  apiKey?: string;
  baseUrl?: string;
}

export interface ConfigFile {
  activeProfile?: string;
  profiles?: Record<string, ConfigProfile>;
}

export interface ResolveAuthOptions {
  flagApiKey?: string;
  envApiKey?: string;
  profile?: string;
  /** Custom config path for tests. Defaults to ~/.config/oriva/config.json. */
  configPath?: string;
}

export async function resolveAuth(opts: ResolveAuthOptions): Promise<ResolvedAuth> {
  if (opts.flagApiKey) return { apiKey: opts.flagApiKey, source: 'flag' };
  if (opts.envApiKey) return { apiKey: opts.envApiKey, source: 'env' };

  const cfgPath = opts.configPath ?? resolve(homedir(), '.config', 'oriva', 'config.json');
  let cfg: ConfigFile | undefined;
  try {
    const text = await readFile(cfgPath, 'utf8');
    cfg = JSON.parse(text) as ConfigFile;
  } catch {
    // No config file or unreadable — fall through to "none".
    return { source: 'none' };
  }

  const profiles = cfg.profiles ?? {};
  const want = opts.profile ?? cfg.activeProfile ?? 'default';
  const picked = profiles[want] ?? profiles.default;
  if (picked?.apiKey) {
    return { apiKey: picked.apiKey, baseUrl: picked.baseUrl, source: `config:${want}` };
  }
  return { source: 'none' };
}
