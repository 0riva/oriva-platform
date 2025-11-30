/**
 * Travel Hub Admin Router
 * Master Admin and Organization Admin API endpoints
 *
 * Routes:
 * /api/v1/travel-hub/admin/me - Get current user's admin context
 * /api/v1/travel-hub/admin/organizations - Organization management (master admin)
 * /api/v1/travel-hub/admin/users - System user management (master admin)
 * /api/v1/travel-hub/admin/org/:orgId/* - Organization-specific management
 */

import { Router } from 'express';
import { requireAuth } from '../../../middleware/auth';
import { loadRbacContext, requireMasterAdmin, requireOrgAdmin } from '../../../middleware/rbac';
import organizationsRouter from './organizations';
import systemUsersRouter from './system-users';
import orgMembersRouter from './org-members';
import invitationsRouter from './invitations';
import auditRouter from './audit';
import meRouter from './me';

const router = Router();

// All admin routes require authentication and RBAC context
router.use(requireAuth);
router.use(loadRbacContext);

// Current user's admin context (accessible to any authenticated user)
router.use('/me', meRouter);

// Master admin routes
router.use('/organizations', requireMasterAdmin, organizationsRouter);
router.use('/users', requireMasterAdmin, systemUsersRouter);
router.use('/audit', requireMasterAdmin, auditRouter);

// Organization admin routes (org-specific)
router.use('/org', requireOrgAdmin, orgMembersRouter);
router.use('/org', requireOrgAdmin, invitationsRouter);

export default router;
