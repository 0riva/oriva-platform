# Never Delete `api/package.json` — Vercel Build Placeholder

**Applies to**: o-platform deploy pipeline (Vercel + the `api/` directory)
**Verified**: 2026-05-15 (incident: PR #35 + recovery commit `a73f791`)

---

## The Rule

`api/package.json` MUST exist at all times, even if empty of dependencies. Deleting it breaks Vercel deploys.

---

## The Failure

When `api/package.json` is missing, Vercel build fails with:

```
npm error code ENOENT
npm error syscall open
npm error path /vercel/path0/api/package.json
npm error enoent Could not read package.json: Error: ENOENT: no such file or directory
Error: Command "npm install" exited with 254
```

The GitHub Actions deploy job (`Deploy to Production`) reports `Command "npm install" exited with 254` with no further detail. The actual ENOENT only surfaces if you fetch the Vercel build log directly:

```bash
vercel inspect <deployment-url> --logs
```

---

## Why

Vercel auto-detects any `api/` directory as a serverless-functions folder and runs `npm install` inside it during the build phase, **independently of the project-level `installCommand`** in `vercel.json`. This auto-detection is not configurable via `vercel.json` (no `functions.skipInstall` option as of 2026-05).

The file's _presence_ satisfies Vercel's auto-detect; its _contents_ are irrelevant to runtime. The actual API runtime uses the root `package.json` deps (`api/index.ts` imports from `../src/...`).

---

## The Fix

Restore `api/package.json` as a no-deps placeholder:

```json
{
  "name": "oriva-api-function",
  "private": true,
  "version": "1.0.0",
  "description": "REQUIRED placeholder. Vercel auto-detects api/ as a serverless functions directory and runs `npm install` inside it during build — if this file is missing, Vercel deploy fails with ENOENT on api/package.json. Keep this file even though the API uses root package.json deps; api/index.ts imports from ../src/... and the root deps are what actually runs.",
  "engines": {
    "node": ">=18.0.0"
  }
}
```

The `description` field is the load-bearing documentation — future agents grepping for `api/package.json` will see the warning before deciding to delete.

---

## How This Was Missed (Lesson)

PR #35 deleted `api/package.json` based on three signals:

1. **No code references** — `grep -r "api/package" --include="*.{ts,js}"` returned nothing
2. **Local `npm install` succeeded** — root install ignored the api/ subdirectory entirely
3. **Stale deps** — listed older versions than root (express-rate-limit 7.x vs 8.x, openai 4.x vs 5.x)

All three were correct _for runtime_. None caught the build-platform dependency. The PR's CI on the feature branch passed because the PR-test job doesn't run the Vercel deploy step (deploy only runs on push to `main`). The failure surfaced only after merge.

**Generalisable lesson**: when evaluating if a file is "dead code", check all consumers including build platforms, CI configuration, and deploy tooling — not just runtime references. Build-time-only file dependencies are invisible to grep and to local builds.

---

## Discoverability Keywords

- `Command "npm install" exited with 254`
- `ENOENT api/package.json`
- `Could not read package.json /vercel/path0/api`
- `Vercel deploy failed npm install`
- `Vercel auto-detect serverless functions`
- "api/package.json appears unused — can I delete?"
