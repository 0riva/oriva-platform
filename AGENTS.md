# Repository Guidelines

## Project Structure & Module Organization
The API lives in `api/` with TypeScript entry `index.ts`, compiled output in `dist/`, and SQL artifacts in `sql/`. Shared plugin tooling sits in `packages/plugin-sdk/` (`src/` for source, `dist/` for publishes). Automated suites reside in `tests/` grouped by domain with fixtures and mocks; architecture notes and rollout specs are under `specs/` and `docs/`. Environment templates (`env.example`) and Supabase migrations (`supabase/`) support local provisioning.

## Build, Test & Development Commands
Use `npm run dev` for the compiled Express server and `npm run dev:ts` when debugging straight from TypeScript. `npm run build` (or `build:watch`) compiles the API via `api/tsconfig.json`. `npm test`, `npm run test:watch`, and `npm run test:coverage` execute Jest workflows; `npm run test:ci` powers CI. Lint with `npm run lint` or auto-fix via `lint:fix`. `npm run ci` chains type checking, coverage, and an npm audit.

## Coding Style & Naming Conventions
Code targets Node 18+, ES2022, and TypeScript. ESLint enforces 2-space indenting, single quotes, semicolons, and spaced braces; run it before committing. Prefer named exports, suffix Express middleware with `Middleware`, and store reusable test helpers as `*.helper.js`. Keep configuration files lowercase kebab-case.

## Testing Guidelines
Jest runs in the Node environment using `tests/setup.js` for Supabase stubs. Place specs in `tests/<area>/<feature>.test.js` and co-locate fixtures. Cover new endpoints with Supertest integration tests and refresh fixtures when schemas change. Track coverage with `npm run test:coverage` and keep reports under `coverage/`.

## Commit & Pull Request Guidelines
Follow the house style: emoji + uppercase tag + short subject (e.g., `🔧 MAINTENANCE: refresh rate limiter`). Reference issues or specs in the body and document any schema or migration files touched. Pull requests must outline behaviour changes, tests run (`npm run test:ci`), and include payload samples or screenshots for API changes. Re-run `npm run ci` before requesting review.

## Security & Configuration Tips
Load secrets from `.env` as described in `env-file-location.md`; treat `env.example` as the contract. Schedule `npm run security:audit` monthly and escalate highs via the `SECURITY_INCIDENT_*` playbooks. Rotate Supabase tokens with scripts in `supabase/` before releases.
