#!/usr/bin/env node
/**
 * `oriva` CLI bin shim.
 *
 * The compiled entry lives in dist/cli.js (ESM). We dynamic-import it so
 * the shim itself stays valid CJS-safe Node script — works whether the
 * installed Node uses ESM or CJS resolution.
 */
import('../dist/cli.js')
  .then(({ run }) => run())
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`[oriva] fatal: ${err && err.message ? err.message : err}\n`);
    process.exit(2);
  });
