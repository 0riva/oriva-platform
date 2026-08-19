#!/usr/bin/env node
/**
 * Guard: workspace versions, internal ranges, and the lockfile must agree.
 *
 * WHY THIS EXISTS (2026-08-15, issue #64)
 * ---------------------------------------
 * `npm ci` refused to run on `main` with:
 *
 *   Missing: @oriva/cli@0.1.1 from lock file
 *   Missing: @oriva/sdk@0.2.0 from lock file
 *
 * The cause was a single stale range. `packages/mcp-server` depended on
 * `@oriva/cli: ^0.1.0` while the workspace had been bumped to 0.2.2. `^0.1.0`
 * means `>=0.1.0 <0.2.0`, so npm could not satisfy it from the local workspace,
 * fell back to the REGISTRY copy of @oriva/cli@0.1.1, and that published version
 * pulled @oriva/sdk@0.2.0 — neither of which the lockfile knew about.
 *
 * The damage is quiet and compounding: workspaces silently stop linking and you
 * build against published copies of your own packages instead of your source,
 * while `npm ci` — and therefore all of CI — cannot install at all.
 *
 * This checks two invariants that would each have caught it on the commit that
 * introduced it:
 *
 *   1. Every internal dependency range is satisfiable by the CURRENT local
 *      version of that workspace package.
 *   2. The lockfile records the same version for each workspace package as that
 *      package's own package.json.
 *
 * Run: node scripts/check-workspace-versions.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import semver from 'semver';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Deliberately not fs.globSync — that is Node 22+, and CI runs Node 18 and 20.
const pkgPaths = readdirSync('packages', { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => path.join('packages', e.name, 'package.json'))
  .filter((p) => existsSync(p));
if (pkgPaths.length === 0) {
  console.error('✖ [workspace-versions] found no packages/*/package.json — is the glob still right?');
  process.exit(1);
}

/** name -> { version, dir } for every workspace package. */
const workspaces = new Map();
for (const p of pkgPaths) {
  const d = read(p);
  if (!d.name || !d.version) {
    console.error(`✖ [workspace-versions] ${p} is missing a name or version`);
    process.exit(1);
  }
  workspaces.set(d.name, { version: d.version, dir: path.dirname(p) });
}

const problems = [];

// ---- Invariant 1: internal ranges must be satisfiable locally -------------
for (const p of pkgPaths) {
  const d = read(p);
  // peerDependencies matter as much as the rest: @oriva/cli declares @oriva/sdk
  // as a peer, so an sdk bump can strand that range without touching any
  // `dependencies` block. Checking only deps+devDeps would miss it entirely.
  const deps = {
    ...(d.dependencies ?? {}),
    ...(d.devDependencies ?? {}),
    ...(d.peerDependencies ?? {}),
    ...(d.optionalDependencies ?? {}),
  };
  for (const [dep, range] of Object.entries(deps)) {
    const target = workspaces.get(dep);
    if (!target) continue; // external dependency, not our concern here
    if (!semver.satisfies(target.version, range, { includePrerelease: true })) {
      problems.push(
        `${d.name} requires ${dep} "${range}", but the workspace ${dep} is ${target.version}.\n` +
          `      npm cannot link it locally and will fall back to the registry copy.`
      );
    }
  }
}

// ---- Invariant 2: the lockfile must record current workspace versions -----
const lockPath = 'package-lock.json';
if (!existsSync(lockPath)) {
  problems.push('package-lock.json is absent, but CI installs with `npm ci`.');
} else {
  const lock = read(lockPath);
  for (const [name, { version, dir }] of workspaces) {
    // npm records a workspace twice: as a link at node_modules/<name>, and by
    // its directory path. The directory entry is the one carrying the version.
    const entry = lock.packages?.[dir];
    if (!entry) {
      problems.push(`the lockfile has no entry for ${name} at "${dir}".`);
      continue;
    }
    if (entry.version !== version) {
      problems.push(
        `the lockfile records ${name} as ${entry.version}, but its package.json says ${version}.\n` +
          `      Run \`npm install --package-lock-only\` and commit the result.`
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`✖ [workspace-versions] ${problems.length} problem(s):\n`);
  for (const m of problems) console.error(`   - ${m}`);
  console.error('\n  Left unfixed, `npm ci` stops working and CI cannot install.');
  process.exit(1);
}

console.log(
  `✔ [workspace-versions] ${workspaces.size} workspace packages: internal ranges satisfiable, lockfile in step.`
);
