import { z } from 'zod';
import { registry } from '../registry';
import { MarketplaceAppSchema } from './marketplace';

// ── Path param ───────────────────────────────────────────────────────────────

export const AppIdParamSchema = z.object({
  appId: z.string().uuid(),
});

// ── Request body ─────────────────────────────────────────────────────────────

// POST /api/v1/developer/apps body — subset of MarketplaceApp fields the handler reads
export const CreateAppBodySchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().min(1),
    tagline: z.string().optional(),
    description: z.string().optional(),
    category: z.string().min(1),
    icon_url: z.string().url().optional(),
    screenshots: z.array(z.string().url()).optional(),
    version: z.string().default('1.0.0'),
    pricing_model: z.string().default('free'),
    pricing_config: z.record(z.unknown()).optional(),
    supported_audience: z.array(z.string()).optional(),
  })
  .passthrough();

// PUT /api/v1/developer/apps/:appId — same fields, all optional for partial update
export const UpdateAppBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    tagline: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    icon_url: z.string().url().optional(),
    screenshots: z.array(z.string().url()).optional(),
    version: z.string().optional(),
    pricing_model: z.string().optional(),
    pricing_config: z.record(z.unknown()).optional(),
    supported_audience: z.array(z.string()).optional(),
  })
  .passthrough();

// POST /api/v1/developer/apps/:appId/resubmit — same shape as update
export const ResubmitAppBodySchema = UpdateAppBodySchema;

// ── Path registrations ───────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/v1/developer/apps',
  tags: ['Developer'],
  summary: 'List developer apps',
  description: 'Returns all marketplace apps owned by the authenticated developer.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Developer apps',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(MarketplaceAppSchema),
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/developer/apps/{appId}',
  tags: ['Developer'],
  summary: 'Get developer app',
  security: [{ ApiKeyAuth: [] }],
  request: { params: AppIdParamSchema },
  responses: {
    200: {
      description: 'App details',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: MarketplaceAppSchema,
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
    404: { description: 'App not found or not owned by this developer' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/developer/apps',
  tags: ['Developer'],
  summary: 'Create app',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: CreateAppBodySchema } } },
  },
  responses: {
    201: {
      description: 'App created (status: draft)',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: MarketplaceAppSchema,
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/developer/apps/{appId}',
  tags: ['Developer'],
  summary: 'Update app',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: AppIdParamSchema,
    body: { content: { 'application/json': { schema: UpdateAppBodySchema } } },
  },
  responses: {
    200: {
      description: 'App updated',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: MarketplaceAppSchema,
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
    404: { description: 'App not found or not owned by this developer' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/developer/apps/{appId}',
  tags: ['Developer'],
  summary: 'Delete app',
  description: 'Only draft apps can be deleted. Approved apps must be deactivated first.',
  security: [{ ApiKeyAuth: [] }],
  request: { params: AppIdParamSchema },
  responses: {
    204: { description: 'App deleted' },
    400: { description: 'App is not in draft status — cannot delete' },
    401: { description: 'Invalid or missing API key' },
    404: { description: 'App not found or not owned by this developer' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/developer/apps/{appId}/submit',
  tags: ['Developer'],
  summary: 'Submit app for review',
  description: 'Transitions app from draft → pending_review.',
  security: [{ ApiKeyAuth: [] }],
  request: { params: AppIdParamSchema },
  responses: {
    200: {
      description: 'App submitted for review',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: MarketplaceAppSchema,
            message: z.string(),
          }),
        },
      },
    },
    400: { description: 'App is not in draft status' },
    401: { description: 'Invalid or missing API key' },
    404: { description: 'App not found or not owned by this developer' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/developer/apps/{appId}/resubmit',
  tags: ['Developer'],
  summary: 'Resubmit rejected app',
  description: 'Updates fields and resubmits a rejected app for review.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: AppIdParamSchema,
    body: { content: { 'application/json': { schema: ResubmitAppBodySchema } } },
  },
  responses: {
    200: {
      description: 'App resubmitted',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: MarketplaceAppSchema,
            message: z.string(),
          }),
        },
      },
    },
    400: { description: 'App is not in rejected status' },
    401: { description: 'Invalid or missing API key' },
    404: { description: 'App not found or not owned by this developer' },
  },
});
