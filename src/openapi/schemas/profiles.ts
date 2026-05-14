import { z } from 'zod';
import { registry } from '../registry';

// Shared profile shape — used by /profiles/available and /profiles/active
export const ProfileSummarySchema = registry.register(
  'ProfileSummary',
  z.object({
    profileId: z.string().openapi({ example: 'ext_a1b2c3d4e5f6a7b8' }),
    profileName: z.string(),
    isActive: z.boolean(),
    avatar: z.string().url().nullable(),
    isDefault: z.boolean(),
  })
);

// Path param for routes that take :profileId
// Mirrors the existing express-validator rule: /^ext_[a-f0-9]{16}$/
export const ProfileIdParamSchema = z.object({
  profileId: z
    .string()
    .regex(/^ext_[a-f0-9]{16}$/, 'profileId must match ext_<16 hex chars>')
    .openapi({ example: 'ext_a1b2c3d4e5f6a7b8' }),
});

// PUT /api/v1/profiles/:profileId body
// All fields optional — mirrors handler behavior (handler falls back gracefully on missing values)
// .passthrough() so unknown extra keys are ignored rather than rejected
export const UpdateProfileBodySchema = z
  .object({
    profileName: z.string().min(1).optional(),
    avatar: z.string().url().optional(),
    bio: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
  })
  .passthrough();

export const UpdatedProfileSchema = registry.register(
  'UpdatedProfile',
  z.object({
    ok: z.boolean(),
    success: z.boolean(),
    data: z.object({
      profileId: z.string(),
      profileName: z.string(),
      isActive: z.boolean(),
      avatar: z.string().url().nullable(),
      bio: z.string().nullable(),
      location: z.string().nullable(),
      updatedAt: z.string().datetime(),
    }),
    message: z.string().optional(),
  })
);

registry.registerPath({
  method: 'get',
  path: '/api/v1/profiles/available',
  tags: ['Profiles'],
  summary: 'List available profiles',
  description: 'Returns all non-anonymous active profiles for the authenticated API key.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Available profiles',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(ProfileSummarySchema),
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/profiles/active',
  tags: ['Profiles'],
  summary: 'Get active profile',
  description: 'Returns the default active (non-anonymous) profile for the authenticated API key.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Active profile',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: ProfileSummarySchema,
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/profiles/{profileId}',
  tags: ['Profiles'],
  summary: 'Update a profile',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: ProfileIdParamSchema,
    body: {
      content: { 'application/json': { schema: UpdateProfileBodySchema } },
    },
  },
  responses: {
    200: {
      description: 'Profile updated',
      content: { 'application/json': { schema: UpdatedProfileSchema } },
    },
    400: { description: 'Validation error — invalid profileId format or body' },
    401: { description: 'Invalid or missing API key' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/profiles/{profileId}/activate',
  tags: ['Profiles'],
  summary: 'Activate a profile',
  description: 'Switches the active profile to the specified profile.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: ProfileIdParamSchema,
  },
  responses: {
    200: {
      description: 'Profile activated',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.object({
              activeProfile: z.string(),
              switchedAt: z.string().datetime(),
            }),
          }),
        },
      },
    },
    400: { description: 'Validation error — invalid profileId format' },
    401: { description: 'Invalid or missing API key' },
  },
});
