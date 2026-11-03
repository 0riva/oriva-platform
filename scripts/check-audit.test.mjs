// Tests for scripts/check-audit.mjs (issue #82). Run: node --test scripts/check-audit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { advisoriesOf, auditProblems } from './check-audit.mjs';

const advisory = (name, severity, ghsa) => ({ source: 1, name, title: `${name} bug`, url: `https://github.com/advisories/${ghsa}`, severity });
const report = (...entries) => ({
  vulnerabilities: Object.fromEntries(entries.map(([pkg, via]) => [pkg, { name: pkg, via }])),
});
const ZOD = advisory('zod', 'high', 'GHSA-mrhx-c7xc-m3w5');
const ACCEPTED = [{ id: 'GHSA-mrhx-c7xc-m3w5', package: 'zod' }];

test('reads each advisory once, and skips the entries that only point at another package', () => {
  const r = report(['zod', [ZOD]], ['openai', ['zod']], ['@asteasolutions/zod-to-openapi', ['zod']]);
  assert.deepEqual(advisoriesOf(r), [{ id: 'GHSA-mrhx-c7xc-m3w5', pkg: 'zod', severity: 'high', title: 'zod bug' }]);
});

test('passes when every advisory at moderate or above is accepted', () => {
  assert.deepEqual(auditProblems(report(['zod', [ZOD]]), ACCEPTED), []);
});

test('fails on an advisory at moderate or above that is not accepted, naming it', () => {
  const r = report(['zod', [ZOD]], ['qs', [advisory('qs', 'moderate', 'GHSA-4mjr-xmp4-gh2g')]]);
  assert.deepEqual(auditProblems(r, ACCEPTED), ['moderate GHSA-4mjr-xmp4-gh2g in qs: qs bug']);
});

test('does not fail on a low advisory', () => {
  const r = report(['zod', [ZOD]], ['deepmerge', [advisory('deepmerge', 'low', 'GHSA-gcqx-w48m-w2h4')]]);
  assert.deepEqual(auditProblems(r, ACCEPTED), []);
});

test('fails on a critical advisory even when a different one is accepted', () => {
  const r = report(['zod', [ZOD]], ['proxy-addr', [advisory('proxy-addr', 'critical', 'GHSA-aaaa-bbbb-cccc')]]);
  assert.equal(auditProblems(r, ACCEPTED).length, 1);
});

test('fails when an accepted advisory no longer appears, so the list cannot outlive its reason', () => {
  assert.deepEqual(auditProblems(report(), ACCEPTED), [
    'accepted GHSA-mrhx-c7xc-m3w5 (zod) no longer appears; remove it from scripts/audit-accepted.json',
  ]);
});
