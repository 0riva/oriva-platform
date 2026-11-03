import { z } from 'zod';
import { registry } from '../registry';

// ── Shared schemas ────────────────────────────────────────────────────────────

const PaginationMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

const PaginationQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

// ── MarketplaceApp — shared by marketplace browsing + developer routes ────────

export const MarketplaceAppSchema = registry.register(
  'MarketplaceApp',
  z.object({
    id: z.string().uuid(),
    external_id: z.string().optional(),
    name: z.string(),
    slug: z.string(),
    tagline: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    category: z.string(),
    icon_url: z.string().url().nullable().optional(),
    screenshots: z.array(z.string().url()).nullable().optional(),
    version: z.string(),
    pricing_model: z.string(),
    pricing_config: z.record(z.unknown()).nullable().optional(),
    install_count: z.number().int(),
    developer_id: z.string().uuid(),
    developer_name: z.string(),
    status: z.enum(['draft', 'pending_review', 'approved', 'rejected']),
    is_active: z.boolean(),
    supported_audience: z.array(z.string()).nullable().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
);

// ── Installed app — includes nested app summary ──────────────────────────────

export const InstalledAppSchema = registry.register(
  'InstalledApp',
  z.object({
    installationId: z.string().uuid(),
    installedAt: z.string().datetime(),
    isActive: z.boolean(),
    settings: z.record(z.unknown()).nullable(),
    app: MarketplaceAppSchema,
  })
);

// ── Marketplace item (entries-based) ─────────────────────────────────────────

export const MarketplaceItemSchema = registry.register(
  'MarketplaceItem',
  z.object({
    id: z.string().uuid(),
    title: z.string(),
    content: z.string().nullable().optional(),
    profile_id: z.string().uuid(),
    entry_type: z.string(),
    marketplace_metadata: z.record(z.unknown()).nullable().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
);

// ── Category schema ──────────────────────────────────────────────────────────

export const CategorySchema = registry.register(
  'Category',
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable().optional(),
    collection_type: z.string(),
    organization_rules: z.record(z.unknown()).nullable().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
);

// ── App param ─────────────────────────────────────────────────────────────────

const AppIdParamSchema = z.object({ appId: z.string().uuid() });
const ItemIdParamSchema = z.object({ id: z.string().uuid() });
const CategoryIdParamSchema = z.object({ id: z.string().uuid() });

// ── Path registrations — Plugin Apps (validateApiKey) ─────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/v1/marketplace/apps',
  operationId: 'listMarketplaceApps',
  tags: ['Marketplace'],
  summary: 'Browse marketplace apps',
  description: 'Returns paginated list of approved, active marketplace apps.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    query: PaginationQuerySchema.extend({
      category: z.string().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Marketplace apps',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(MarketplaceAppSchema),
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
  path: '/api/v1/marketplace/trending',
  operationId: 'listTrendingApps',
  tags: ['Marketplace'],
  summary: 'Trending apps',
  description: 'Returns approved apps sorted by install count (top 20).',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Trending apps',
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
  path: '/api/v1/marketplace/featured',
  operationId: 'listFeaturedApps',
  tags: ['Marketplace'],
  summary: 'Featured apps',
  description: 'Returns featured approved apps (curated subset of top apps).',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Featured apps',
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
  path: '/api/v1/marketplace/categories',
  operationId: 'listMarketplaceCategories',
  tags: ['Marketplace'],
  summary: 'List app categories',
  description:
    'Returns distinct categories from approved apps with their app counts. ' +
    'Note: a second registration of this path exists (no auth, collections-table version) ' +
    'but is shadowed by this route (Express first-match).',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Category counts',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(
              z.object({
                category: z.string(),
                count: z.number().int(),
              })
            ),
          }),
        },
      },
    },
    401: { description: 'Invalid or missing API key' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/marketplace/apps/{appId}',
  operationId: 'getMarketplaceApp',
  tags: ['Marketplace'],
  summary: 'Get app details',
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
    404: { description: 'App not found' },
  },
});

