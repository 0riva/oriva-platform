/**
 * Invitations Routes (Org Admin)
 * Manage invitations to join an organization
 *
 * GET    /api/v1/travel-hub/admin/org/:orgId/invitations - List invitations
 * POST   /api/v1/travel-hub/admin/org/:orgId/invitations - Create invitation
 * GET    /api/v1/travel-hub/admin/org/:orgId/invitations/:id - Get invitation
 * DELETE /api/v1/travel-hub/admin/org/:orgId/invitations/:id - Cancel invitation
 * POST   /api/v1/travel-hub/admin/org/:orgId/invitations/:id/resend - Resend invitation
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import crypto from 'crypto';
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
 * Generate a secure invitation token
 */
const generateInviteToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * GET /api/v1/travel-hub/admin/org/:orgId/invitations
 * List all invitations for an organization
 */
router.get(
  '/:orgId/invitations',
  [
    param('orgId').isUUID(),
    query('status').optional().isIn(['pending', 'accepted', 'expired', 'revoked']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  requireOrgAdminAccess('orgId'),
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { orgId } = req.params;
      const { status, limit = 20, offset = 0 } = req.query;

      let queryBuilder = supabase
        .schema(SCHEMA)
        .from('invitations')
        .select('*', { count: 'exact' })
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (status) {
        queryBuilder = queryBuilder.eq('status', status);
      }

      const { data, error, count } = await queryBuilder;

      if (error) {
        logger.error('[Invitations] Error listing invitations', { error, orgId });
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
      logger.error('[Invitations] Unexpected error in list', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/v1/travel-hub/admin/org/:orgId/invitations
 * Create a new invitation
 */
router.post(
  '/:orgId/invitations',
  [
    param('orgId').isUUID(),
    body('email').isEmail(),
    body('role').isIn(['admin', 'concierge_agent']),
    body('expires_in_days').optional().isInt({ min: 1, max: 30 }),
  ],
  validate,
  requireOrgAdminAccess('orgId'),
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { orgId } = req.params;
      const { email, role, expires_in_days = 7 } = req.body;
      const invitedBy = req.user?.id;

      // Check if user already exists
      const { data: existingUser } = await supabase
        .schema('oriva_platform')
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      // If user exists, check if already a member
      if (existingUser) {
        const { data: existingMembership } = await supabase
          .schema(SCHEMA)
          .from('organization_memberships')
          .select('id, status')
          .eq('organization_id', orgId)
          .eq('user_id', existingUser.id)
          .eq('status', 'active')
          .maybeSingle();

        if (existingMembership) {
          return res.status(400).json({
            ok: false,
            error: 'User is already a member of this organization',
          });
        }
      }

      // Check for pending invitation
      const { data: existingInvite } = await supabase
        .schema(SCHEMA)
        .from('invitations')
        .select('id, expires_at')
        .eq('organization_id', orgId)
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingInvite) {
        const isExpired = new Date(existingInvite.expires_at) < new Date();
        if (!isExpired) {
          return res.status(400).json({
            ok: false,
            error: 'A pending invitation already exists for this email',
          });
        }
        // If expired, we'll create a new one below
      }

      // Generate token and expiration
      const token = generateInviteToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);

      // Get organization name for the invitation
      const { data: org } = await supabase
        .schema(SCHEMA)
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('invitations')
        .insert({
          organization_id: orgId,
          email,
          role,
          token,
          invited_by: invitedBy,
          expires_at: expiresAt.toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        logger.error('[Invitations] Error creating invitation', { error });
        return res.status(500).json({ ok: false, error: error.message });
      }

      await logAdminAction(req, 'create_invitation', 'invitation', data.id, {
        organization_id: orgId,
        email,
        role,
      });

      // Generate invitation URL (this would be sent via email in production)
      const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-hub/invite/${token}`;

      logger.info('[Invitations] Invitation created', { orgId, email, role });
      res.status(201).json({
        ok: true,
        data: {
          ...data,
          invite_url: inviteUrl,
          organization_name: org?.name,
        },
      });
    } catch (error: any) {
      logger.error('[Invitations] Unexpected error in create', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/admin/org/:orgId/invitations/:id
 * Get invitation details
 */
router.get(
  '/:orgId/invitations/:id',
  [param('orgId').isUUID(), param('id').isUUID()],
  validate,
  requireOrgAdminAccess('orgId'),
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { orgId, id } = req.params;

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('invitations')
        .select('*')
        .eq('id', id)
        .eq('organization_id', orgId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Invitation not found' });
        }
        logger.error('[Invitations] Error fetching invitation', { error, id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[Invitations] Unexpected error in getById', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/v1/travel-hub/admin/org/:orgId/invitations/:id
 * Cancel/revoke an invitation
 */
router.delete(
  '/:orgId/invitations/:id',
  [param('orgId').isUUID(), param('id').isUUID()],
  validate,
  requireOrgAdminAccess('orgId'),
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { orgId, id } = req.params;

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('invitations')
        .update({ status: 'revoked' })
        .eq('id', id)
        .eq('organization_id', orgId)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Pending invitation not found' });
        }
        logger.error('[Invitations] Error revoking invitation', { error, id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      await logAdminAction(req, 'revoke_invitation', 'invitation', id, {
        organization_id: orgId,
        email: data.email,
      });

      logger.info('[Invitations] Invitation revoked', { id, email: data.email });
      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[Invitations] Unexpected error in delete', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/v1/travel-hub/admin/org/:orgId/invitations/:id/resend
 * Resend an invitation (generates new token and extends expiration)
 */
router.post(
  '/:orgId/invitations/:id/resend',
  [param('orgId').isUUID(), param('id').isUUID()],
  validate,
  requireOrgAdminAccess('orgId'),
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { orgId, id } = req.params;

      // Get existing invitation
      const { data: existing, error: fetchError } = await supabase
        .schema(SCHEMA)
        .from('invitations')
        .select('*')
        .eq('id', id)
        .eq('organization_id', orgId)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ ok: false, error: 'Invitation not found' });
      }

      if (existing.status !== 'pending' && existing.status !== 'expired') {
        return res.status(400).json({
          ok: false,
          error: `Cannot resend ${existing.status} invitation`,
        });
      }

      // Generate new token and expiration
      const newToken = generateInviteToken();
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('invitations')
        .update({
          token: newToken,
          expires_at: newExpiresAt.toISOString(),
          status: 'pending',
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('[Invitations] Error resending invitation', { error, id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      await logAdminAction(req, 'resend_invitation', 'invitation', id, {
        organization_id: orgId,
        email: data.email,
      });

      const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/travel-hub/invite/${newToken}`;

      logger.info('[Invitations] Invitation resent', { id, email: data.email });
      res.json({
        ok: true,
        data: {
          ...data,
          invite_url: inviteUrl,
        },
      });
    } catch (error: any) {
      logger.error('[Invitations] Unexpected error in resend', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

export default router;
