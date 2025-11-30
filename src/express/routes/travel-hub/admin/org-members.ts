/**
 * Organization Members Routes (Org Admin)
 * Manage members within an organization
 *
 * GET    /api/v1/travel-hub/admin/org/:orgId/members - List organization members
 * POST   /api/v1/travel-hub/admin/org/:orgId/members - Add member to organization
 * GET    /api/v1/travel-hub/admin/org/:orgId/members/:userId - Get member details
 * PATCH  /api/v1/travel-hub/admin/org/:orgId/members/:userId - Update member role/status
 * DELETE /api/v1/travel-hub/admin/org/:orgId/members/:userId - Remove member
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { getSupabase } from '../../../middleware/schemaRouter';
import { requireOrgAdminAccess, logAdminAction } from '../../../middleware/rbac';
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
 * GET /api/v1/travel-hub/admin/org/:orgId/members
 * List all members of an organization
 */
router.get(
  '/:orgId/members',
  [
    param('orgId').isUUID(),
    query('role').optional().isIn(['admin', 'concierge_agent']),
    query('status').optional().isIn(['active', 'suspended', 'pending']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  requireOrgAdminAccess('orgId'),
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { orgId } = req.params;
      const { role, status, limit = 20, offset = 0 } = req.query;

      let queryBuilder = supabase
        .schema(SCHEMA)
        .from('organization_memberships')
        .select('*', { count: 'exact' })
        .eq('organization_id', orgId)
        .order('joined_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (role) {
        queryBuilder = queryBuilder.eq('role', role);
      }

      if (status) {
        queryBuilder = queryBuilder.eq('status', status);
      }

      const { data, error, count } = await queryBuilder;

      if (error) {
        logger.error('[OrgMembers] Error listing members', { error, orgId });
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
      logger.error('[OrgMembers] Unexpected error in list', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/v1/travel-hub/admin/org/:orgId/members
 * Add a member to organization (direct add, not invitation)
 */
router.post(
  '/:orgId/members',
  [
    param('orgId').isUUID(),
    body('user_id').isUUID(),
    body('role').isIn(['admin', 'concierge_agent']),
  ],
  validate,
  requireOrgAdminAccess('orgId'),
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { orgId } = req.params;
      const { user_id, role } = req.body;
      const invitedBy = req.user?.id;

      // Check if user is already a member
      const { data: existing } = await supabase
        .schema(SCHEMA)
        .from('organization_memberships')
        .select('id, status')
        .eq('organization_id', orgId)
        .eq('user_id', user_id)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'active') {
          return res.status(400).json({
            ok: false,
            error: 'User is already a member of this organization',
          });
        }
        // Reactivate if previously removed
        const { data, error } = await supabase
          .schema(SCHEMA)
          .from('organization_memberships')
          .update({
            status: 'active',
            role,
            invited_by: invitedBy,
            joined_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          logger.error('[OrgMembers] Error reactivating member', { error });
          return res.status(500).json({ ok: false, error: error.message });
        }

        await logAdminAction(req, 'reactivate_member', 'organization_membership', user_id, {
          organization_id: orgId,
          role,
        });

        return res.json({ ok: true, data });
      }

      // Create new membership
      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('organization_memberships')
        .insert({
          organization_id: orgId,
          user_id,
          role,
          status: 'active',
          invited_by: invitedBy,
          joined_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error('[OrgMembers] Error adding member', { error });
        return res.status(500).json({ ok: false, error: error.message });
      }

      await logAdminAction(req, 'add_member', 'organization_membership', user_id, {
        organization_id: orgId,
        role,
      });

      logger.info('[OrgMembers] Member added', { orgId, userId: user_id, role });
      res.status(201).json({ ok: true, data });
    } catch (error: any) {
      logger.error('[OrgMembers] Unexpected error in add', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/admin/org/:orgId/members/:userId
 * Get member details
 */
router.get(
  '/:orgId/members/:userId',
  [param('orgId').isUUID(), param('userId').isUUID()],
  validate,
  requireOrgAdminAccess('orgId'),
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { orgId, userId } = req.params;

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('organization_memberships')
        .select('*')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Member not found' });
        }
        logger.error('[OrgMembers] Error fetching member', { error, orgId, userId });
        return res.status(500).json({ ok: false, error: error.message });
      }

      // Get concierge profile if exists
      const { data: conciergeProfile } = await supabase
        .schema(SCHEMA)
        .from('concierge_profiles')
        .select('*')
        .eq('account_id', userId)
        .eq('organization_id', orgId)
        .maybeSingle();

      // Get client and itinerary counts for this agent
      let stats = null;
      if (conciergeProfile) {
        const [{ count: clientCount }, { count: itineraryCount }] = await Promise.all([
          supabase
            .schema(SCHEMA)
            .from('concierge_clients')
            .select('*', { count: 'exact', head: true })
            .eq('concierge_id', conciergeProfile.id),
          supabase
            .schema(SCHEMA)
            .from('itineraries')
            .select('*', { count: 'exact', head: true })
            .eq('concierge_id', conciergeProfile.id),
        ]);

        stats = {
          clientCount: clientCount || 0,
          itineraryCount: itineraryCount || 0,
        };
      }

      res.json({
        ok: true,
        data: {
          membership: data,
          conciergeProfile,
          stats,
        },
      });
    } catch (error: any) {
      logger.error('[OrgMembers] Unexpected error in getById', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/v1/travel-hub/admin/org/:orgId/members/:userId
 * Update member role or status
 */
router.patch(
  '/:orgId/members/:userId',
  [
    param('orgId').isUUID(),
    param('userId').isUUID(),
    body('role').optional().isIn(['admin', 'concierge_agent']),
    body('status').optional().isIn(['active', 'suspended', 'pending']),
  ],
  validate,
  requireOrgAdminAccess('orgId'),
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { orgId, userId } = req.params;

      // Prevent self-demotion from admin
      if (userId === req.user?.id && req.body.role === 'concierge_agent') {
        // Check if user is master admin (they can still demote themselves)
        if (!req.rbac?.isMasterAdmin) {
          return res.status(400).json({
            ok: false,
            error: 'Cannot demote yourself from admin role',
          });
        }
      }

      const updates = Object.fromEntries(
        Object.entries(req.body).filter(([_, v]) => v !== undefined)
      );

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('organization_memberships')
        .update(updates)
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Member not found' });
        }
        logger.error('[OrgMembers] Error updating member', { error, orgId, userId });
        return res.status(500).json({ ok: false, error: error.message });
      }

      await logAdminAction(req, 'update_member', 'organization_membership', userId, {
        organization_id: orgId,
        ...updates,
      });

      logger.info('[OrgMembers] Member updated', { orgId, userId });
      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[OrgMembers] Unexpected error in update', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/v1/travel-hub/admin/org/:orgId/members/:userId
 * Remove member from organization (soft delete - sets status to 'removed')
 */
router.delete(
  '/:orgId/members/:userId',
  [param('orgId').isUUID(), param('userId').isUUID()],
  validate,
  requireOrgAdminAccess('orgId'),
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { orgId, userId } = req.params;

      // Prevent self-removal
      if (userId === req.user?.id && !req.rbac?.isMasterAdmin) {
        return res.status(400).json({
          ok: false,
          error: 'Cannot remove yourself from the organization',
        });
      }

      // Check if this is the last admin
      const { count: adminCount } = await supabase
        .schema(SCHEMA)
        .from('organization_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('role', 'admin')
        .eq('status', 'active');

      const { data: targetMember } = await supabase
        .schema(SCHEMA)
        .from('organization_memberships')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .single();

      if (targetMember?.role === 'admin' && (adminCount || 0) <= 1) {
        return res.status(400).json({
          ok: false,
          error: 'Cannot remove the last admin from the organization',
        });
      }

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('organization_memberships')
        .update({ status: 'suspended' })
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Member not found' });
        }
        logger.error('[OrgMembers] Error removing member', { error, orgId, userId });
        return res.status(500).json({ ok: false, error: error.message });
      }

      await logAdminAction(req, 'remove_member', 'organization_membership', userId, {
        organization_id: orgId,
      });

      logger.info('[OrgMembers] Member removed', { orgId, userId });
      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[OrgMembers] Unexpected error in delete', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/v1/travel-hub/admin/org/:orgId/members/lookup
 * Look up a user by email to add to organization
 */
router.post(
  '/:orgId/members/lookup',
  [param('orgId').isUUID(), body('email').isEmail()],
  validate,
  requireOrgAdminAccess('orgId'),
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { orgId } = req.params;
      const { email } = req.body;

      // Look up user
      const { data: user, error } = await supabase
        .schema('oriva_platform')
        .from('users')
        .select('id, email, full_name')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        logger.error('[OrgMembers] Error looking up user', { error });
        return res.status(500).json({ ok: false, error: error.message });
      }

      if (!user) {
        return res.status(404).json({
          ok: false,
          error: 'User not found with that email',
        });
      }

      // Check if already a member
      const { data: existingMembership } = await supabase
        .schema(SCHEMA)
        .from('organization_memberships')
        .select('id, role, status')
        .eq('organization_id', orgId)
        .eq('user_id', user.id)
        .maybeSingle();

      res.json({
        ok: true,
        data: {
          user,
          existingMembership,
        },
      });
    } catch (error: any) {
      logger.error('[OrgMembers] Unexpected error in lookup', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

export default router;
