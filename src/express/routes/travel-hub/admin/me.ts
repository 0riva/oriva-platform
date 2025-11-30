/**
 * Admin Me Routes
 * GET /api/v1/travel-hub/admin/me - Get current user's admin context and permissions
 */

import { Router, Request, Response } from 'express';
import { getSupabase } from '../../../middleware/schemaRouter';
import { logger } from '../../../../utils/logger';

const router = Router();
const SCHEMA = 'travel_hub';

/**
 * GET /api/v1/travel-hub/admin/me
 * Get current user's admin context, role, and permissions
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const supabase = getSupabase(req);

    // Get system user record
    const { data: systemUser } = await supabase
      .schema(SCHEMA)
      .from('system_users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // Get organization memberships with org details
    const { data: memberships } = await supabase
      .schema(SCHEMA)
      .from('organization_memberships')
      .select(
        `
        id,
        role,
        status,
        joined_at,
        organization:organizations (
          id,
          name,
          slug,
          status,
          logo_url
        )
      `
      )
      .eq('user_id', userId)
      .eq('status', 'active');

    // Determine permissions
    const isMasterAdmin = systemUser?.is_master_admin && systemUser?.is_active;
    const adminOrgs = (memberships || []).filter((m) => m.role === 'admin');
    const conciergeOrgs = (memberships || []).filter((m) => m.role === 'concierge_agent');

    const permissions = {
      // Master admin permissions
      canManageOrganizations: isMasterAdmin,
      canManageSystemUsers: isMasterAdmin,
      canViewAllData: isMasterAdmin,
      canViewAuditLog: isMasterAdmin,

      // Org admin permissions
      canManageOrgMembers: isMasterAdmin || adminOrgs.length > 0,
      canInviteMembers: isMasterAdmin || adminOrgs.length > 0,
      canViewOrgData: isMasterAdmin || (memberships || []).length > 0,

      // Concierge permissions
      canManageClients: (memberships || []).length > 0,
      canManageItineraries: (memberships || []).length > 0,
    };

    res.json({
      ok: true,
      data: {
        user: {
          id: userId,
          email: req.user?.email,
        },
        systemUser: systemUser
          ? {
              isMasterAdmin: systemUser.is_master_admin,
              isActive: systemUser.is_active,
              createdAt: systemUser.created_at,
            }
          : null,
        role: isMasterAdmin
          ? 'master_admin'
          : adminOrgs.length > 0
            ? 'org_admin'
            : conciergeOrgs.length > 0
              ? 'concierge_agent'
              : null,
        memberships: memberships || [],
        adminOrganizations: adminOrgs.map((m) => m.organization),
        conciergeOrganizations: conciergeOrgs.map((m) => m.organization),
        permissions,
      },
    });
  } catch (error: any) {
    logger.error('[AdminMe] Error fetching admin context', { error });
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
