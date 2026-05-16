import { z } from 'zod';
import { registry } from '../registry';

// ── Request bodies ────────────────────────────────────────────────────────────

export const CreatePersonalTokenBodySchema = z.object({
  name: z.string().min(1).max(100).describe('Human-readable label for the token'),
  expires_at: z
    .string()
    .datetime()
    .optional()
    .describe('ISO 8601 expiry date. Omit for a non-expiring token.'),
});

export const TokenIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ── Response schemas ──────────────────────────────────────────────────────────

export const CreatedPersonalTokenSchema = registry.register(
  'CreatedPersonalToken',
  z.object({
    ok: z.literal(true),
    success: z.literal(true),
    data: z.object({
      token: z
        .string()
        .describe('Full token value — displayed ONCE. Store it now; it cannot be retrieved again.'),
      id: z.string().uuid(),
      name: z.string(),
      prefix: z.string().describe('First 20 characters of the token, safe to display later.'),
      created_at: z.string().datetime(),
      expires_at: z.string().datetime().nullable(),
    }),
  })
);

export const PersonalTokenSummarySchema = registry.register(
  'PersonalTokenSummary',
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    prefix: z.string(),
    created_at: z.string().datetime(),
    last_used_at: z.string().datetime().nullable(),
    expires_at: z.string().datetime().nullable(),
    is_active: z.boolean(),
  })
);

export const PersonalTokenListSchema = registry.register(
  'PersonalTokenList',
  z.object({
    ok: z.literal(true),
    success: z.literal(true),
    data: z.array(PersonalTokenSummarySchema),
  })
);

// ── Path registrations ────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/v1/me/tokens',
  operationId: 'createPersonalAccessToken',
  tags: ['PersonalTokens'],
  summary: 'Create a Personal Access Token',
  description:
    'Issues a new Personal Access Token (PAT) scoped to the authenticated account. ' +
    'The full token value is returned **once** and cannot be retrieved again. ' +
    'PATs carry broad `["read","write"]` permissions and are intended for personal tooling (e.g. MCP servers).',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreatePersonalTokenBodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Token created — contains the full one-time token value',
      content: { 'application/json': { schema: CreatedPersonalTokenSchema } },
    },
    400: { description: 'Validation error' },
    401: { description: 'Not authenticated' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/me/tokens',
  operationId: 'listPersonalAccessTokens',
  tags: ['PersonalTokens'],
  summary: 'List Personal Access Tokens',
  description:
    'Returns all PATs belonging to the authenticated account. ' +
    'Full token values and hashes are never returned.',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'List of PATs',
      content: { 'application/json': { schema: PersonalTokenListSchema } },
    },
    401: { description: 'Not authenticated' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/me/tokens/{id}',
  operationId: 'revokePersonalAccessToken',
  tags: ['PersonalTokens'],
  summary: 'Revoke a Personal Access Token',
  description:
    'Sets `is_active = false` on the token (soft-delete). ' +
    'The row is preserved for audit purposes. Returns 404 if the token does not belong to this account.',
  security: [{ BearerAuth: [] }],
  request: {
    params: TokenIdParamSchema,
  },
  responses: {
    204: { description: 'Revoked successfully' },
    401: { description: 'Not authenticated' },
    404: { description: 'Token not found or does not belong to this account' },
  },
});
