/**
 * RBAC Middleware for Travel Hub Concierge
 * Validates user roles for master admin, org admin, and concierge agent access
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabase } from './schemaRouter';
import { getSupabaseServiceClient } from '../../config/supabase';
import { logger, sanitizeError } from '../../utils/logger';

const SCHEMA = 'travel_hub';

// Extend Express Request to include RBAC context
declare global {
  namespace Express {
    interface Request {
      rbac?: {
        isMasterAdmin: boolean;
        isOrgAdmin: boolean;
        organizationId: string | null;
        systemRole: 'master_admin' | 'org_admin' | 'concierge_agent' | null;
        memberships: Array<{
          organizationId: string;
          role: 'admin' | 'concierge_agent';
        }>;
      };
    }
  }
}

/**
 * Load RBAC context for the authenticated user
 * This middleware should be called after requireAuth
 */
export const loadRbacContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      // No user, skip RBAC loading
      next();
      return;
    }

    const supabase = getSupabase(req);

    // IMPORTANT: Use service client to bypass RLS for system_users check
    // The RLS policy on system_users requires is_master_admin, creating chicken-and-egg problem
    // This mirrors the approach in /admin/me endpoint
    const serviceClient = getSupabaseServiceClient();

    // Check if user is a system user (master admin) using service client
    const { data: systemUser, error: sysError } = await (serviceClient as any)
      .schema(SCHEMA)
      .from('system_users')
      .select('is_master_admin, is_active')
      .eq('user_id', userId)
      .maybeSingle();

    if (sysError) {
      logger.warn('[RBAC] Error loading system user', { error: sysError, userId });
    }

    // Get organization memberships
    const { data: memberships, error: memError } = await supabase
      .schema(SCHEMA)
      .from('organization_memberships')
      .select('organization_id, role, status')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (memError) {
      logger.warn('[RBAC] Error loading memberships', { error: memError });
    }

    const isMasterAdmin = systemUser?.is_master_admin && systemUser?.is_active;
    const activeMemberships = (memberships || []).map((m) => ({
      organizationId: m.organization_id,
      role: m.role as 'admin' | 'concierge_agent',
    }));

    // Determine primary organization (first admin role, or first membership)
    const adminMembership = activeMemberships.find((m) => m.role === 'admin');
    const primaryOrgId =
      adminMembership?.organizationId || activeMemberships[0]?.organizationId || null;

    // Determine system role
    let systemRole: 'master_admin' | 'org_admin' | 'concierge_agent' | null = null;
    if (isMasterAdmin) {
      systemRole = 'master_admin';
    } else if (adminMembership) {
      systemRole = 'org_admin';
    } else if (activeMemberships.length > 0) {
      systemRole = 'concierge_agent';
    }

    req.rbac = {
      isMasterAdmin: !!isMasterAdmin,
      isOrgAdmin: !!adminMembership,
      organizationId: primaryOrgId,
      systemRole,
      memberships: activeMemberships,
    };

    next();
  } catch (error) {
    logger.error('[RBAC] Failed to load context', { error: sanitizeError(error) });
    // Don't fail request, just continue without RBAC context
    next();
  }
};

/**
 * Require master admin role
 */
export const requireMasterAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Load RBAC if not already loaded
  if (!req.rbac) {
    await loadRbacContext(req, res, () => {});
  }

  if (!req.rbac?.isMasterAdmin) {
    res.status(403).json({
      ok: false,
      error: 'Master admin access required',
      code: 'FORBIDDEN',
    });
    return;
  }

  next();
};

/**
 * Require organization admin role (or master admin)
 */
export const requireOrgAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Load RBAC if not already loaded
  if (!req.rbac) {
    await loadRbacContext(req, res, () => {});
  }

  if (!req.rbac?.isMasterAdmin && !req.rbac?.isOrgAdmin) {
    res.status(403).json({
      ok: false,
      error: 'Organization admin access required',
      code: 'FORBIDDEN',
    });
    return;
  }

  next();
};

/**
 * Require organization membership (any role)
 */
export const requireOrgMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Load RBAC if not already loaded
  if (!req.rbac) {
    await loadRbacContext(req, res, () => {});
  }

  if (!req.rbac?.isMasterAdmin && req.rbac?.memberships.length === 0) {
    res.status(403).json({
      ok: false,
      error: 'Organization membership required',
      code: 'FORBIDDEN',
    });
    return;
  }

  next();
};

/**
 * Require access to specific organization
 * Use as: requireOrgAccess('orgId') or get orgId from req.params
 */
export const requireOrgAccess = (orgIdParam: string = 'orgId') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Load RBAC if not already loaded
    if (!req.rbac) {
      await loadRbacContext(req, res, () => {});
    }

    const orgId = req.params[orgIdParam];

    // Master admins have access to all organizations
    if (req.rbac?.isMasterAdmin) {
      next();
      return;
    }

    // Check if user has membership in this organization
    const hasMembership = req.rbac?.memberships.some((m) => m.organizationId === orgId);

    if (!hasMembership) {
      res.status(403).json({
        ok: false,
        error: 'You do not have access to this organization',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
};

/**
 * Require admin access to specific organization
 */
export const requireOrgAdminAccess = (orgIdParam: string = 'orgId') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Load RBAC if not already loaded
    if (!req.rbac) {
      await loadRbacContext(req, res, () => {});
    }

    const orgId = req.params[orgIdParam];

    // Master admins have admin access to all organizations
    if (req.rbac?.isMasterAdmin) {
      next();
      return;
    }

    // Check if user is admin of this organization
    const isOrgAdmin = req.rbac?.memberships.some(
      (m) => m.organizationId === orgId && m.role === 'admin'
    );

    if (!isOrgAdmin) {
      res.status(403).json({
        ok: false,
        error: 'Organization admin access required',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
};

/**
 * Audit log helper - records admin actions
 */
export const logAdminAction = async (
  req: Request,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {}
): Promise<void> => {
  try {
    const supabase = getSupabase(req);
    const userId = req.user?.id;

    if (!userId) return;

    await supabase
      .schema(SCHEMA)
      .from('admin_audit_log')
      .insert({
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details: {
          ...details,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
        },
      });
  } catch (error) {
    logger.error('[RBAC] Failed to log admin action', {
      error: sanitizeError(error),
      action,
      entityType,
      entityId,
    });
  }
};
