/**
 * Marketplace, Developer & Admin Routes
 * Mounted at /api/v1 (subpaths: /marketplace/*, /developer/*, /admin/apps/*)
 *
 * Extracted from api/index.ts (Phase 4 sub-router migration).
 * Handlers close over module-level singletons from index.ts, passed in via factory.
 *
 * NOTE: GET /marketplace/categories is registered twice — the validateApiKey
 * version is registered BEFORE the no-auth version, so Express first-match
 * keeps the authed one live. The registration order below must be preserved.
 */

import { Router, type Request, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import type { ApiKeyInfo } from '../../types/middleware/auth';
import type { PaginatedResponse } from '../../types/api/responses';
import type { MarketplaceApp } from '../../types/database/marketplace';
import { respondWithError } from '../utils/response';
import { getLimit, getOffset, toNumber, toStringParam } from '../utils/query';

type AppRouteParams = { appId: string };
type InstalledAppSummary = {
  installationId: string;
  installedAt: string;
  isActive: boolean;
  settings: Record<string, unknown> | null;
  app: MarketplaceApp;
};

type AuthenticatedHandler = (req: any, res: any, keyInfo: ApiKeyInfo) => Promise<void> | void;

type WithAuthContext = (handler: AuthenticatedHandler) => RequestHandler;

export function createMarketplaceRouter(
  supabase: SupabaseClient,
  logger: Logger,
  validateApiKey: RequestHandler,
  validateAuth: RequestHandler[],
  withAuthContext: WithAuthContext,
  requireAdminToken: RequestHandler
): Router {
  const router = Router();

  const getAppParams = (req: Request): AppRouteParams => req.params as AppRouteParams;

  // =============================================================================
  // DEVELOPER ENDPOINTS
  // =============================================================================

  // Get developer's apps
  router.get(
    '/developer/apps',
    validateApiKey,
    withAuthContext(async (_req, res, keyInfo) => {
      try {
        const { data, error } = await supabase
          .from('plugin_marketplace_apps')
          .select('*')
          .eq('developer_id', keyInfo.userId)
          .order('created_at', { ascending: false });

        if (error) {
          logger.error('Failed to fetch developer apps', { error, userId: keyInfo.userId });
          respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Failed to fetch developer apps');
          return;
        }

        res.json({
          ok: true,
          success: true,
          data: (data ?? []) as MarketplaceApp[],
        });
      } catch (error) {
        logger.error('Developer apps endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
      }
    })
  );

  // Get single app details
  router.get(
    '/developer/apps/:appId',
    validateApiKey,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { appId } = getAppParams(req);

        const { data, error } = await supabase
          .from('plugin_marketplace_apps')
          .select('*')
          .eq('id', appId)
          .eq('developer_id', keyInfo.userId)
          .single();

        if (error || !data) {
          respondWithError(res, 404, 'APP_NOT_FOUND', 'App not found');
          return;
        }

        res.json({
          ok: true,
          success: true,
          data: data as MarketplaceApp,
        });
      } catch (error) {
        logger.error('Developer app detail endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
      }
    })
  );

  // Create new app
  router.post(
    '/developer/apps',
    validateApiKey,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const payload = req.body as Partial<MarketplaceApp>;
        const now = new Date().toISOString();

        const appRecord: Partial<MarketplaceApp> = {
          ...payload,
          developer_id: keyInfo.userId,
          developer_name: keyInfo.name ?? 'Developer',
          status: 'draft',
          is_active: false,
          install_count: 0,
          created_at: now,
          updated_at: now,
        };

        const { data, error } = await supabase
          .from('plugin_marketplace_apps')
          .insert(appRecord)
          .select()
          .single();

        if (error || !data) {
          logger.error('Failed to create app', { error, userId: keyInfo.userId });
          respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Failed to create app');
          return;
        }

        res.json({
          ok: true,
          success: true,
          data: data as MarketplaceApp,
        });
      } catch (error) {
        logger.error('Create app endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
      }
    })
  );

  // Update app
  router.put(
    '/developer/apps/:appId',
    validateApiKey,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { appId } = getAppParams(req);
        const now = new Date().toISOString();
        const updates: Partial<MarketplaceApp> = {
          ...(req.body as Partial<MarketplaceApp>),
          updated_at: now,
        };

        delete (updates as Record<string, unknown>).status;

        const { data, error } = await supabase
          .from('plugin_marketplace_apps')
          .update(updates)
          .eq('id', appId)
          .eq('developer_id', keyInfo.userId)
          .select()
          .single();

        if (error || !data) {
          respondWithError(res, 404, 'APP_NOT_FOUND', 'App not found or unauthorized');
          return;
        }

        res.json({
          ok: true,
          success: true,
          data: data as MarketplaceApp,
        });
      } catch (error) {
        logger.error('Update app endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
      }
    })
  );

  // Delete app (only if in draft status)
  router.delete(
    '/developer/apps/:appId',
    validateApiKey,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { appId } = getAppParams(req);

        const { data: app } = await supabase
          .from('plugin_marketplace_apps')
          .select('status')
          .eq('id', appId)
          .eq('developer_id', keyInfo.userId)
          .single();

        if (!app) {
          respondWithError(res, 404, 'APP_NOT_FOUND', 'App not found');
          return;
        }

        if (app.status !== 'draft') {
          respondWithError(
            res,
            403,
            'INVALID_STATE',
            'Cannot delete apps that are not in draft status'
          );
          return;
        }

        const { error } = await supabase
          .from('plugin_marketplace_apps')
          .delete()
          .eq('id', appId)
          .eq('developer_id', keyInfo.userId);

        if (error) {
          logger.error('Failed to delete app', { error, appId, userId: keyInfo.userId });
          respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Failed to delete app');
          return;
        }

        res.json({
          ok: true,
          success: true,
          message: 'App deleted successfully',
        });
      } catch (error) {
        logger.error('Delete app endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
      }
    })
  );

  // Submit app for review
  router.post(
    '/developer/apps/:appId/submit',
    validateApiKey,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { appId } = getAppParams(req);
        const now = new Date().toISOString();

        const { data, error } = await supabase
          .from('plugin_marketplace_apps')
          .update({
            status: 'pending_review',
            submitted_at: now,
            updated_at: now,
          })
          .eq('id', appId)
          .eq('developer_id', keyInfo.userId)
          .eq('status', 'draft')
          .select()
          .single();

        if (error || !data) {
          respondWithError(res, 404, 'APP_NOT_FOUND', 'App not found or already submitted');
          return;
        }

        res.json({
          ok: true,
          success: true,
          data: data as MarketplaceApp,
        });
      } catch (error) {
        logger.error('Submit app endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
      }
    })
  );

  // Resubmit app after rejection
  router.post(
    '/developer/apps/:appId/resubmit',
    validateApiKey,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { appId } = getAppParams(req);
        const now = new Date().toISOString();
        const updates = req.body as Partial<MarketplaceApp>;

        const { data, error } = await supabase
          .from('plugin_marketplace_apps')
          .update({
            ...updates,
            status: 'pending_review',
            submitted_at: now,
            updated_at: now,
            reviewer_notes: null,
            reviewed_at: null,
            reviewed_by: null,
          })
          .eq('id', appId)
          .eq('developer_id', keyInfo.userId)
          .eq('status', 'rejected')
          .select()
          .single();

        if (error || !data) {
          respondWithError(res, 404, 'APP_NOT_FOUND', 'App not found or not in rejected status');
          return;
        }

        res.json({
          ok: true,
          success: true,
          data: data as MarketplaceApp,
        });
      } catch (error) {
        logger.error('Resubmit app endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
      }
    })
  );

  // =============================================================================
  // MARKETPLACE ENDPOINTS
  // =============================================================================

  // Get all approved marketplace apps with optional filtering
  router.get('/marketplace/apps', validateApiKey, async (req, res) => {
    try {
      const limit = getLimit(req.query.limit, 20, 100);
      const offset = getOffset(req.query.offset, 0);
      const categoryFilter = toStringParam(req.query.category);
      const searchTerm = toStringParam(req.query.search);

      let query = supabase
        .from('plugin_marketplace_apps')
        .select(
          `
          id,
          name,
          slug,
          tagline,
          description,
          category,
          icon_url,
          screenshots,
          version,
          pricing_model,
          pricing_config,
          install_count,
          developer_id,
          developer_name,
          created_at,
          updated_at
        `
        )
        .eq('status', 'approved')
        .eq('is_active', true)
        .order('install_count', { ascending: false });

      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
      }

      if (searchTerm) {
        const escaped = searchTerm.replace(/%/g, '\\%').replace(/_/g, '\\_');
        query = query.or(
          `name.ilike.%${escaped}%,tagline.ilike.%${escaped}%,description.ilike.%${escaped}%`
        );
      }

      const { data, error } = await query.range(offset, offset + limit - 1);

      if (error) {
        logger.error('Failed to fetch marketplace apps', {
          error,
          limit,
          offset,
          categoryFilter,
          searchTerm,
        });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
        return;
      }

      const apps = (data ?? []) as MarketplaceApp[];
      const pagination = {
        page: limit === 0 ? 1 : Math.floor(offset / limit) + 1,
        limit,
        total: apps.length,
        totalPages: limit === 0 ? 0 : Math.ceil(apps.length / limit),
      };

      const response: PaginatedResponse<MarketplaceApp> = {
        ok: true,
        success: true,
        data: apps,
        meta: { pagination },
      };

      res.json(response);
    } catch (error) {
      logger.error('Marketplace apps endpoint error', { error });
      respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
    }
  });

  // Get trending apps
  router.get('/marketplace/trending', validateApiKey, async (req, res) => {
    try {
      const limit = getLimit(req.query.limit, 10, 50);

      const { data, error } = await supabase
        .from('plugin_marketplace_apps')
        .select(
          `
          id,
          name,
          slug,
          tagline,
          category,
          icon_url,
          install_count,
          developer_name
        `
        )
        .eq('status', 'approved')
        .eq('is_active', true)
        .order('install_count', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch trending apps', { error });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
        return;
      }

      res.json({
        ok: true,
        success: true,
        data: (data ?? []) as MarketplaceApp[],
      });
    } catch (error) {
      logger.error('Trending apps endpoint error', { error });
      respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
    }
  });

  // Get featured apps
  router.get('/marketplace/featured', validateApiKey, async (req, res) => {
    try {
      const limit = getLimit(req.query.limit, 6, 50);

      const { data, error } = await supabase
        .from('plugin_marketplace_apps')
        .select(
          `
          id,
          name,
          slug,
          tagline,
          category,
          icon_url,
          install_count,
          developer_name
        `
        )
        .eq('status', 'approved')
        .eq('is_active', true)
        .eq('is_featured', true)
        .order('featured_order', { ascending: true })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch featured apps', { error });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
        return;
      }

      res.json({
        ok: true,
        success: true,
        data: (data ?? []) as MarketplaceApp[],
      });
    } catch (error) {
      logger.error('Featured apps endpoint error', { error });
      respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
    }
  });

  // Get app categories
  router.get('/marketplace/categories', validateApiKey, async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from('plugin_marketplace_apps')
        .select('category')
        .eq('status', 'approved')
        .eq('is_active', true);

      if (error) {
        logger.error('Failed to fetch categories', { error });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
        return;
      }

      const categoryCounts = new Map<string, number>();
      (data ?? []).forEach((app) => {
        if (app?.category) {
          categoryCounts.set(app.category, (categoryCounts.get(app.category) ?? 0) + 1);
        }
      });

      const formatted = Array.from(categoryCounts.entries()).map(([category, count]) => ({
        category,
        count,
      }));

      res.json({
        ok: true,
        success: true,
        data: formatted,
      });
    } catch (error) {
      logger.error('Categories endpoint error', { error });
      respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
    }
  });

  // Get single app details
  router.get('/marketplace/apps/:appId', validateApiKey, async (req, res) => {
    const { appId } = getAppParams(req);
    try {
      const { data, error } = await supabase
        .from('plugin_marketplace_apps')
        .select(
          `
          *,
          plugin_versions (
            id,
            version,
            release_notes,
            created_at
          )
        `
        )
        .eq('id', appId)
        .eq('status', 'approved')
        .single();

      if (error || !data) {
        respondWithError(res, 404, 'APP_NOT_FOUND', 'App not found');
        return;
      }

      res.json({
        ok: true,
        success: true,
        data,
      });
    } catch (error) {
      logger.error('App detail endpoint error', { error, appId });
      respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Internal server error');
    }
  });

  // Get user's installed apps
  router.get(
    '/marketplace/installed',
    validateAuth,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const limit = getLimit(req.query.limit, 50, 100);
        const offset = getOffset(req.query.offset, 0);

        const { data, error } = await supabase
          .from('user_app_installs')
          .select(
            `
          id,
          app_id,
          installed_at,
          is_active,
          app_settings,
          plugin_marketplace_apps!user_app_installs_app_id_fkey (
            id,
            name,
            slug,
            tagline,
            description,
            category,
            icon_url,
            version,
            developer_name,
            install_count
          )
        `
          )
          .eq('user_id', keyInfo.userId)
          .eq('is_active', true)
          .order('installed_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          logger.error('Failed to fetch installed apps', { error, userId: keyInfo.userId });
          respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
          return;
        }

        type InstallRow = {
          id: string;
          app_id: string;
          installed_at: string;
          is_active: boolean;
          app_settings: Record<string, unknown> | null;
          plugin_marketplace_apps: MarketplaceApp;
        };

        const installs: InstalledAppSummary[] = ((data ?? []) as unknown as InstallRow[]).map(
          (install) => ({
            installationId: install.id,
            installedAt: install.installed_at,
            isActive: install.is_active,
            settings: install.app_settings,
            app: install.plugin_marketplace_apps,
          })
        );

        const pagination = {
          page: limit === 0 ? 1 : Math.floor(offset / limit) + 1,
          limit,
          total: installs.length,
          totalPages: limit === 0 ? 0 : Math.ceil(installs.length / limit),
        };

        const response: PaginatedResponse<InstalledAppSummary> = {
          ok: true,
          success: true,
          data: installs,
          meta: { pagination },
        };

        res.json(response);
      } catch (error) {
        logger.error('Installed apps endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
      }
    })
  );

  // Install an app
  router.post(
    '/marketplace/install/:appId',
    validateAuth,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { appId } = getAppParams(req);
        const { settings = {} } = req.body as { settings?: Record<string, unknown> };

        const { data: app, error: appError } = await supabase
          .from('plugin_marketplace_apps')
          .select('id, name, status')
          .eq('id', appId)
          .eq('status', 'approved')
          .eq('is_active', true)
          .single();

        if (appError || !app) {
          respondWithError(
            res,
            404,
            'APP_NOT_FOUND',
            'App not found or not available for installation'
          );
          return;
        }

        const { data: existingInstall } = await supabase
          .from('user_app_installs')
          .select('id')
          .eq('user_id', keyInfo.userId)
          .eq('app_id', appId)
          .eq('is_active', true)
          .single();

        if (existingInstall) {
          respondWithError(res, 409, 'APP_ALREADY_INSTALLED', 'App is already installed');
          return;
        }

        const now = new Date().toISOString();
        const { data: installation, error: installError } = await supabase
          .from('user_app_installs')
          .insert({
            user_id: keyInfo.userId,
            app_id: appId,
            installed_at: now,
            is_active: true,
            app_settings: settings,
          })
          .select()
          .single();

        if (installError || !installation) {
          logger.error('Failed to install app', { installError, appId, userId: keyInfo.userId });
          respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to install app');
          return;
        }

        await supabase.rpc('increment_install_count', { app_id_in: appId });

        res.json({
          ok: true,
          success: true,
          data: {
            installationId: installation.id,
            appId,
            installedAt: installation.installed_at,
            message: `Successfully installed ${app.name}`,
          },
        });
      } catch (error) {
        logger.error('Install app endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
      }
    })
  );

  // Uninstall an app
  router.delete(
    '/marketplace/uninstall/:appId',
    validateAuth,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { appId } = getAppParams(req);

        const { data: installation, error: checkError } = await supabase
          .from('user_app_installs')
          .select('id, plugin_marketplace_apps(name)')
          .eq('user_id', keyInfo.userId)
          .eq('app_id', appId)
          .eq('is_active', true)
          .single();

        if (checkError || !installation) {
          respondWithError(res, 404, 'APP_NOT_INSTALLED', 'App is not installed');
          return;
        }

        const { error: uninstallError } = await supabase
          .from('user_app_installs')
          .update({ is_active: false, uninstalled_at: new Date().toISOString() })
          .eq('id', installation.id)
          .eq('user_id', keyInfo.userId);

        if (uninstallError) {
          logger.error('Failed to uninstall app', {
            uninstallError,
            appId,
            userId: keyInfo.userId,
          });
          respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to uninstall app');
          return;
        }

        await supabase.rpc('decrement_install_count', { app_id_in: appId });

        type UninstallRow = typeof installation & {
          plugin_marketplace_apps?: { name?: string } | null;
        };

        const installRecord = installation as UninstallRow;
        const appName = installRecord.plugin_marketplace_apps?.name ?? 'app';

        res.json({
          ok: true,
          success: true,
          data: {
            message: `Successfully uninstalled ${appName}`,
          },
        });
      } catch (error) {
        logger.error('Uninstall app endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
      }
    })
  );

  // =============================================================================
  // MARKETPLACE ITEMS ENDPOINTS (OrivaFlow Commerce)
  // =============================================================================

  // List/search marketplace items (public)
  router.get('/marketplace/items', async (req, res) => {
    try {
      const limit = getLimit(req.query.limit, 20, 100);
      const offset = getOffset(req.query.offset, 0);
      const itemType = toStringParam(req.query.item_type);
      const earnerType = toStringParam(req.query.earner_type);
      const categoryId = toStringParam(req.query.category_id);
      const minPrice = req.query.min_price ? toNumber(req.query.min_price, 0) : undefined;
      const maxPrice = req.query.max_price ? toNumber(req.query.max_price, 0) : undefined;
      const sellerId = toStringParam(req.query.seller_id);
      const searchTerm = toStringParam(req.query.search);

      let query = supabase
        .from('entries')
        .select('*', { count: 'exact' })
        .eq('entry_type', 'marketplace_item')
        .eq('marketplace_metadata->>is_published', 'true');

      if (itemType) {
        query = query.eq('marketplace_metadata->>item_type', itemType);
      }

      if (earnerType) {
        query = query.eq('marketplace_metadata->>earner_type', earnerType);
      }

      if (categoryId) {
        query = query.contains('marketplace_metadata->category_ids', [categoryId]);
      }

      if (minPrice !== undefined) {
        query = query.gte('marketplace_metadata->>price', minPrice);
      }

      if (maxPrice !== undefined) {
        query = query.lte('marketplace_metadata->>price', maxPrice);
      }

      if (sellerId) {
        query = query.eq('user_id', sellerId);
      }

      if (searchTerm) {
        const escaped = searchTerm.replace(/%/g, '\\%').replace(/_/g, '\\_');
        query = query.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`);
      }

      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch marketplace items', { error });
        respondWithError(res, 500, 'MARKETPLACE_ITEMS_ERROR', 'Failed to fetch items');
        return;
      }

      const pagination = {
        page: limit === 0 ? 1 : Math.floor(offset / limit) + 1,
        limit,
        total: count || 0,
        totalPages: limit === 0 ? 0 : Math.ceil((count || 0) / limit),
      };

      res.json({
        ok: true,
        success: true,
        data: data || [],
        meta: { pagination },
      });
    } catch (error) {
      logger.error('Marketplace items endpoint error', { error });
      respondWithError(res, 500, 'MARKETPLACE_ITEMS_ERROR', 'Failed to fetch items');
    }
  });

  // Create marketplace item (auth required)
  router.post(
    '/marketplace/items',
    validateAuth,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { title, content, marketplace_metadata } = req.body as {
          title: string;
          content?: string;
          marketplace_metadata: Record<string, unknown>;
        };

        // Validation
        if (!title || title.trim() === '') {
          respondWithError(res, 400, 'VALIDATION_ERROR', 'Title is required');
          return;
        }

        if (!marketplace_metadata?.price && marketplace_metadata?.price !== 0) {
          respondWithError(res, 400, 'VALIDATION_ERROR', 'Price is required');
          return;
        }

        if (!marketplace_metadata?.currency) {
          respondWithError(res, 400, 'VALIDATION_ERROR', 'Currency is required');
          return;
        }

        if (typeof marketplace_metadata.price === 'number' && marketplace_metadata.price < 0) {
          respondWithError(
            res,
            400,
            'VALIDATION_ERROR',
            'Price must be greater than or equal to 0'
          );
          return;
        }

        const now = new Date().toISOString();
        const itemData = {
          title,
          content: content || '',
          entry_type: 'marketplace_item',
          user_id: keyInfo.userId,
          marketplace_metadata: {
            ...marketplace_metadata,
            is_published: false, // Default to unpublished
          },
          created_at: now,
          updated_at: now,
        };

        const { data, error } = await supabase.from('entries').insert(itemData).select().single();

        if (error) {
          logger.error('Failed to create marketplace item', { error, userId: keyInfo.userId });
          if (error.code === '23505') {
            respondWithError(
              res,
              409,
              'DUPLICATE_ERROR',
              'Duplicate SKU or unique constraint violation'
            );
            return;
          }
          respondWithError(res, 500, 'MARKETPLACE_ITEMS_ERROR', 'Failed to create item');
          return;
        }

        logger.info('Marketplace item created', { itemId: data.id, userId: keyInfo.userId });
        res.status(201).json({
          ok: true,
          success: true,
          data,
        });
      } catch (error) {
        logger.error('Create marketplace item error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'MARKETPLACE_ITEMS_ERROR', 'Failed to create item');
      }
    })
  );

  // Get single marketplace item (public)
  router.get('/marketplace/items/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('id', id)
        .eq('entry_type', 'marketplace_item')
        .single();

      if (error || !data) {
        respondWithError(res, 404, 'ITEM_NOT_FOUND', 'Marketplace item not found');
        return;
      }

      // Check if published (unpublished items hidden from public)
      const isPublished = data.marketplace_metadata?.is_published;
      if (!isPublished) {
        respondWithError(res, 404, 'ITEM_NOT_FOUND', 'Marketplace item not found');
        return;
      }

      res.json({
        ok: true,
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Get marketplace item error', { error, itemId: req.params.id });
      respondWithError(res, 500, 'MARKETPLACE_ITEMS_ERROR', 'Failed to retrieve item');
    }
  });

  // Update marketplace item (owner only)
  router.put(
    '/marketplace/items/:id',
    validateAuth,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { id } = req.params;
        const { title, content, marketplace_metadata } = req.body as {
          title?: string;
          content?: string;
          marketplace_metadata?: Record<string, unknown>;
        };

        // Validate metadata if provided
        if (
          marketplace_metadata?.price !== undefined &&
          typeof marketplace_metadata.price === 'number'
        ) {
          if (marketplace_metadata.price < 0) {
            respondWithError(
              res,
              400,
              'VALIDATION_ERROR',
              'Price must be greater than or equal to 0'
            );
            return;
          }
        }

        const updates = {
          ...(title && { title }),
          ...(content !== undefined && { content }),
          ...(marketplace_metadata && { marketplace_metadata }),
          updated_at: new Date().toISOString(),
        };

        // Update item (RLS enforces ownership via user_id match)
        const { data, error } = await supabase
          .from('entries')
          .update(updates)
          .eq('id', id)
          .eq('user_id', keyInfo.userId)
          .eq('entry_type', 'marketplace_item')
          .select()
          .single();

        if (error || !data) {
          logger.error('Failed to update marketplace item', {
            error,
            itemId: id,
            userId: keyInfo.userId,
          });
          respondWithError(res, 404, 'ITEM_NOT_FOUND', 'Item not found or permission denied');
          return;
        }

        logger.info('Marketplace item updated', { itemId: id, userId: keyInfo.userId });
        res.json({
          ok: true,
          success: true,
          data,
        });
      } catch (error) {
        logger.error('Update marketplace item error', {
          error,
          itemId: req.params.id,
          userId: keyInfo.userId,
        });
        respondWithError(res, 500, 'MARKETPLACE_ITEMS_ERROR', 'Failed to update item');
      }
    })
  );

  // Delete marketplace item (owner only)
  router.delete(
    '/marketplace/items/:id',
    validateAuth,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { id } = req.params;

        // Delete item (RLS enforces ownership)
        const { error } = await supabase
          .from('entries')
          .delete()
          .eq('id', id)
          .eq('user_id', keyInfo.userId)
          .eq('entry_type', 'marketplace_item');

        if (error) {
          logger.error('Failed to delete marketplace item', {
            error,
            itemId: id,
            userId: keyInfo.userId,
          });
          respondWithError(res, 404, 'ITEM_NOT_FOUND', 'Item not found or permission denied');
          return;
        }

        logger.info('Marketplace item deleted', { itemId: id, userId: keyInfo.userId });
        res.json({
          ok: true,
          success: true,
          message: 'Item deleted successfully',
        });
      } catch (error) {
        logger.error('Delete marketplace item error', {
          error,
          itemId: req.params.id,
          userId: keyInfo.userId,
        });
        respondWithError(res, 500, 'MARKETPLACE_ITEMS_ERROR', 'Failed to delete item');
      }
    })
  );

  // =============================================================================
  // MARKETPLACE SEARCH ENDPOINT
  // =============================================================================

  // Advanced search (public)
  router.post('/marketplace/search', async (req, res) => {
    try {
      const {
        query: searchQuery,
        filters = {},
        sort = 'created_at',
        order = 'desc',
        page = 1,
        limit: requestLimit = 20,
      } = req.body as {
        query?: string;
        filters?: Record<string, unknown>;
        sort?: string;
        order?: 'asc' | 'desc';
        page?: number;
        limit?: number;
      };

      const limit = getLimit(requestLimit, 20, 100);
      const offset = (page - 1) * limit;

      let query = supabase
        .from('entries')
        .select('*', { count: 'exact' })
        .eq('entry_type', 'marketplace_item')
        .eq('marketplace_metadata->>is_published', 'true');

      // Apply search query
      if (searchQuery && searchQuery.trim() !== '') {
        const escaped = searchQuery.replace(/%/g, '\\%').replace(/_/g, '\\_');
        query = query.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`);
      }

      // Apply filters
      if (filters.item_type) {
        query = query.eq('marketplace_metadata->>item_type', filters.item_type);
      }

      if (filters.category_id) {
        query = query.contains('marketplace_metadata->category_ids', [filters.category_id]);
      }

      if (filters.min_price !== undefined) {
        query = query.gte('marketplace_metadata->>price', filters.min_price);
      }

      if (filters.max_price !== undefined) {
        query = query.lte('marketplace_metadata->>price', filters.max_price);
      }

      if (filters.seller_id) {
        query = query.eq('user_id', filters.seller_id);
      }

      // Apply sorting
      const validSortFields = ['created_at', 'updated_at', 'title'];
      const sortField = validSortFields.includes(sort) ? sort : 'created_at';
      query = query.order(sortField, { ascending: order === 'asc' });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to search marketplace items', { error });
        respondWithError(res, 500, 'SEARCH_ERROR', 'Failed to search items');
        return;
      }

      const pagination = {
        page,
        limit,
        total: count || 0,
        totalPages: limit === 0 ? 0 : Math.ceil((count || 0) / limit),
      };

      res.json({
        ok: true,
        success: true,
        data: data || [],
        meta: {
          pagination,
          query: searchQuery,
          filters,
          sort: { field: sortField, order },
        },
      });
    } catch (error) {
      logger.error('Marketplace search error', { error });
      respondWithError(res, 500, 'SEARCH_ERROR', 'Failed to search items');
    }
  });

  // =============================================================================
  // MARKETPLACE CATEGORIES ENDPOINTS
  // =============================================================================

  // List categories (public)
  router.get('/marketplace/categories', async (req, res) => {
    try {
      const parentId = req.query.parent_id ? toStringParam(req.query.parent_id) : undefined;

      let query = supabase
        .from('collections')
        .select('*')
        .eq('collection_type', 'marketplace_category')
        .order('organization_rules->display_order', { ascending: true });

      // Filter by parent_id
      if (parentId !== undefined) {
        if (parentId === 'null' || parentId === '') {
          query = query.is('organization_rules->>parent_category_id', null);
        } else {
          query = query.eq('organization_rules->>parent_category_id', parentId);
        }
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch categories', { error });
        respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to fetch categories');
        return;
      }

      res.json({
        ok: true,
        success: true,
        data: data || [],
      });
    } catch (error) {
      logger.error('Categories endpoint error', { error });
      respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to fetch categories');
    }
  });

  // Create category (admin only)
  router.post(
    '/marketplace/categories',
    validateAuth,
    requireAdminToken,
    withAuthContext(async (req, res) => {
      try {
        const { name, description, organization_rules } = req.body as {
          name: string;
          description?: string;
          organization_rules: Record<string, unknown>;
        };

        // Validation
        if (!name || name.trim() === '') {
          respondWithError(res, 400, 'VALIDATION_ERROR', 'Category name is required');
          return;
        }

        if (name.length > 255) {
          respondWithError(
            res,
            400,
            'VALIDATION_ERROR',
            'Category name too long (max 255 characters)'
          );
          return;
        }

        // Auto-generate SEO slug if not provided
        const seoSlug =
          organization_rules?.seo_slug ||
          name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');

        const now = new Date().toISOString();
        const categoryData = {
          name,
          description: description || null,
          collection_type: 'marketplace_category',
          organization_rules: {
            ...organization_rules,
            seo_slug: seoSlug,
          },
          entry_count: 0,
          created_at: now,
          updated_at: now,
        };

        const { data, error } = await supabase
          .from('collections')
          .insert(categoryData)
          .select()
          .single();

        if (error) {
          logger.error('Failed to create category', { error });
          if (error.code === '23505') {
            respondWithError(res, 409, 'DUPLICATE_ERROR', 'Duplicate category name or SEO slug');
            return;
          }
          respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to create category');
          return;
        }

        logger.info('Category created', { categoryId: data.id });
        res.status(201).json({
          ok: true,
          success: true,
          data,
        });
      } catch (error) {
        logger.error('Create category error', { error });
        respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to create category');
      }
    })
  );

  // Get category tree hierarchy (public)
  router.get('/marketplace/categories/tree', async (req, res) => {
    try {
      // Get all categories
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('collection_type', 'marketplace_category')
        .order('organization_rules->display_order', { ascending: true });

      if (error) {
        logger.error('Failed to fetch categories for tree', { error });
        respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to fetch categories');
        return;
      }

      const categories = data || [];

      // Build tree structure
      type CategoryNode = (typeof categories)[0] & { children: CategoryNode[] };
      const categoryMap = new Map<string, CategoryNode>();
      const rootNodes: CategoryNode[] = [];

      // First pass: create nodes
      categories.forEach((category) => {
        categoryMap.set(category.id, { ...category, children: [] });
      });

      // Second pass: build hierarchy
      categories.forEach((category) => {
        const node = categoryMap.get(category.id)!;
        const parentId = category.organization_rules?.parent_category_id;

        if (parentId && categoryMap.has(parentId)) {
          const parent = categoryMap.get(parentId)!;
          parent.children.push(node);
        } else if (!parentId) {
          rootNodes.push(node);
        }
      });

      res.json({
        ok: true,
        success: true,
        data: rootNodes,
      });
    } catch (error) {
      logger.error('Category tree error', { error });
      respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to build category tree');
    }
  });

  // Get single category (public)
  router.get('/marketplace/categories/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('id', id)
        .eq('collection_type', 'marketplace_category')
        .single();

      if (error || !data) {
        respondWithError(res, 404, 'CATEGORY_NOT_FOUND', 'Category not found');
        return;
      }

      res.json({
        ok: true,
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Get category error', { error, categoryId: req.params.id });
      respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to retrieve category');
    }
  });

  // Update category (admin only)
  router.put(
    '/marketplace/categories/:id',
    validateAuth,
    requireAdminToken,
    withAuthContext(async (req, res) => {
      try {
        const { id } = req.params;
        const { name, description, organization_rules } = req.body as {
          name?: string;
          description?: string;
          organization_rules?: Record<string, unknown>;
        };

        // Validation
        if (name !== undefined) {
          if (name.trim() === '') {
            respondWithError(res, 400, 'VALIDATION_ERROR', 'Category name cannot be empty');
            return;
          }
          if (name.length > 255) {
            respondWithError(
              res,
              400,
              'VALIDATION_ERROR',
              'Category name too long (max 255 characters)'
            );
            return;
          }
        }

        // Auto-update SEO slug if name changes and slug not explicitly provided
        let updatedOrgRules = organization_rules;
        if (name && !organization_rules?.seo_slug) {
          const seoSlug = name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');

          updatedOrgRules = {
            ...organization_rules,
            seo_slug: seoSlug,
          };
        }

        const updates = {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(updatedOrgRules && { organization_rules: updatedOrgRules }),
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from('collections')
          .update(updates)
          .eq('id', id)
          .eq('collection_type', 'marketplace_category')
          .select()
          .single();

        if (error || !data) {
          logger.error('Failed to update category', { error, categoryId: id });
          respondWithError(
            res,
            404,
            'CATEGORY_NOT_FOUND',
            'Category not found or permission denied'
          );
          return;
        }

        logger.info('Category updated', { categoryId: id });
        res.json({
          ok: true,
          success: true,
          data,
        });
      } catch (error) {
        logger.error('Update category error', { error, categoryId: req.params.id });
        respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to update category');
      }
    })
  );

  // Delete category (admin only)
  router.delete(
    '/marketplace/categories/:id',
    validateAuth,
    requireAdminToken,
    withAuthContext(async (req, res) => {
      try {
        const { id } = req.params;

        // Check if category has items
        const { data: categoryData, error: fetchError } = await supabase
          .from('collections')
          .select('entry_count')
          .eq('id', id)
          .eq('collection_type', 'marketplace_category')
          .single();

        if (fetchError) {
          respondWithError(res, 404, 'CATEGORY_NOT_FOUND', 'Category not found');
          return;
        }

        if (categoryData.entry_count > 0) {
          respondWithError(res, 409, 'CATEGORY_HAS_ITEMS', 'Cannot delete category with items');
          return;
        }

        // Check if category has sub-categories
        const { data: subCategories } = await supabase
          .from('collections')
          .select('id')
          .eq('collection_type', 'marketplace_category')
          .eq('organization_rules->>parent_category_id', id);

        if (subCategories && subCategories.length > 0) {
          respondWithError(
            res,
            409,
            'CATEGORY_HAS_CHILDREN',
            'Cannot delete category with sub-categories'
          );
          return;
        }

        // Delete category
        const { error } = await supabase
          .from('collections')
          .delete()
          .eq('id', id)
          .eq('collection_type', 'marketplace_category');

        if (error) {
          logger.error('Failed to delete category', { error, categoryId: id });
          respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to delete category');
          return;
        }

        logger.info('Category deleted', { categoryId: id });
        res.json({
          ok: true,
          success: true,
          message: 'Category deleted successfully',
        });
      } catch (error) {
        logger.error('Delete category error', { error, categoryId: req.params.id });
        respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to delete category');
      }
    })
  );

  // =============================================================================
  // ADMIN ENDPOINTS FOR APP APPROVAL
  // =============================================================================

  // Get pending apps for review (admin only)
  router.get(
    '/admin/apps/pending',
    validateApiKey,
    requireAdminToken,
    withAuthContext(async (_req, res) => {
      try {
        const { data, error } = await supabase
          .from('plugin_marketplace_apps')
          .select('*')
          .eq('status', 'pending_review')
          .order('created_at', { ascending: true });

        if (error) {
          logger.error('Failed to fetch pending apps', { error });
          respondWithError(res, 500, 'ADMIN_APPS_ERROR', 'Failed to fetch apps');
          return;
        }

        res.json({
          ok: true,
          success: true,
          data: data ?? [],
        });
      } catch (error) {
        logger.error('Pending apps endpoint error', { error });
        respondWithError(res, 500, 'ADMIN_APPS_ERROR', 'Failed to fetch apps');
      }
    })
  );

  // Approve or reject an app (admin only)
  router.post(
    '/admin/apps/:appId/review',
    validateApiKey,
    requireAdminToken,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { appId } = getAppParams(req);
        const { status, reviewerNotes } = req.body as { status?: string; reviewerNotes?: string };

        if (!status || !['approved', 'rejected'].includes(status)) {
          respondWithError(
            res,
            400,
            'INVALID_STATUS',
            'Invalid status. Must be "approved" or "rejected"'
          );
          return;
        }

        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('plugin_marketplace_apps')
          .update({
            status,
            reviewer_notes: reviewerNotes ?? null,
            reviewed_at: now,
            reviewed_by: keyInfo.userId,
          })
          .eq('id', appId)
          .select()
          .single();

        if (error || !data) {
          logger.error('Failed to update app status', { error, appId, status });
          respondWithError(res, 500, 'ADMIN_APPS_ERROR', 'Failed to fetch apps');
          return;
        }

        res.json({
          ok: true,
          success: true,
          data,
        });
      } catch (error) {
        logger.error('App review endpoint error', {
          error,
          appId: getAppParams(req).appId,
          reviewer: keyInfo.userId,
        });
        respondWithError(res, 500, 'ADMIN_APPS_ERROR', 'Failed to fetch apps');
      }
    })
  );

  return router;
}
