/**
 * System Users Routes (Master Admin)
 * Manage master admins and system-level users
 *
 * GET    /api/v1/travel-hub/admin/users - List system users
 * POST   /api/v1/travel-hub/admin/users - Create system user (grant master admin)
 * GET    /api/v1/travel-hub/admin/users/:id - Get system user details
 * PATCH  /api/v1/travel-hub/admin/users/:id - Update system user
 * DELETE /api/v1/travel-hub/admin/users/:id - Revoke system user access
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
 * GET /api/v1/travel-hub/admin/users
 * List all system users
 */
router.get(
  '/',
  [
    query('is_active').optional().isBoolean(),
    query('is_master_admin').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { is_active, is_master_admin, limit = 20, offset = 0 } = req.query;

      let queryBuilder = supabase
        .schema(SCHEMA)
        .from('system_users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (is_active !== undefined) {
        queryBuilder = queryBuilder.eq('is_active', is_active === 'true');
      }

      if (is_master_admin !== undefined) {
        queryBuilder = queryBuilder.eq('is_master_admin', is_master_admin === 'true');
      }

      const { data, error, count } = await queryBuilder;

      if (error) {
        logger.error('[SystemUsers] Error listing users', { error });
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
      logger.error('[SystemUsers] Unexpected error in list', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/v1/travel-hub/admin/users
 * Create system user (grant master admin to existing user)
 */
router.post(
  '/',
  [
    body('user_id').isUUID(),
    body('is_master_admin').optional().isBoolean(),
    body('notes').optional().isString().isLength({ max: 1000 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { user_id, is_master_admin = false, notes } = req.body;
      const grantedBy = req.user?.id;

      // Check if system user already exists
      const { data: existing } = await supabase
        .schema(SCHEMA)
        .from('system_users')
        .select('id, is_active')
        .eq('user_id', user_id)
        .maybeSingle();

      if (existing) {
        if (existing.is_active) {
          return res.status(400).json({
            ok: false,
            error: 'User is already a system user',
          });
        }
        // Reactivate if previously deactivated
        const { data, error } = await supabase
          .schema(SCHEMA)
          .from('system_users')
          .update({
            is_active: true,
            is_master_admin,
            notes,
            granted_by: grantedBy,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          logger.error('[SystemUsers] Error reactivating user', { error });
          return res.status(500).json({ ok: false, error: error.message });
        }

        await logAdminAction(req, 'reactivate_system_user', 'system_user', user_id, {
          is_master_admin,
        });

        return res.json({ ok: true, data });
      }

      // Create new system user
      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('system_users')
        .insert({
          user_id,
          is_master_admin,
          is_active: true,
          granted_by: grantedBy,
          notes,
        })
        .select()
        .single();

      if (error) {
        logger.error('[SystemUsers] Error creating system user', { error });
        return res.status(500).json({ ok: false, error: error.message });
      }

      await logAdminAction(req, 'create_system_user', 'system_user', user_id, {
        is_master_admin,
      });

      logger.info('[SystemUsers] System user created', {
        userId: user_id,
        isMasterAdmin: is_master_admin,
      });
      res.status(201).json({ ok: true, data });
    } catch (error: any) {
      logger.error('[SystemUsers] Unexpected error in create', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/admin/users/:id
 * Get system user details
 */
router.get('/:id', [param('id').isUUID()], validate, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { id } = req.params;

    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('system_users')
      .select('*')
      .eq('user_id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ ok: false, error: 'System user not found' });
      }
      logger.error('[SystemUsers] Error fetching user', { error, id });
      return res.status(500).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, data });
  } catch (error: any) {
    logger.error('[SystemUsers] Unexpected error in getById', { error });
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * PATCH /api/v1/travel-hub/admin/users/:id
 * Update system user
 */
router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('is_master_admin').optional().isBoolean(),
    body('is_active').optional().isBoolean(),
    body('notes').optional().isString().isLength({ max: 1000 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id } = req.params;

      // Prevent self-demotion
      if (id === req.user?.id && req.body.is_master_admin === false) {
        return res.status(400).json({
          ok: false,
          error: 'Cannot revoke your own master admin status',
        });
      }

      const updates = Object.fromEntries(
        Object.entries(req.body).filter(([_, v]) => v !== undefined)
      );

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('system_users')
        .update(updates)
        .eq('user_id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'System user not found' });
        }
        logger.error('[SystemUsers] Error updating user', { error, id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      await logAdminAction(req, 'update_system_user', 'system_user', id, updates);

      logger.info('[SystemUsers] System user updated', { userId: id });
      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[SystemUsers] Unexpected error in update', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/v1/travel-hub/admin/users/:id
 * Revoke system user access (soft delete)
 */
router.delete('/:id', [param('id').isUUID()], validate, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { id } = req.params;

    // Prevent self-removal
    if (id === req.user?.id) {
      return res.status(400).json({
        ok: false,
        error: 'Cannot revoke your own system access',
      });
    }

    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('system_users')
      .update({ is_active: false, is_master_admin: false })
      .eq('user_id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ ok: false, error: 'System user not found' });
      }
      logger.error('[SystemUsers] Error revoking user', { error, id });
      return res.status(500).json({ ok: false, error: error.message });
    }

    await logAdminAction(req, 'revoke_system_user', 'system_user', id, {});

    logger.info('[SystemUsers] System user access revoked', { userId: id });
    res.json({ ok: true, data });
  } catch (error: any) {
    logger.error('[SystemUsers] Unexpected error in delete', { error });
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/travel-hub/admin/users/lookup
 * Look up a user by email to grant system access
 */
router.post('/lookup', [body('email').isEmail()], validate, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { email } = req.body;

    // Look up user in oriva_platform.users
    const { data: user, error } = await supabase
      .schema('oriva_platform')
      .from('users')
      .select('id, email, full_name')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      logger.error('[SystemUsers] Error looking up user', { error });
      return res.status(500).json({ ok: false, error: error.message });
    }

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: 'User not found with that email',
      });
    }

    // Check if already a system user
    const { data: existingSystemUser } = await supabase
      .schema(SCHEMA)
      .from('system_users')
      .select('id, is_master_admin, is_active')
      .eq('user_id', user.id)
      .maybeSingle();

    res.json({
      ok: true,
      data: {
        user,
        systemUser: existingSystemUser,
      },
    });
  } catch (error: any) {
    logger.error('[SystemUsers] Unexpected error in lookup', { error });
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
