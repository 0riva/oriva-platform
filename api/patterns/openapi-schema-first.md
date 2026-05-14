# OpenAPI Schema-First Pattern — o-platform

**Applies to**: any new or modified Express route in `api/index.ts` or `src/express/routes/`
**Infrastructure lives in**: `src/openapi/` (registry, spec, schemas/)
**Spec served at**: `GET /api/openapi.json` · `GET /api/docs` (Swagger UI)

---

## The Rule

Every public API endpoint must be registered in `src/openapi/schemas/` BEFORE it ships. **Drift is a CI failure** — `npm run docs:check` (runs in `test` job) blocks any PR where an Express route isn't in the spec or vice versa.

---

## Core Pattern — Register + Validate

### 1. Schema file structure

```typescript
// src/openapi/schemas/your-domain.ts
import { z } from 'zod';
import { registry } from '../registry';

// Capture the return value — it's a Zod schema with OpenAPI metadata attached
export const MyResponseSchema = registry.register(
  'MyResponse',          // name in components/schemas
  z.object({ ... })
);

// For path params, export the schema for use in the handler too
export const MyParamSchema = z.object({
  id: z.string().uuid(),
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/your-path/{id}',      // OpenAPI uses {id}, Express uses :id
  tags: ['YourTag'],
  summary: 'One-line description',
  security: [{ ApiKeyAuth: [] }],       // or BearerAuth
  request: {
    params: MyParamSchema,
  },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: MyResponseSchema } },
    },
    401: { description: 'Invalid or missing API key' },
  },
});
```

### 2. Wire into spec.ts

```typescript
// src/openapi/spec.ts — add one import line
import './schemas/your-domain'; // side effect: registers paths + components
```

### 3. Add runtime validation to the handler

```typescript
// api/index.ts — inside the route handler
import {
  validateRequestData,
  ValidationError,
} from '../src/middleware/validation';
import {
  MyParamSchema,
  MyBodySchema,
} from '../src/openapi/schemas/your-domain';

app.post('/api/v1/your-path/:id', validateApiKey, async (req, res) => {
  try {
    // Validate at the top of try — throws ValidationError if invalid
    const { id } = validateRequestData(MyParamSchema, req.params);
    const body = validateRequestData(MyBodySchema, req.body ?? {});

    // ... handler logic
  } catch (error) {
    // ⚠️ Express 4 does NOT auto-catch async throws — must check instanceof
    if (error instanceof ValidationError) {
      respondWithError(
        res,
        400,
        'VALIDATION_ERROR',
        error.message,
        error.details as unknown[]
      );
      return;
    }
    logger.error('Handler error', { error });
    respondWithError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
});
```

---

## Critical Gotchas

### ❌ WRONG — Zod v4 incompatibility

```bash
npm install @asteasolutions/zod-to-openapi   # installs v8+ → requires Zod v4
```

This repo is on **Zod v3.25.x**. Install the v3-compatible version:

```bash
npm install @asteasolutions/zod-to-openapi@7.3.4
```

### ❌ WRONG — ValidationError silently becomes 500

```typescript
} catch (error) {
  logger.error('Failed', { error });
  respondWithError(res, 500, 'ERROR', 'Internal error');  // ← catches ValidationError too!
}
```

Always add the instanceof check FIRST in every catch block that runs after `validateRequestData()`.

### ❌ WRONG — Body schema too strict

```typescript
// This rejects any caller who sends extra fields or omits optional ones
export const BodySchema = z.object({ name: z.string() }).strict();
```

Match current handler behavior — use `.optional()` for fields the handler doesn't require, and `.passthrough()` on body objects so unknown keys aren't rejected:

```typescript
export const BodySchema = z
  .object({
    name: z.string().optional(),
  })
  .passthrough();
```

### ❌ WRONG — Forgetting the instanceof ValidationError check for withAuthContext handlers

The `withAuthContext` wrapper does NOT propagate thrown errors to Express — they're caught by the wrapper. Validate at the top of the try block AND add the instanceof check in catch.

### ✅ Duplicate route registration — Express 4 uses the FIRST match

```typescript
app.get('/api/v1/auth/profile', validateAuth, withAuthContext(...));  // line 1554 — THIS one runs
// ...
app.get('/api/v1/auth/profile', validateAuth, async (req, res) => {...});  // line 4062 — SHADOWED
```

Before registering a path in the spec, `grep -n "'/api/v1/your-path'" api/index.ts` to check for duplicates. Document the first registration's response shape, not the shadowed one.

---

## Security scheme names (already registered in registry.ts)

| Middleware       | OpenAPI security scheme                    | Use for                  |
| ---------------- | ------------------------------------------ | ------------------------ |
| `validateApiKey` | `{ ApiKeyAuth: [] }`                       | Most public API routes   |
| `validateAuth`   | `{ BearerAuth: [] }`                       | JWT-authenticated routes |
| Both             | `[{ ApiKeyAuth: [] }, { BearerAuth: [] }]` | Accepts either           |

---

## What's already registered (as of Phase 0–2, May 2026)

| Tag       | Paths                                                                                 |
| --------- | ------------------------------------------------------------------------------------- |
| User      | `GET /api/v1/user/me`                                                                 |
| Analytics | `GET /api/v1/analytics/summary`                                                       |
| Profiles  | `GET available`, `GET active`, `PUT /:profileId`, `POST /:profileId/activate`         |
| Groups    | `GET /groups`, `GET /groups/:groupId/members`                                         |
| Auth      | `POST register/login/logout/token/refresh`, `GET/PATCH/PUT profile`, `DELETE account` |

Next: Marketplace + Developer routes (Phase 3).
