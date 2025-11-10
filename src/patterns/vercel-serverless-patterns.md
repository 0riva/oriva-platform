# Vercel Serverless Function Patterns

Patterns for building Vercel serverless functions in the Plugin Gateway API.

## Function Structure Pattern

### ❌ WRONG: Monolithic Handler with No Middleware

```typescript
// api/v1/bad-endpoint.ts
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Manual auth checks in every function
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Manual rate limiting
  // ... rate limit logic repeated everywhere

  // Manual validation
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Business logic mixed with infrastructure
  try {
    const result = await doSomething(req.body);
    res.json(result);
  } catch (error) {
    // Error handling repeated everywhere
    res.status(500).json({ error: 'Internal error' });
  }
}
```

**Problems:**

- Repeated auth/rate-limiting/validation code
- No consistent error handling
- Hard to test business logic separately
- Violates DRY principle

### ✅ CORRECT: Middleware-Based Handler with Separation of Concerns

```typescript
// api/v1/topics.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../src/middleware/auth';
import {
  asyncHandler,
  validationError,
} from '../../src/middleware/error-handler';
import { rateLimit } from '../../src/middleware/rate-limit';

/**
 * Business logic handler - pure, testable, reusable
 */
async function handleTopicExtraction(
  req: AuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const { entry_id, content } = req.body;

  if (!entry_id && !content) {
    throw validationError('Either entry_id or content is required');
  }

  // userId available from authContext (added by middleware)
  const { userId } = req.authContext;

  const result = await extractTopics(content, userId);
  res.status(200).json(result);
}

/**
 * Main handler - infrastructure only, delegates to business logic
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  await asyncHandler(async () => {
    await authenticate(req, res, async () => {
      await rateLimit(req, res, async () => {
        const authReq = req as AuthenticatedRequest;

        if (req.method !== 'POST') {
          res.status(405).json({
            error: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED',
          });
          return;
        }

        // Route to specific handler
        if (req.url?.match(/\/extract$/)) {
          return handleTopicExtraction(authReq, res);
        }

        res.status(404).json({
          error: 'Endpoint not found',
          code: 'NOT_FOUND',
        });
      });
    });
  })(req, res);
}
```

**Benefits:**

- Middleware handles cross-cutting concerns
- Business logic is pure and testable
- Consistent error handling via asyncHandler
- Easy to add new routes without duplicating infrastructure

**Reference:** [`api/v1/topics.ts`](../v1/topics.ts), [`api/v1/hugo.ts`](../v1/hugo.ts)

---

## Catch-All Routing Pattern

### ❌ WRONG: One Serverless Function Per Route

```
api/v1/topics-extract.ts       // POST /api/v1/topics/extract
api/v1/topics-list.ts          // GET /api/v1/topics/list
api/v1/topics-update.ts        // PUT /api/v1/topics/:id
api/v1/topics-delete.ts        // DELETE /api/v1/topics/:id
```

**Problems:**

- Vercel function count limit (12 on hobby plan)
- Shared code duplicated across functions
- Hard to maintain consistent middleware
- Expensive cold starts multiply

### ✅ CORRECT: Catch-All Handler with URL Routing

```typescript
// api/v1/topics.ts - Handles ALL /api/v1/topics/* routes
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await asyncHandler(async () => {
    await authenticate(req, res, async () => {
      const { url, method } = req;

      // POST /api/v1/topics/extract
      if (method === 'POST' && url?.match(/\/extract$/)) {
        return handleTopicExtraction(req, res);
      }

      // GET /api/v1/topics/list
      if (method === 'GET' && url?.match(/\/list$/)) {
        return handleTopicList(req, res);
      }

      // PUT /api/v1/topics/:id
      if (method === 'PUT' && url?.match(/\/topics\/[^/]+$/)) {
        return handleTopicUpdate(req, res);
      }

      res.status(404).json({ error: 'Endpoint not found' });
    });
  })(req, res);
}
```

