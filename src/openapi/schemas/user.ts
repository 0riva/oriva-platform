import { z } from 'zod';
import { registry } from '../registry';

const ApiKeyInfoSchema = z.object({
  keyId: z.string(),
  name: z.string(),
  userId: z.string().uuid(),
  permissions: z.array(z.string()),
  usageCount: z.number().int(),
});

export const UserMeSchema = registry.register(
  'UserMe',
  z.object({
    ok: z.boolean(),
    success: z.boolean(),
    data: z.object({
      id: z.string().uuid(),
      username: z.string().nullable(),
      displayName: z.string(),
      email: z.string().email().nullable(),
      bio: z.string().nullable(),
      location: z.string().nullable(),
      website: z.string().url().nullable(),
      avatar: z.string().url().nullable(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
      apiKeyInfo: ApiKeyInfoSchema,
    }),
  })
);

registry.registerPath({
  method: 'get',
  path: '/api/v1/user/me',
  operationId: 'getCurrentUser',
  tags: ['User'],
  summary: 'Get current user',
  description: "Returns the authenticated user's active profile and API key metadata.",
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Current user',
      content: { 'application/json': { schema: UserMeSchema } },
    },
    401: { description: 'Invalid or missing API key' },
  },
});

export const AnalyticsSummarySchema = registry.register(
  'AnalyticsSummary',
  z.object({
    ok: z.boolean(),
    success: z.boolean(),
    data: z.object({
      overview: z.object({
        totalEntries: z.number().int(),
        totalResponses: z.number().int(),
        totalGroups: z.number().int(),
        installedApps: z.number().int(),
      }),
      metrics: z.object({
        entriesGrowth: z.string(),
        responseGrowth: z.string(),
        groupActivity: z.string(),
        appUsage: z.string(),
      }),
      recentActivity: z.array(z.unknown()),
      timeRange: z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
      }),
    }),
    message: z.string().optional(),
  })
);

registry.registerPath({
  method: 'get',
  path: '/api/v1/analytics/summary',
  operationId: 'getAnalyticsSummary',
  tags: ['Analytics'],
  summary: 'Get analytics summary',
  description: 'Returns 7-day usage analytics for the authenticated API key.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Analytics summary',
      content: { 'application/json': { schema: AnalyticsSummarySchema } },
    },
    401: { description: 'Invalid or missing API key' },
  },
});
