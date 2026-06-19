/**
 * Guard: no retired Claude model id may be pinned anywhere in source.
 *
 * Retired ids return HTTP 404 not_found from the Anthropic API, silently
 * breaking every feature that calls them (e.g. the Hugo public API). This test
 * fails if a known-retired id reappears, so the next model retirement is caught
 * in CI rather than in production.
 *
 * When Anthropic retires a model, add its id here and bump the call sites.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// Verified retired 2026-06-19 against the live Anthropic API (404 not_found):
const RETIRED_MODEL_IDS = [
  'claude-sonnet-4-20250514',
  'claude-haiku-4-20250514',
  'claude-3-haiku-20240307',
];

const ROOT = process.cwd(); // jest rootDir = repo root
const SCAN_DIRS = ['api', 'lib', 'src'];
const SKIP_DIR = new Set(['node_modules', 'dist', 'coverage', '.worktrees', '.next', 'build']);
const EXT = /\.(ts|tsx|js)$/;

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(full);
  }
}

describe('no retired Claude model ids in source', () => {
  const files: string[] = [];
  for (const d of SCAN_DIRS) walk(join(ROOT, d), files);

  it.each(RETIRED_MODEL_IDS)('no source file pins retired model %s', (id) => {
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes(id));
    expect(offenders.map((f) => f.replace(ROOT + '/', ''))).toEqual([]);
  });
});
