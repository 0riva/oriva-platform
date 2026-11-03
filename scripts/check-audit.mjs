#!/usr/bin/env node
/**
 * Guard: production dependencies carry no known advisory at moderate or above,
 * except the ones accepted in scripts/audit-accepted.json, each with its reason.
 *
 * WHY THIS EXISTS (2026-11-03, issue #82)
 * ---------------------------------------
 * The Security Scan job ran `npm audit --omit=dev --audit-level=moderate` and
 * had been red on every push since a zod advisory (GHSA-mrhx-c7xc-m3w5) was
 * published. That advisory is unreachable here and its fix is a major-version
 * migration (#84), but `npm audit` has no way to accept one advisory, so the
 * only choices were a permanently red gate (a real new advisory then looks the
 * same as the known one) or a lower threshold (which hides real ones too).
 * Accepted advisories used to be recorded as comments in the workflow, where
 * nothing checked them; the aws-sdk one stayed there after the v3 migration
 * removed it.
 *
 * This fails when:
 *   1. an advisory at moderate or above is not in the accepted list, or
 *   2. an accepted advisory no longer appears at all (the entry is stale and
 *      must be removed, so the list never outlives its reason).
 *
 * Run: node scripts/check-audit.mjs   (npm run check:audit)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const THRESHOLD = RANK.moderate;

/** Every advisory in an `npm audit --json` report, as { id, pkg, severity, title }. */
export function advisoriesOf(report) {
  const out = new Map();
  for (const [pkg, v] of Object.entries(report?.vulnerabilities ?? {})) {
    for (const via of v.via ?? []) {
      if (typeof via !== 'object' || !via) continue;
      const id = String(via.url ?? '').match(/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/)?.[0] ?? `npm-${via.source}`;
      out.set(`${id} ${pkg}`, { id, pkg: via.name ?? pkg, severity: via.severity, title: via.title });
    }
  }
  return [...out.values()];
}

/** The problems with a report against the accepted list; empty when the gate passes. */
export function auditProblems(report, accepted) {
  const found = advisoriesOf(report);
  const acceptedIds = new Set(accepted.map((a) => a.id));
  const problems = [];
  for (const a of found) {
    if ((RANK[a.severity] ?? RANK.critical) >= THRESHOLD && !acceptedIds.has(a.id)) {
      problems.push(`${a.severity} ${a.id} in ${a.pkg}: ${a.title}`);
    }
  }
  const foundIds = new Set(found.map((a) => a.id));
  for (const a of accepted) {
    if (!foundIds.has(a.id)) problems.push(`accepted ${a.id} (${a.package}) no longer appears; remove it from scripts/audit-accepted.json`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const accepted = JSON.parse(readFileSync(join(ROOT, 'scripts/audit-accepted.json'), 'utf8')).accepted;
  let raw;
  try {
    raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    // npm audit exits non-zero whenever it finds anything; the report is still on stdout.
    raw = error.stdout;
  }
  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    console.error('✗ [audit] npm audit returned no readable report');
    process.exit(1);
  }
  if (report.error) {
    console.error(`✗ [audit] npm audit failed: ${report.error.summary ?? report.error.code}`);
    process.exit(1);
  }
  const problems = auditProblems(report, accepted);
  if (problems.length) {
    console.error(`✗ [audit] ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  const n = advisoriesOf(report).length;
  console.log(`✔ [audit] ${n} advisor${n === 1 ? 'y' : 'ies'} in production dependencies; none at moderate or above outside the ${accepted.length} accepted.`);
}
