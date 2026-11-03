import { z } from 'zod';
import { registry } from '../registry';

export const GroupIdParamSchema = z.object({
  groupId: z.string().uuid().openapi({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
});

export const GroupSummarySchema = registry.register(
  'GroupSummary',
  z.object({
    groupId: z.string().uuid(),
    groupName: z.string(),
    memberCount: z.number().int(),
    isActive: z.boolean(),
    role: z.string().openapi({ example: 'admin' }),
    description: z.string().nullable(),
    image_url: z.string().url().nullable(),
    external_link: z.string().url().nullable(),
  })
);

export const GroupMemberSchema = registry.register(
  'GroupMember',
  z.object({
    memberId: z.string().uuid(),
    displayName: z.string(),
    role: z.string(),
    joinedAt: z.string().datetime(),
    avatar: z.string().url().nullable(),
  })
);

registry.registerPath({
  method: 'get',
  path: '/api/v1/groups',
  operationId: 'listGroups',
  tags: ['Groups'],
  summary: 'List groups',
  description: 'Returns all groups the authenticated user created or joined.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'User groups',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(GroupSummarySchema),
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/groups/{groupId}/members',
  operationId: 'listGroupMembers',
  tags: ['Groups'],
  summary: 'Get group members',
  description: 'Returns members of a group. Requires the caller to be the creator or a member.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: GroupIdParamSchema,
  },
  responses: {
    200: {
      description: 'Group members',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(GroupMemberSchema),
          }),
        },
      },
    },
    400: { description: 'Validation error — invalid groupId format' },
    401: { description: 'Invalid or missing API key' },
    403: { description: 'Not a member or creator of this group' },
    404: { description: 'Group not found' },
  },
});