// ── Path registrations — Install/Uninstall (validateAuth) ─────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/v1/marketplace/installed',
  operationId: 'listInstalledApps',
  tags: ['Marketplace'],
  summary: 'List installed apps',
  description: 'Returns all apps installed by the authenticated user.',
  security: [{ BearerAuth: [] }],
  request: { query: PaginationQuerySchema },
  responses: {
    200: {
      description: 'Installed apps',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(InstalledAppSchema),
            meta: z.object({ pagination: PaginationMetaSchema }),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/marketplace/install/{appId}',
  operationId: 'installMarketplaceApp',
  tags: ['Marketplace'],
  summary: 'Install app',
  security: [{ BearerAuth: [] }],
  request: {
    params: AppIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: z.object({ settings: z.record(z.unknown()).optional() }).passthrough(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'App installed',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: InstalledAppSchema,
            message: z.string(),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    404: { description: 'App not found or not available for installation' },
    409: { description: 'App already installed' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/marketplace/uninstall/{appId}',
  operationId: 'uninstallMarketplaceApp',
  tags: ['Marketplace'],
  summary: 'Uninstall app',
  security: [{ BearerAuth: [] }],
  request: { params: AppIdParamSchema },
  responses: {
    200: {
      description: 'App uninstalled',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    401: { description: 'Unauthorized' },
    404: { description: 'App installation not found' },
  },
});

// ── Path registrations — Marketplace Items (no auth, public) ──────────────────

registry.registerPath({
  method: 'get',
  path: '/api/v1/marketplace/items',
  operationId: 'listMarketplaceItems',
  tags: ['Marketplace'],
  summary: 'List marketplace items',
  description:
    'Public listing of published marketplace items (entry-based). No authentication required.',
  request: {
    query: PaginationQuerySchema.extend({
      item_type: z.string().optional(),
      earner_type: z.string().optional(),
      category_id: z.string().uuid().optional(),
      min_price: z.number().optional(),
      max_price: z.number().optional(),
      seller_id: z.string().uuid().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Marketplace items',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(MarketplaceItemSchema),
            meta: z.object({ pagination: PaginationMetaSchema }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/marketplace/items/{id}',
  operationId: 'getMarketplaceItem',
  tags: ['Marketplace'],
  summary: 'Get marketplace item',
  description: 'Returns a single published marketplace item by ID.',
  request: { params: ItemIdParamSchema },
  responses: {
    200: {
      description: 'Marketplace item',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: MarketplaceItemSchema,
          }),
        },
      },
    },
    404: { description: 'Item not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/marketplace/search',
  operationId: 'searchMarketplace',
  tags: ['Marketplace'],
  summary: 'Search marketplace',
  description: 'Full-text search across marketplace items. No authentication required.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              query: z.string().min(1),
              filters: z.record(z.unknown()).optional(),
              limit: z.number().int().max(100).optional(),
              offset: z.number().int().optional(),
            })
            .passthrough(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Search results',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(MarketplaceItemSchema),
            meta: z.object({ pagination: PaginationMetaSchema }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/marketplace/categories/tree',
  operationId: 'getCategoryTree',
  tags: ['Marketplace'],
  summary: 'Category tree',
  description:
    'Returns marketplace categories as a hierarchical tree from the collections table. Children are nested category objects of the same shape.',
  responses: {
    200: {
      description: 'Category tree',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: z.array(
              CategorySchema.extend({
                children: z.array(z.record(z.unknown())).optional(),
              })
            ),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/marketplace/categories/{id}',
  operationId: 'getMarketplaceCategory',
  tags: ['Marketplace'],
  summary: 'Get category',
  description: 'Returns a single marketplace category from the collections table.',
  request: { params: CategoryIdParamSchema },
  responses: {
    200: {
      description: 'Category',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
            success: z.boolean(),
            data: CategorySchema,
          }),
        },
      },
    },
    404: { description: 'Category not found' },
  },
});
