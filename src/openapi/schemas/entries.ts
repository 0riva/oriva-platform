import { z } from 'zod';
import { registry } from '../registry';

// ── Schemas ───────────────────────────────────────────────────────────────────

export const EntrySchema = registry.register(
  'Entry',
  z.object({
    id: z.string().uuid(),
    title: z.string(),
    content: z.string(),
    profile_id: z.string().uuid(),
    audience_type: z.string(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
);

const PaginationMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

// ── Path registrations ───────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/v1/entries',
  operationId: 'listEntries',
  tags: ['Entries'],
  summary: 'List entries',
  description: "Returns paginated entries for the authenticated user's profile.",
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: z.object({
      limit: z.number().int().min(1).max(100).default(20).optional(),
      offset: z.number().int().min(0).default(0).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Entries list',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(EntrySchema),
            meta: z.object({ pagination: PaginationMetaSchema }),
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
    404: { description: 'User profile not found' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/templates',
  operationId: 'listTemplates',
  tags: ['Entries'],
  summary: 'List templates',
  description: 'Returns available entry templates. Not yet implemented — returns empty list.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Templates list (currently always empty)',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(z.unknown()),
            meta: z.object({ pagination: PaginationMetaSchema }),
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/storage',
  operationId: 'getStorage',
  tags: ['Entries'],
  summary: 'Get storage info',
  description:
    'Returns storage usage for the authenticated user. Not yet implemented — returns empty object.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Storage info',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.record(z.unknown()),
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/ui/notifications',
  operationId: 'createUiNotification',
  tags: ['UI'],
  summary: 'Create notification',
  description: 'Creates a UI notification for the authenticated user.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Notification created',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.object({ id: z.string() }),
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
  },
});
