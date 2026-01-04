/**
 * Admin Me Routes
 * GET /api/v1/travel-hub/admin/me - Get current user's admin context and permissions
 */

import { Router, Request, Response } from 'express';
import { getSupabase } from '../../../middleware/schemaRouter';
import { getSupabaseServiceClient } from '../../../../config/supabase';
import { logger } from '../../../../utils/logger';

const router = Router();
const SCHEMA = 'travel_hub';

// Type for system_users table in travel_hub schema
interface SystemUser {
  id: string;
  user_id: string;
  is_master_admin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

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

    // IMPORTANT: Use service client to bypass RLS for system_users check
    // The RLS policy on system_users requires is_master_admin, creating chicken-and-egg problem
    const serviceClient = getSupabaseServiceClient();

    // Get system user record (using service client to bypass RLS)
    // Cast to any to avoid TypeScript issues with travel_hub schema not being in generated types
    const { data: systemUserData, error: systemUserError } = await (serviceClient as any)
      .schema(SCHEMA)
      .from('system_users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (systemUserError) {
      logger.warn('[AdminMe] Error fetching system user', { error: systemUserError, userId });
    }

    const systemUser = systemUserData as SystemUser | null;

    // Get organization memberships with org details
    // IMPORTANT: organization_memberships uses system_user_id (NOT user_id!)
    // Must use systemUser.id from the system_users table lookup above
    let memberships: any[] = [];
    if (systemUser?.id) {
      const { data: membershipData } = await supabase
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
        .eq('system_user_id', systemUser.id)
        .eq('status', 'active');
      memberships = membershipData || [];
    }

    // Determine permissions
    const isMasterAdmin = systemUser?.is_master_admin && systemUser?.is_active;
    // Check for both 'admin' and 'org_admin' role values (schema allows both)
    const adminOrgs = (memberships || []).filter(
      (m) => m.role === 'admin' || m.role === 'org_admin'
    );
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
