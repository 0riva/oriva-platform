import { z } from 'zod';
import { registry } from '../registry';

// ── Shared ──────────────────────────────────────────────────────────────────

const PaginationMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

// ── Team ─────────────────────────────────────────────────────────────────────

export const TeamMemberSchema = registry.register(
  'TeamMember',
  z.object({
    profileId: z.string().uuid(),
    displayName: z.string().nullable(),
    username: z.string().nullable(),
    avatarUrl: z.string().url().nullable(),
    role: z.string(),
    joinedAt: z.string().datetime(),
    group: z.object({
      id: z.string().uuid(),
      name: z.string(),
    }),
  })
);

// ── Path registrations ───────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/v1/sessions',
  tags: ['Sessions'],
  summary: 'List sessions',
  description:
    "Returns the user's sessions. Sessions feature is not yet implemented — returns empty paginated list.",
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Sessions list (currently always empty)',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(z.unknown()),
            meta: z.object({ pagination: PaginationMetaSchema }),
            message: z.string().optional(),
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/sessions/upcoming',
  tags: ['Sessions'],
  summary: 'List upcoming sessions',
  description:
    'Returns upcoming sessions. Sessions feature is not yet implemented — returns empty list.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Upcoming sessions (currently always empty)',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(z.unknown()),
            message: z.string().optional(),
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/team/members',
  tags: ['Team'],
  summary: 'List team members',
  description:
    'Returns group memberships for the authenticated user as a flat list of team members.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Team members',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(TeamMemberSchema),
            meta: z.object({
              total: z.number().int(),
              roles: z.array(z.string()),
            }),
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
  },
});