**With vercel.json routing:**

```json
{
  "rewrites": [
    {
      "source": "/api/v1/topics/:path*",
      "destination": "/api/v1/topics"
    }
  ]
}
```

**Benefits:**

- Single function handles all topic-related routes
- Shared middleware and initialization
- Fewer cold starts
- Easier to maintain route families

**Reference:** [`api/v1/hugo.ts`](../v1/hugo.ts) (handles /chat and /knowledge/search)

---

## Vercel Routing Configuration

### ❌ WRONG: Hardcoded Routes with No Patterns

```json
{
  "rewrites": [
    {
      "source": "/api/v1/topics/extract",
      "destination": "/api/v1/topics"
    },
    {
      "source": "/api/v1/topics/list",
      "destination": "/api/v1/topics"
    },
    {
      "source": "/api/v1/topics/123",
      "destination": "/api/v1/topics"
    }
  ]
}
```

**Problems:**

- Route explosion for dynamic paths
- Brittle configuration
- Hard to add new routes

### ✅ CORRECT: Wildcard Pattern Routing

```json
{
  "rewrites": [
    {
      "source": "/api/v1/topics/:path*",
      "destination": "/api/v1/topics"
    }
  ]
}
```

**Benefits:**

- Single rule catches all topic routes
- Serverless function handles internal routing
- Easy to extend with new routes

**Reference:** [`vercel.json`](../../vercel.json)

---

## Authentication Pattern

### ❌ WRONG: Manual Token Validation in Every Function

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid auth header' });
  }

  const token = authHeader.slice(7);

  // Validate with Supabase
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Business logic with manual userId passing
  await doSomething(data.user.id);
}
```

**Problems:**

- Auth logic duplicated everywhere
- Error handling inconsistent
- Hard to test business logic
- userId must be manually threaded through

### ✅ CORRECT: Middleware-Based Authentication

```typescript
// src/middleware/auth.ts
export interface AuthenticatedRequest extends VercelRequest {
  authContext: {
    userId: string;
    user: User;
  };
}

export async function authenticate(
  req: VercelRequest,
  res: VercelResponse,
  next: () => Promise<void>
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { data, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Attach auth context to request
  (req as AuthenticatedRequest).authContext = {
    userId: data.user.id,
    user: data.user,
  };

  await next();
}

// Usage in handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await authenticate(req, res, async () => {
    const authReq = req as AuthenticatedRequest;
    const { userId } = authReq.authContext; // Type-safe access

    await doSomething(userId);
  });
}
```

**Benefits:**

- Centralized auth logic
- Type-safe auth context
- Consistent error responses
- Easy to mock in tests

**Reference:** [`src/middleware/auth.ts`](../../src/middleware/auth.ts) (if exists)

---

## Error Handling Pattern

### ❌ WRONG: Inconsistent Error Responses

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const result = await doSomething();
    res.json(result);
  } catch (error) {
    // Different error formats everywhere
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ message: 'Not found' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}
```

### ✅ CORRECT: Consistent Error Handler Middleware

```typescript
// src/middleware/error-handler.ts
export function validationError(message: string): Error {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
}

export function asyncHandler(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: error.message,
          code: 'VALIDATION_ERROR',
        });
      }

      console.error('Handler error:', error);
      res.status(500).json({
        error:
          process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : error.message,
        code: 'INTERNAL_ERROR',
      });
    }
  };
}

// Usage
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await asyncHandler(async () => {
    if (!req.body.entry_id) {
      throw validationError('entry_id is required');
    }

    const result = await extractTopics(req.body.entry_id);
    res.json(result);
  })(req, res);
}
```

**Benefits:**

- Consistent error response format
- Proper HTTP status codes
- Production-safe error messages
- Type-safe error creation

**Reference:** [`src/middleware/error-handler.ts`](../../src/middleware/error-handler.ts) (if exists)
