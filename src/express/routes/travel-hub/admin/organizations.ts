/**
 * Organizations Routes (Master Admin)
 * CRUD operations for organizations/client accounts
 *
 * GET    /api/v1/travel-hub/admin/organizations - List all organizations
 * POST   /api/v1/travel-hub/admin/organizations - Create organization
 * GET    /api/v1/travel-hub/admin/organizations/:id - Get organization details
 * PATCH  /api/v1/travel-hub/admin/organizations/:id - Update organization
 * DELETE /api/v1/travel-hub/admin/organizations/:id - Deactivate organization
 * GET    /api/v1/travel-hub/admin/organizations/:id/stats - Get organization stats
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { getSupabase } from '../../../middleware/schemaRouter';
import { logAdminAction } from '../../../middleware/rbac';
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
 * GET /api/v1/travel-hub/admin/organizations
 * List all organizations with filtering and pagination
 */
router.get(
  '/',
  [
    query('status').optional().isIn(['active', 'suspended', 'pending', 'deactivated']),
    query('search').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { status, search, limit = 20, offset = 0 } = req.query;

      let queryBuilder = supabase
        .schema(SCHEMA)
        .from('organizations')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (status) {
        queryBuilder = queryBuilder.eq('status', status);
      }

      if (search) {
        queryBuilder = queryBuilder.or(
          `name.ilike.%${search}%,slug.ilike.%${search}%,contact_email.ilike.%${search}%`
        );
      }

      const { data, error, count } = await queryBuilder;

      if (error) {
        logger.error('[Organizations] Error listing organizations', { error });
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
      logger.error('[Organizations] Unexpected error in list', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/v1/travel-hub/admin/organizations
 * Create a new organization (client account)
 */
router.post(
  '/',
  [
    body('name').isString().notEmpty().isLength({ max: 255 }),
    body('slug')
      .isString()
      .notEmpty()
      .matches(/^[a-z0-9-]+$/)
      .isLength({ min: 3, max: 63 }),
    body('contact_email').isEmail(),
    body('contact_phone').optional().isString(),
    body('logo_url').optional().isURL(),
    body('settings').optional().isObject(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { name, slug, contact_email, contact_phone, logo_url, settings } = req.body;

      // Check if slug is unique
      const { data: existing } = await supabase
        .schema(SCHEMA)
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({
          ok: false,
          error: 'Organization slug already exists',
        });
      }

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('organizations')
        .insert({
          name,
          slug,
          contact_email,
          contact_phone,
          logo_url,
          settings: settings || {},
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        logger.error('[Organizations] Error creating organization', { error });
        return res.status(500).json({ ok: false, error: error.message });
      }

      // Log admin action
      await logAdminAction(req, 'create_organization', 'organization', data.id, {
        name,
        slug,
        contact_email,
      });

      logger.info('[Organizations] Organization created', { orgId: data.id, name });
      res.status(201).json({ ok: true, data });
    } catch (error: any) {
      logger.error('[Organizations] Unexpected error in create', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/admin/organizations/:id
 * Get organization details with member counts
 */
router.get('/:id', [param('id').isUUID()], validate, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { id } = req.params;

    const { data: org, error } = await supabase
      .schema(SCHEMA)
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ ok: false, error: 'Organization not found' });
      }
      logger.error('[Organizations] Error fetching organization', { error, id });
      return res.status(500).json({ ok: false, error: error.message });
    }

    // Get member counts
    const { count: adminCount } = await supabase
      .schema(SCHEMA)
      .from('organization_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', id)
      .eq('role', 'admin')
      .eq('status', 'active');

    const { count: agentCount } = await supabase
      .schema(SCHEMA)
      .from('organization_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', id)
      .eq('role', 'concierge_agent')
      .eq('status', 'active');

    const { count: clientCount } = await supabase
      .schema(SCHEMA)
      .from('concierge_clients')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', id);

    res.json({
      ok: true,
      data: {
        ...org,
        stats: {
          adminCount: adminCount || 0,
          agentCount: agentCount || 0,
          clientCount: clientCount || 0,
        },
      },
    });
  } catch (error: any) {
    logger.error('[Organizations] Unexpected error in getById', { error });
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * PATCH /api/v1/travel-hub/admin/organizations/:id
 * Update organization details
 */
router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().isString().isLength({ max: 255 }),
    body('contact_email').optional().isEmail(),
    body('contact_phone').optional().isString(),
    body('logo_url').optional().isURL(),
    body('status').optional().isIn(['active', 'suspended', 'pending', 'deactivated']),
    body('settings').optional().isObject(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id } = req.params;

      const updates = Object.fromEntries(
        Object.entries(req.body).filter(([_, v]) => v !== undefined)
      );

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('organizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Organization not found' });
        }
        logger.error('[Organizations] Error updating organization', { error, id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      // Log admin action
      await logAdminAction(req, 'update_organization', 'organization', id, updates);

      logger.info('[Organizations] Organization updated', { orgId: id });
      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[Organizations] Unexpected error in update', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/v1/travel-hub/admin/organizations/:id
 * Soft delete (deactivate) organization
 */
router.delete('/:id', [param('id').isUUID()], validate, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { id } = req.params;

    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('organizations')
      .update({ status: 'deactivated' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ ok: false, error: 'Organization not found' });
      }
      logger.error('[Organizations] Error deactivating organization', { error, id });
      return res.status(500).json({ ok: false, error: error.message });
    }

    // Log admin action
    await logAdminAction(req, 'deactivate_organization', 'organization', id, {});

    logger.info('[Organizations] Organization deactivated', { orgId: id });
    res.json({ ok: true, data });
  } catch (error: any) {
    logger.error('[Organizations] Unexpected error in delete', { error });
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/travel-hub/admin/organizations/:id/stats
 * Get detailed organization statistics
 */
router.get('/:id/stats', [param('id').isUUID()], validate, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { id } = req.params;

    // Verify org exists
    const { data: org, error: orgError } = await supabase
      .schema(SCHEMA)
      .from('organizations')
      .select('id, name')
      .eq('id', id)
      .single();

    if (orgError || !org) {
      return res.status(404).json({ ok: false, error: 'Organization not found' });
    }

    // Get various counts in parallel
    const [
      { count: totalMembers },
      { count: activeMembers },
      { count: clients },
      { count: itineraries },
      { count: pendingInvitations },
    ] = await Promise.all([
      supabase
        .schema(SCHEMA)
        .from('organization_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', id),
      supabase
        .schema(SCHEMA)
        .from('organization_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', id)
        .eq('status', 'active'),
      supabase
        .schema(SCHEMA)
        .from('concierge_clients')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', id),
      supabase
        .schema(SCHEMA)
        .from('itineraries')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', id),
      supabase
        .schema(SCHEMA)
        .from('invitations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', id)
        .eq('status', 'pending'),
    ]);

    res.json({
      ok: true,
      data: {
        organizationId: id,
        organizationName: org.name,
        stats: {
          totalMembers: totalMembers || 0,
          activeMembers: activeMembers || 0,
          clients: clients || 0,
          itineraries: itineraries || 0,
          pendingInvitations: pendingInvitations || 0,
        },
      },
    });
  } catch (error: any) {
    logger.error('[Organizations] Unexpected error in stats', { error });
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
