import { z } from 'zod';
import { registry } from '../registry';

// =============================================================================
// Shared param / body schemas
// =============================================================================

const BridgePlatformEnum = z
  .enum(['monday', 'clickup', 'asana', 'notion'])
  .openapi({ example: 'monday' });

export const BridgePlatformParamSchema = z.object({
  platform: BridgePlatformEnum,
});

export const CreateBridgeConnectionBodySchema = registry.register(
  'CreateBridgeConnectionBody',
  z.object({
    platform: BridgePlatformEnum,
    apiToken: z
      .string()
      .min(1)
      .openapi({ description: 'A personal/API token for the external tool (headless connect).' }),
  })
);

export const TriggerBridgeSyncBodySchema = registry.register(
  'TriggerBridgeSyncBody',
  z.object({
    bridgeGroupId: z.string().uuid(),
  })
);

// =============================================================================
// Response schemas
// =============================================================================

export const BridgeConnectionSchema = registry.register(
  'BridgeConnection',
  z.object({
    platform: BridgePlatformEnum,
    connected: z.boolean(),
    workspaceId: z.string().nullable(),
    connectedAt: z.string().datetime().nullable(),
  })
);

export const BridgeGroupSchema = registry.register(
  'BridgeGroup',
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    participantCount: z.number().int(),
    health: z.string().nullable().openapi({ example: 'healthy' }),
  })
);

export const BridgeTaskSchema = registry.register(
  'BridgeTask',
  z.object({
    id: z.string().uuid(),
    bridgeGroupId: z.string().uuid(),
    sourcePlatform: z.string(),
    sourceId: z.string(),
    title: z.string(),
    status: z.string().nullable(),
    priority: z.string().nullable(),
    dueDate: z.string().nullable(),
  })
);

const okEnvelope = (data: z.ZodTypeAny) =>
  z.object({ ok: z.boolean(), success: z.boolean(), data });

// =============================================================================
// Paths
// =============================================================================

registry.registerPath({
  method: 'get',
  path: '/api/v1/bridge/connections',
  operationId: 'listBridgeConnections',
  tags: ['Bridge'],
  summary: 'List Bridge tool connections',
  description: 'Lists the external workflow tools connected for the authenticated account’s organizations, with connection status.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Connected tools',
      content: { 'application/json': { schema: okEnvelope(z.array(BridgeConnectionSchema)) } },
    },
    401: { description: 'Invalid or missing API key' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/bridge/connections',
  operationId: 'createBridgeConnection',
  tags: ['Bridge'],
  summary: 'Connect a tool headlessly with an API token',
  description:
    'Stores an API token for an external workflow tool so it can sync into the org’s bridges. Headless alternative to the in-app OAuth connect. Requires org admin.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreateBridgeConnectionBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Connection stored',
      content: { 'application/json': { schema: okEnvelope(BridgeConnectionSchema) } },
    },
    400: { description: 'Validation error' },
    401: { description: 'Invalid or missing API key' },
    403: { description: 'Caller is not an admin of any organization' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/bridge/connections/{platform}',
  operationId: 'disconnectBridgeConnection',
  tags: ['Bridge'],
  summary: 'Disconnect a tool',
  description: 'Removes the stored token for a platform across the caller’s organizations. Requires org admin.',
  security: [{ ApiKeyAuth: [] }],
  request: { params: BridgePlatformParamSchema },
  responses: {
    200: {
      description: 'Disconnected',
      content: { 'application/json': { schema: okEnvelope(z.object({ platform: BridgePlatformEnum })) } },
    },
    401: { description: 'Invalid or missing API key' },
    403: { description: 'Caller is not an admin of any organization' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/bridge/groups',
  operationId: 'listBridges',
  tags: ['Bridge'],
  summary: 'List bridges',
  description: 'Lists the bridge groups the authenticated account’s organizations participate in.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Bridges',
      content: { 'application/json': { schema: okEnvelope(z.array(BridgeGroupSchema)) } },
    },
    401: { description: 'Invalid or missing API key' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/bridge/tasks',
  operationId: 'listBridgeTasks',
  tags: ['Bridge'],
  summary: 'List bridge tasks',
  description: 'Lists the canonical synced tasks in a bridge group. Pass ?bridgeGroupId=<uuid>.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: z.object({
      bridgeGroupId: z.string().uuid(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Bridge tasks',
      content: { 'application/json': { schema: okEnvelope(z.array(BridgeTaskSchema)) } },
    },
    400: { description: 'Validation error — missing or invalid bridgeGroupId' },
    401: { description: 'Invalid or missing API key' },
    403: { description: 'Caller does not participate in this bridge' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/bridge/sync',
  operationId: 'triggerBridgeSync',
  tags: ['Bridge'],
  summary: 'Trigger a bridge sync',
  description: 'Enqueues a sync event for a bridge group so connected tools reconcile. Requires participation in the bridge.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: TriggerBridgeSyncBodySchema } } },
  },
  responses: {
    202: {
      description: 'Sync enqueued',
      content: {
        'application/json': {
          schema: okEnvelope(z.object({ bridgeGroupId: z.string().uuid(), enqueued: z.boolean() })),
        },
      },
    },
    400: { description: 'Validation error' },
    401: { description: 'Invalid or missing API key' },
    403: { description: 'Caller does not participate in this bridge' },
  },
});
