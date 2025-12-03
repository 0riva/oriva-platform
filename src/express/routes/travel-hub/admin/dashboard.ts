/**
 * Dashboard Route (Master Admin)
 * Combined endpoint to fetch all dashboard data in a single request
 *
 * GET /api/v1/travel-hub/admin/dashboard - Get all dashboard data
 */

import { Router, Request, Response } from 'express';
import { getSupabase } from '../../../middleware/schemaRouter';
import { logger } from '../../../../utils/logger';

const router = Router();
const SCHEMA = 'travel_hub';

/**
 * GET /api/v1/travel-hub/admin/dashboard
 * Fetch all dashboard data in a single request with parallel queries
 * Returns: organizations stats, system users count, recent orgs, recent activity, audit stats
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const supabase = getSupabase(req);

    // Define time windows for audit stats
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dayBefore = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Execute all queries in parallel for maximum performance
    const [
      // Organizations queries
      orgsResult,
      activeOrgsResult,
      // System users count
      systemUsersResult,
      // Recent activity
      recentActivityResult,
      // Audit stats queries
      totalActionsResult,
      last24hResult,
      previous24hResult,
      actionsRawResult,
    ] = await Promise.all([
      // 1. Recent organizations (limit 5)
      supabase
        .schema(SCHEMA)
        .from('organizations')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(5),

      // 2. Active organizations count
      supabase
        .schema(SCHEMA)
        .from('organizations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),

      // 3. Active system users count
      supabase
        .schema(SCHEMA)
        .from('system_users')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),

      // 4. Recent audit activity (limit 10)
      supabase
        .schema(SCHEMA)
        .from('admin_audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(10),

      // 5. Total actions in last 30 days
      supabase
        .schema(SCHEMA)
        .from('admin_audit_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString())
        .lte('created_at', now.toISOString()),

      // 6. Actions in last 24 hours
      supabase
        .schema(SCHEMA)
        .from('admin_audit_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString()),

      // 7. Actions in previous 24 hours (for comparison)
      supabase
        .schema(SCHEMA)
        .from('admin_audit_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dayBefore.toISOString())
        .lt('created_at', yesterday.toISOString()),

      // 8. Actions by type (for breakdown)
      supabase
        .schema(SCHEMA)
        .from('admin_audit_log')
        .select('action')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .lte('created_at', now.toISOString())
        .limit(1000),
    ]);

    // Process actions by type
    const actionCounts: Record<string, number> = {};
    (actionsRawResult.data || []).forEach((entry) => {
      actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
    });

    // Calculate change percentage
    const last24h = last24hResult.count || 0;
    const previous24h = previous24hResult.count || 0;
    const changePercent =
      previous24h > 0 ? Math.round(((last24h - previous24h) / previous24h) * 100) : null;

    const duration = Date.now() - startTime;
    logger.info('[Dashboard] Data fetched', { duration: `${duration}ms` });

    res.json({
      ok: true,
      data: {
        // Stats summary
        stats: {
          totalOrganizations: orgsResult.count || 0,
          activeOrganizations: activeOrgsResult.count || 0,
          totalSystemUsers: systemUsersResult.count || 0,
          recentActivity: last24h,
        },

        // Recent organizations (for list)
        recentOrganizations: orgsResult.data || [],

        // Recent activity (for list)
        recentActivity: recentActivityResult.data || [],

        // Audit stats (for charts/breakdown)
        auditStats: {
          period: {
            from: thirtyDaysAgo.toISOString(),
            to: now.toISOString(),
          },
          summary: {
            totalActions: totalActionsResult.count || 0,
            last24Hours: last24h,
            previous24Hours: previous24h,
            changePercent,
          },
          actionsByType: Object.entries(actionCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([action, count]) => ({ action, count })),
        },
      },
      meta: {
        fetchDuration: `${duration}ms`,
      },
    });
  } catch (error: any) {
    logger.error('[Dashboard] Unexpected error', { error });
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
