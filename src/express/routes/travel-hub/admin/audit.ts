/**
 * Audit Log Routes (Master Admin)
 * View admin actions audit trail
 *
 * GET /api/v1/travel-hub/admin/audit - List audit log entries
 * GET /api/v1/travel-hub/admin/audit/stats - Get audit statistics
 */

import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { getSupabase } from '../../../middleware/schemaRouter';
import { logger } from '../../../../utils/logger';

const router = Router();
const SCHEMA = 'travel_hub';

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, errors: errors.array() });
  }
  next();
};

/**
 * GET /api/v1/travel-hub/admin/audit
 * List audit log entries with filtering
 */
router.get(
  '/',
  [
    query('user_id').optional().isUUID(),
    query('action').optional().isString(),
    query('entity_type').optional().isString(),
    query('entity_id').optional().isUUID(),
    query('from_date').optional().isISO8601(),
    query('to_date').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const {
        user_id,
        action,
        entity_type,
        entity_id,
        from_date,
        to_date,
        limit = 50,
        offset = 0,
      } = req.query;

      let queryBuilder = supabase
        .schema(SCHEMA)
        .from('admin_audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (user_id) {
        queryBuilder = queryBuilder.eq('user_id', user_id);
      }

      if (action) {
        queryBuilder = queryBuilder.eq('action', action);
      }

      if (entity_type) {
        queryBuilder = queryBuilder.eq('entity_type', entity_type);
      }

      if (entity_id) {
        queryBuilder = queryBuilder.eq('entity_id', entity_id);
      }

      if (from_date) {
        queryBuilder = queryBuilder.gte('created_at', from_date);
      }

      if (to_date) {
        queryBuilder = queryBuilder.lte('created_at', to_date);
      }

      const { data, error, count } = await queryBuilder;

      if (error) {
        logger.error('[AuditLog] Error listing audit entries', { error });
        return res.status(500).json({ ok: false, error: error.message });
      }

      res.json({
        ok: true,
        data,
        pagination: {
          total: count || 0,
          limit: Number(limit),
          offset: Number(offset),
        },
      });
    } catch (error: any) {
      logger.error('[AuditLog] Unexpected error in list', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/admin/audit/stats
 * Get audit log statistics
 */
router.get(
  '/stats',
  [query('from_date').optional().isISO8601(), query('to_date').optional().isISO8601()],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { from_date, to_date } = req.query;

      // Default to last 30 days
      const fromDate = from_date
        ? new Date(from_date as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to_date ? new Date(to_date as string) : new Date();

      // Get total actions count
      const { count: totalActions } = await supabase
        .schema(SCHEMA)
        .from('admin_audit_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      // Get actions by type
      const { data: actionsByType } = await supabase
        .schema(SCHEMA)
        .from('admin_audit_log')
        .select('action')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      const actionCounts: Record<string, number> = {};
      (actionsByType || []).forEach((entry) => {
        actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
      });

      // Get actions by entity type
      const { data: actionsByEntity } = await supabase
        .schema(SCHEMA)
        .from('admin_audit_log')
        .select('entity_type')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      const entityCounts: Record<string, number> = {};
      (actionsByEntity || []).forEach((entry) => {
        entityCounts[entry.entity_type] = (entityCounts[entry.entity_type] || 0) + 1;
      });

      // Get most active users
      const { data: activeUsers } = await supabase
        .schema(SCHEMA)
        .from('admin_audit_log')
        .select('user_id')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      const userCounts: Record<string, number> = {};
      (activeUsers || []).forEach((entry) => {
        userCounts[entry.user_id] = (userCounts[entry.user_id] || 0) + 1;
      });

      // Sort and get top 10 users
      const topUsers = Object.entries(userCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, actionCount: count }));

      // Get recent activity (last 24 hours vs previous 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dayBefore = new Date(Date.now() - 48 * 60 * 60 * 1000);

      const { count: last24h } = await supabase
        .schema(SCHEMA)
        .from('admin_audit_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString());

      const { count: previous24h } = await supabase
        .schema(SCHEMA)
        .from('admin_audit_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dayBefore.toISOString())
        .lt('created_at', yesterday.toISOString());

      res.json({
        ok: true,
        data: {
          period: {
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
          },
          summary: {
            totalActions: totalActions || 0,
            last24Hours: last24h || 0,
            previous24Hours: previous24h || 0,
            changePercent:
              previous24h && previous24h > 0
                ? Math.round(((last24h! - previous24h) / previous24h) * 100)
                : null,
          },
          actionsByType: Object.entries(actionCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([action, count]) => ({ action, count })),
          actionsByEntity: Object.entries(entityCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([entityType, count]) => ({ entityType, count })),
          topUsers,
        },
      });
    } catch (error: any) {
      logger.error('[AuditLog] Unexpected error in stats', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/admin/audit/actions
 * Get list of unique action types for filtering
 */
router.get('/actions', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);

    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('admin_audit_log')
      .select('action')
      .limit(1000);

    if (error) {
      logger.error('[AuditLog] Error fetching action types', { error });
      return res.status(500).json({ ok: false, error: error.message });
    }

    const uniqueActions = [...new Set((data || []).map((d) => d.action))].sort();

    res.json({
      ok: true,
      data: uniqueActions,
    });
  } catch (error: any) {
    logger.error('[AuditLog] Unexpected error in actions', { error });
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
