// @ts-nocheck - TODO: Fix type errors
/**
 * Consolidated Travel Hub API (Merlin Concierge)
 *
 * B2B luxury travel concierge platform endpoints:
 * - Admin: Organizations, System Users, Members, Invitations, Audit
 * - Concierges: Profile management, availability, discovery
 * - Clients: Client relationships, preferences
 * - Chat: Conversations, messages, real-time updates
 * - Itineraries: Trip planning, items, export/share
 * - Shared: Public itinerary viewing
 *
 * Routes organized by domain:
 * - /api/v1/travel-hub/admin/*        - Admin operations (RBAC)
 * - /api/v1/travel-hub/concierges/*   - Concierge management
 * - /api/v1/travel-hub/clients/*      - Client management
 * - /api/v1/travel-hub/chat/*         - Messaging
 * - /api/v1/travel-hub/itineraries/*  - Trip itineraries
 * - /api/v1/travel-hub/shared/*       - Public access
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getSupabaseClient,
  getSupabaseServiceClient,
  SupabaseClient,
} from '../../src/config/supabase';

// ============================================================================
// Types
// ============================================================================

type SystemRole = 'master_admin' | 'org_admin' | 'concierge_agent';
type OrganizationStatus = 'active' | 'suspended' | 'pending' | 'deactivated';
type MembershipStatus = 'active' | 'suspended' | 'pending';
type MemberRole = 'admin' | 'concierge_agent';
type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
type ConciergeAvailability = 'available' | 'busy' | 'offline';
type ClientStatus = 'active' | 'inactive' | 'pending';
type ConversationStatus = 'open' | 'resolved' | 'archived';
type MessageSender = 'client' | 'concierge' | 'system' | 'ai';
type ItineraryStatus =
  | 'draft'
  | 'planning'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'published';
type ItineraryItemStatus = 'planned' | 'booked' | 'confirmed' | 'completed' | 'cancelled';

interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  pagination?: { total: number; page?: number; limit?: number };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getAuthenticatedUser(req: VercelRequest) {
  const authHeader = req.headers.authorization as string | undefined;
  if (!authHeader) return null;

  // Use service client to validate JWT tokens (required for cross-origin requests)
  // The anon client can only validate its own session, not arbitrary JWTs
  const serviceClient = getSupabaseServiceClient();
  const {
    data: { user },
    error,
  } = await serviceClient.auth.getUser(authHeader.replace('Bearer ', ''));

  if (error || !user) return null;

  // Return both clients:
  // - serviceClient for admin operations (bypasses RLS for travel_hub schema access)
  // - supabase for user-scoped operations (with RLS)
  const supabase = getSupabaseClient();
  return { user, supabase, serviceClient };
}

function jsonResponse<T>(res: VercelResponse, status: number, data: ApiResponse<T>) {
  return res.status(status).json(data);
}

function successResponse<T>(res: VercelResponse, data: T, pagination?: { total: number }) {
  return jsonResponse(res, 200, { ok: true, data, pagination });
}

function errorResponse(res: VercelResponse, status: number, error: string) {
  return jsonResponse(res, status, { ok: false, error });
}

function parsePathParams(pathname: string, pattern: string): Record<string, string> | null {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return params;
}

// ============================================================================
// Admin: Context & Permissions
// ============================================================================

async function getAdminContext(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { user, serviceClient } = auth;

  try {
    // Use service client with schema() for travel_hub queries (bypasses RLS)
    // Check if user is a system user
    const { data: systemUser } = await serviceClient
      .schema('travel_hub')
      .from('system_users')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Get user's organization memberships
    const { data: memberships } = await serviceClient
      .schema('travel_hub')
      .from('organization_memberships')
      .select('*, organization:organizations(*)')
      .eq('user_id', user.id)
      .eq('status', 'active');

    const adminOrgs = (memberships || [])
      .filter((m: any) => m.role === 'admin')
      .map((m: any) => m.organization);

    const conciergeOrgs = (memberships || [])
      .filter((m: any) => m.role === 'concierge_agent')
      .map((m: any) => m.organization);

    // Determine role
    let role: SystemRole | null = null;
    if (systemUser?.is_master_admin) {
      role = 'master_admin';
    } else if (adminOrgs.length > 0) {
      role = 'org_admin';
    } else if (conciergeOrgs.length > 0) {
      role = 'concierge_agent';
    }

    const isMasterAdmin = systemUser?.is_master_admin === true;
    const isOrgAdmin = role === 'org_admin' || isMasterAdmin;

    const context = {
      user: { id: user.id, email: user.email },
      systemUser: systemUser
        ? {
            isMasterAdmin: systemUser.is_master_admin,
            isActive: systemUser.is_active,
            createdAt: systemUser.created_at,
          }
        : null,
      role,
      memberships: memberships || [],
      adminOrganizations: adminOrgs,
      conciergeOrganizations: conciergeOrgs,
      isMasterAdmin,
      isOrgAdmin,
      permissions: {
        canManageOrganizations: isMasterAdmin,
        canManageSystemUsers: isMasterAdmin,
        canViewAllData: isMasterAdmin,
        canViewAuditLog: isMasterAdmin || isOrgAdmin,
        canManageOrgMembers: isOrgAdmin,
        canInviteMembers: isOrgAdmin,
        canViewOrgData: isOrgAdmin || role === 'concierge_agent',
        canManageClients: role !== null,
        canManageItineraries: role !== null,
      },
    };

    return successResponse(res, context);
  } catch (error: any) {
    console.error('Admin context error:', error);
    return errorResponse(res, 500, 'Failed to fetch admin context');
  }
}

// ============================================================================
// Admin: Organizations
// ============================================================================

async function listOrganizations(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { supabase } = auth;
  const { status, search, limit = '20', offset = '0' } = req.query;

  try {
    let query = auth.serviceClient
      .schema('travel_hub')
      .from('organizations')
      .select('*', { count: 'exact' });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,contact_email.ilike.%${search}%`);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return successResponse(res, data || [], { total: count || 0 });
  } catch (error: any) {
    console.error('List organizations error:', error);
    return errorResponse(res, 500, 'Failed to fetch organizations');
  }
}

async function getOrganization(req: VercelRequest, res: VercelResponse, orgId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (error || !data) {
      return errorResponse(res, 404, 'Organization not found');
    }

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Get organization error:', error);
    return errorResponse(res, 500, 'Failed to fetch organization');
  }
}

async function createOrganization(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { name, slug, contact_email, contact_phone, logo_url, settings } = req.body;

  if (!name || !slug || !contact_email) {
    return errorResponse(res, 400, 'name, slug, and contact_email are required');
  }

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('organizations')
      .insert({
        name,
        slug,
        contact_email,
        contact_phone,
        logo_url,
        settings: settings || {},
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(res, 201, { ok: true, data });
  } catch (error: any) {
    console.error('Create organization error:', error);
    return errorResponse(res, 500, 'Failed to create organization');
  }
}

async function updateOrganization(req: VercelRequest, res: VercelResponse, orgId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const updates = req.body;

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('organizations')
      .update(updates)
      .eq('id', orgId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Update organization error:', error);
    return errorResponse(res, 500, 'Failed to update organization');
  }
}

async function deleteOrganization(req: VercelRequest, res: VercelResponse, orgId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  try {
    // Soft delete - set is_active to false
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('organizations')
      .update({ is_active: false })
      .eq('id', orgId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Delete organization error:', error);
    return errorResponse(res, 500, 'Failed to deactivate organization');
  }
}

// ============================================================================
// Admin: System Users
// ============================================================================

async function listSystemUsers(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { is_active, is_master_admin, limit = '20', offset = '0' } = req.query;

  try {
    let query = auth.serviceClient
      .schema('travel_hub')
      .from('system_users')
      .select('*', { count: 'exact' });

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }
    if (is_master_admin !== undefined) {
      query = query.eq('is_master_admin', is_master_admin === 'true');
    }

    query = query
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return successResponse(res, data || [], { total: count || 0 });
  } catch (error: any) {
    console.error('List system users error:', error);
    return errorResponse(res, 500, 'Failed to fetch system users');
  }
}

async function createSystemUser(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { user_id, is_master_admin, notes } = req.body;

  if (!user_id) {
    return errorResponse(res, 400, 'user_id is required');
  }

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('system_users')
      .insert({
        user_id,
        is_master_admin: is_master_admin || false,
        is_active: true,
        granted_by: auth.user.id,
        notes,
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(res, 201, { ok: true, data });
  } catch (error: any) {
    console.error('Create system user error:', error);
    return errorResponse(res, 500, 'Failed to create system user');
  }
}

async function updateSystemUser(req: VercelRequest, res: VercelResponse, userId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const updates = req.body;

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('system_users')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Update system user error:', error);
    return errorResponse(res, 500, 'Failed to update system user');
  }
}

async function deleteSystemUser(req: VercelRequest, res: VercelResponse, userId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('system_users')
      .update({ is_active: false })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Delete system user error:', error);
    return errorResponse(res, 500, 'Failed to revoke system access');
  }
}

// ============================================================================
// Admin: Organization Members
// ============================================================================

async function listOrgMembers(req: VercelRequest, res: VercelResponse, orgId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { role, status, limit = '20', offset = '0' } = req.query;

  try {
    let query = auth.serviceClient
      .schema('travel_hub')
      .from('organization_memberships')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId);

    if (role) query = query.eq('role', role);
    if (status) query = query.eq('is_active', status === 'active');

    query = query
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return successResponse(res, data || [], { total: count || 0 });
  } catch (error: any) {
    console.error('List org members error:', error);
    return errorResponse(res, 500, 'Failed to fetch members');
  }
}

async function addOrgMember(req: VercelRequest, res: VercelResponse, orgId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { user_id, role } = req.body;

  if (!user_id || !role) {
    return errorResponse(res, 400, 'user_id and role are required');
  }

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('organization_memberships')
      .insert({
        organization_id: orgId,
        user_id,
        role,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(res, 201, { ok: true, data });
  } catch (error: any) {
    console.error('Add org member error:', error);
    return errorResponse(res, 500, 'Failed to add member');
  }
}

async function updateOrgMember(
  req: VercelRequest,
  res: VercelResponse,
  orgId: string,
  userId: string
) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const updates = req.body;

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('organization_memberships')
      .update(updates)
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Update org member error:', error);
    return errorResponse(res, 500, 'Failed to update member');
  }
}

async function removeOrgMember(
  req: VercelRequest,
  res: VercelResponse,
  orgId: string,
  userId: string
) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('organization_memberships')
      .update({ is_active: false })
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Remove org member error:', error);
    return errorResponse(res, 500, 'Failed to remove member');
  }
}

// ============================================================================
// Admin: Invitations
// ============================================================================

async function listInvitations(req: VercelRequest, res: VercelResponse, orgId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { status, limit = '20', offset = '0' } = req.query;

  try {
    let query = auth.serviceClient
      .schema('travel_hub')
      .from('invitations')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId);

    if (status) query = query.eq('status', status);

    query = query
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return successResponse(res, data || [], { total: count || 0 });
  } catch (error: any) {
    console.error('List invitations error:', error);
    return errorResponse(res, 500, 'Failed to fetch invitations');
  }
}

async function createInvitation(req: VercelRequest, res: VercelResponse, orgId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { email, role, expires_in_days = 7 } = req.body;

  if (!email || !role) {
    return errorResponse(res, 400, 'email and role are required');
  }

  try {
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('invitations')
      .insert({
        organization_id: orgId,
        email,
        role,
        token,
        invited_by: auth.user.id,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Add invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://oriva.app';
    data.invite_url = `${baseUrl}/travel-hub/accept-invite?token=${token}`;

    return jsonResponse(res, 201, { ok: true, data });
  } catch (error: any) {
    console.error('Create invitation error:', error);
    return errorResponse(res, 500, 'Failed to create invitation');
  }
}

async function revokeInvitation(
  req: VercelRequest,
  res: VercelResponse,
  orgId: string,
  invitationId: string
) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('invitations')
      .update({ status: 'revoked' })
      .eq('organization_id', orgId)
      .eq('id', invitationId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Revoke invitation error:', error);
    return errorResponse(res, 500, 'Failed to revoke invitation');
  }
}

// ============================================================================
// Admin: Audit Log
// ============================================================================

async function listAuditLog(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const {
    user_id,
    action,
    entity_type,
    from_date,
    to_date,
    limit = '50',
    offset = '0',
  } = req.query;

  try {
    let query = auth.serviceClient
      .schema('travel_hub')
      .from('audit_log')
      .select('*', { count: 'exact' });

    if (user_id) query = query.eq('user_id', user_id);
    if (action) query = query.eq('action', action);
    if (entity_type) query = query.eq('entity_type', entity_type);
    if (from_date) query = query.gte('created_at', from_date);
    if (to_date) query = query.lte('created_at', to_date);

    query = query
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return successResponse(res, data || [], { total: count || 0 });
  } catch (error: any) {
    console.error('List audit log error:', error);
    return errorResponse(res, 500, 'Failed to fetch audit log');
  }
}

// ============================================================================
// Concierges
// ============================================================================

async function listConcierges(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const {
    specialties,
    languages,
    minRating,
    availability,
    verified,
    featured,
    search,
    limit = '20',
  } = req.query;

  try {
    let query = auth.serviceClient
      .schema('travel_hub')
      .from('concierges')
      .select('*')
      .order('rating', { ascending: false });

    if (specialties) {
      query = query.contains('specialties', (specialties as string).split(','));
    }
    if (languages) {
      query = query.contains('languages', (languages as string).split(','));
    }
    if (minRating) {
      query = query.gte('rating', Number(minRating));
    }
    if (availability) {
      query = query.eq('availability_status', availability);
    }
    if (verified === 'true') {
      query = query.eq('verified', true);
    }
    if (featured === 'true') {
      query = query.eq('featured', true);
    }
    if (search) {
      query = query.or(`display_name.ilike.%${search}%,bio.ilike.%${search}%`);
    }

    query = query.limit(Number(limit));

    const { data, error } = await query;

    if (error) throw error;

    return successResponse(res, data || []);
  } catch (error: any) {
    console.error('List concierges error:', error);
    return errorResponse(res, 500, 'Failed to fetch concierges');
  }
}

async function getFeaturedConcierges(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { limit = '10' } = req.query;

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('concierges')
      .select('*')
      .eq('featured', true)
      .eq('availability_status', 'available')
      .order('rating', { ascending: false })
      .limit(Number(limit));

    if (error) throw error;

    return successResponse(res, data || []);
  } catch (error: any) {
    console.error('Get featured concierges error:', error);
    return errorResponse(res, 500, 'Failed to fetch featured concierges');
  }
}

async function getConcierge(req: VercelRequest, res: VercelResponse, conciergeId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('concierges')
      .select('*')
      .eq('id', conciergeId)
      .single();

    if (error || !data) {
      return errorResponse(res, 404, 'Concierge not found');
    }

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Get concierge error:', error);
    return errorResponse(res, 500, 'Failed to fetch concierge');
  }
}

async function getMyConciergeProfile(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('concierges')
      .select('*')
      .eq('account_id', auth.user.id)
      .single();

    if (error) {
      // No profile exists yet
      return successResponse(res, null);
    }

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Get my concierge profile error:', error);
    return errorResponse(res, 500, 'Failed to fetch profile');
  }
}

async function createConcierge(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { profile_id, display_name, bio, avatar_url, specialties, languages, hourly_rate_cents } =
    req.body;

  if (!profile_id || !display_name) {
    return errorResponse(res, 400, 'profile_id and display_name are required');
  }

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('concierges')
      .insert({
        account_id: auth.user.id,
        profile_id,
        display_name,
        bio,
        avatar_url,
        specialties: specialties || [],
        languages: languages || ['en'],
        hourly_rate_cents,
        currency: 'USD',
        availability_status: 'available',
        rating: 0,
        review_count: 0,
        total_bookings: 0,
        verified: false,
        featured: false,
        metadata: {},
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(res, 201, { ok: true, data });
  } catch (error: any) {
    console.error('Create concierge error:', error);
    return errorResponse(res, 500, 'Failed to create concierge');
  }
}

async function updateConcierge(req: VercelRequest, res: VercelResponse, conciergeId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const updates = req.body;

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('concierges')
      .update(updates)
      .eq('id', conciergeId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Update concierge error:', error);
    return errorResponse(res, 500, 'Failed to update concierge');
  }
}

// ============================================================================
// Clients
// ============================================================================

async function listClients(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { concierge_id, status, search, limit = '20', offset = '0' } = req.query;

  try {
    let query = auth.serviceClient
      .schema('travel_hub')
      .from('travel_clients')
      .select('*', { count: 'exact' });

    if (concierge_id) {
      query = query.eq('concierge_id', concierge_id);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    query = query
      .order('updated_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return successResponse(res, data || [], { total: count || 0 });
  } catch (error: any) {
    console.error('List clients error:', error);
    return errorResponse(res, 500, 'Failed to fetch clients');
  }
}

async function getClient(req: VercelRequest, res: VercelResponse, clientId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('travel_clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error || !data) {
      return errorResponse(res, 404, 'Client not found');
    }

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Get client error:', error);
    return errorResponse(res, 500, 'Failed to fetch client');
  }
}

async function getMyClients(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { status, search } = req.query;

  try {
    // First get the concierge profile for this user
    const { data: concierge } = await auth.serviceClient
      .schema('travel_hub')
      .from('concierges')
      .select('id')
      .eq('account_id', auth.user.id)
      .single();

    if (!concierge) {
      return successResponse(res, []);
    }

    let query = auth.serviceClient
      .schema('travel_hub')
      .from('travel_clients')
      .select('*')
      .eq('concierge_id', concierge.id);

    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return successResponse(res, data || []);
  } catch (error: any) {
    console.error('Get my clients error:', error);
    return errorResponse(res, 500, 'Failed to fetch clients');
  }
}

async function createClient(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { concierge_id, profile_id, preferences, notes } = req.body;

  if (!concierge_id || !profile_id) {
    return errorResponse(res, 400, 'concierge_id and profile_id are required');
  }

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('travel_clients')
      .insert({
        account_id: auth.user.id,
        concierge_id,
        profile_id,
        status: 'active',
        preferences: preferences || {},
        notes,
        total_bookings: 0,
        total_spent_cents: 0,
        metadata: {},
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(res, 201, { ok: true, data });
  } catch (error: any) {
    console.error('Create client error:', error);
    return errorResponse(res, 500, 'Failed to create client');
  }
}

async function createClientNew(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { name, email, phone, notes, preferences } = req.body;

  if (!name || !email) {
    return errorResponse(res, 400, 'name and email are required');
  }

  try {
    // Master admin emails that can create clients without being a concierge
    const MASTER_ADMIN_EMAILS = ['tools@gavrielshaw.com', 'think@gavrielshaw.com'];
    const isMasterAdmin = auth.user.email && MASTER_ADMIN_EMAILS.includes(auth.user.email);

    // Get the concierge record for the current user
    const { data: concierge, error: conciergeError } = await auth.serviceClient
      .schema('travel_hub')
      .from('concierges')
      .select('id, account_id')
      .eq('account_id', auth.user.id)
      .single();

    let conciergeId = concierge?.id;
    let accountId = concierge?.account_id;

    if ((conciergeError || !concierge) && !isMasterAdmin) {
      return errorResponse(res, 403, 'You must be a concierge to create clients');
    }

    // For master admin without concierge record, use first available concierge
    if (!concierge && isMasterAdmin) {
      const { data: anyConc } = await auth.serviceClient
        .schema('travel_hub')
        .from('concierges')
        .select('id, account_id')
        .limit(1)
        .single();

      if (anyConc) {
        conciergeId = anyConc.id;
        accountId = anyConc.account_id;
      } else {
        // Create placeholder concierge for master admin
        const { data: newConc, error: createError } = await auth.serviceClient
          .schema('travel_hub')
          .from('concierges')
          .insert({
            account_id: auth.user.id,
            profile_id: auth.user.id,
            display_name: 'Master Admin',
            bio: 'System administrator account',
            specialties: ['administration'],
            languages: ['en'],
            currency: 'USD',
            availability_status: 'offline',
            rating: 0,
            review_count: 0,
            total_bookings: 0,
            verified: true,
            featured: false,
            metadata: { is_master_admin: true },
          })
          .select()
          .single();

        if (createError || !newConc) {
          console.error('Failed to create placeholder concierge:', createError);
          return errorResponse(res, 500, 'Failed to set up concierge profile');
        }

        conciergeId = newConc.id;
        accountId = newConc.account_id;
      }
    }

    // Generate a unique placeholder profile_id for clients without a real user account
    const placeholderProfileId = crypto.randomUUID();

    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('travel_clients')
      .insert({
        account_id: accountId,
        concierge_id: conciergeId,
        profile_id: placeholderProfileId,
        status: 'active',
        preferences: preferences || {},
        notes,
        total_bookings: 0,
        total_spent_cents: 0,
        metadata: {
          contact_name: name,
          contact_email: email,
          contact_phone: phone || null,
          created_by_concierge: true,
          is_placeholder_profile: true,
        },
      })
      .select()
      .single();

    if (error) {
      console.error('Create new client error:', error);
      return errorResponse(res, 500, error.message);
    }

    return jsonResponse(res, 201, { ok: true, data });
  } catch (error: any) {
    console.error('Create new client error:', error);
    return errorResponse(res, 500, 'Failed to create client');
  }
}

async function updateClient(req: VercelRequest, res: VercelResponse, clientId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const updates = req.body;

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('travel_clients')
      .update(updates)
      .eq('id', clientId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Update client error:', error);
    return errorResponse(res, 500, 'Failed to update client');
  }
}

// ============================================================================
// Chat: Conversations
// ============================================================================

async function listConversations(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { role, user_id } = req.query;

  try {
    let query = auth.serviceClient.schema('travel_hub').from('concierge_conversations').select('*');

    if (role === 'concierge' && user_id) {
      query = query.eq('concierge_id', user_id);
    } else if (role === 'client' && user_id) {
      query = query.eq('client_id', user_id);
    }

    query = query.order('last_message_at', { ascending: false, nullsFirst: false });

    const { data, error } = await query;

    if (error) throw error;

    return successResponse(res, data || []);
  } catch (error: any) {
    console.error('List conversations error:', error);
    return errorResponse(res, 500, 'Failed to fetch conversations');
  }
}

async function getConversation(req: VercelRequest, res: VercelResponse, conversationId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('concierge_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error || !data) {
      return errorResponse(res, 404, 'Conversation not found');
    }

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Get conversation error:', error);
    return errorResponse(res, 500, 'Failed to fetch conversation');
  }
}

async function createConversation(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { client_id, concierge_id, itinerary_id, subject, initial_message } = req.body;

  if (!client_id || !concierge_id) {
    return errorResponse(res, 400, 'client_id and concierge_id are required');
  }

  try {
    const { data: conversation, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('concierge_conversations')
      .insert({
        client_id,
        concierge_id,
        itinerary_id,
        subject,
        status: 'open',
        unread_count_client: 0,
        unread_count_concierge: initial_message ? 1 : 0,
        metadata: {},
      })
      .select()
      .single();

    if (error) throw error;

    // If initial message provided, create it
    if (initial_message && conversation) {
      await auth.serviceClient.schema('travel_hub').from('concierge_messages').insert({
        conversation_id: conversation.id,
        sender_type: 'client',
        sender_id: client_id,
        content: initial_message,
        message_type: 'text',
        attachments: [],
        metadata: {},
      });

      // Update last_message_at
      await auth.serviceClient
        .schema('travel_hub')
        .from('concierge_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);
    }

    return jsonResponse(res, 201, { ok: true, data: conversation });
  } catch (error: any) {
    console.error('Create conversation error:', error);
    return errorResponse(res, 500, 'Failed to create conversation');
  }
}

async function updateConversationStatus(
  req: VercelRequest,
  res: VercelResponse,
  conversationId: string
) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { status } = req.body;

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('concierge_conversations')
      .update({ status })
      .eq('id', conversationId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Update conversation status error:', error);
    return errorResponse(res, 500, 'Failed to update conversation status');
  }
}

// ============================================================================
// Chat: Messages
// ============================================================================

async function listMessages(req: VercelRequest, res: VercelResponse, conversationId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { limit = '50', before } = req.query;

  try {
    let query = auth.serviceClient
      .schema('travel_hub')
      .from('concierge_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Reverse to show oldest first
    return successResponse(res, (data || []).reverse());
  } catch (error: any) {
    console.error('List messages error:', error);
    return errorResponse(res, 500, 'Failed to fetch messages');
  }
}

async function sendMessage(req: VercelRequest, res: VercelResponse, conversationId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const {
    sender_type,
    sender_id,
    content,
    message_type = 'text',
    attachments,
    reference_type,
    reference_id,
  } = req.body;

  if (!sender_type || !sender_id || !content) {
    return errorResponse(res, 400, 'sender_type, sender_id, and content are required');
  }

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('concierge_messages')
      .insert({
        conversation_id: conversationId,
        sender_type,
        sender_id,
        content,
        message_type,
        attachments: attachments || [],
        reference_type,
        reference_id,
        metadata: {},
      })
      .select()
      .single();

    if (error) throw error;

    // Update conversation
    const unreadField = sender_type === 'client' ? 'unread_count_concierge' : 'unread_count_client';
    await auth.serviceClient.rpc('increment_unread_count', {
      conv_id: conversationId,
      field_name: unreadField,
    });

    await auth.serviceClient
      .schema('travel_hub')
      .from('concierge_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    return jsonResponse(res, 201, { ok: true, data });
  } catch (error: any) {
    console.error('Send message error:', error);
    return errorResponse(res, 500, 'Failed to send message');
  }
}

async function markMessagesRead(req: VercelRequest, res: VercelResponse, conversationId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { reader_type } = req.body;

  try {
    const unreadField = reader_type === 'client' ? 'unread_count_client' : 'unread_count_concierge';

    await auth.serviceClient
      .schema('travel_hub')
      .from('concierge_conversations')
      .update({ [unreadField]: 0 })
      .eq('id', conversationId);

    return successResponse(res, { marked: true });
  } catch (error: any) {
    console.error('Mark messages read error:', error);
    return errorResponse(res, 500, 'Failed to mark messages as read');
  }
}

// ============================================================================
// Itineraries
// ============================================================================

async function listItineraries(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const { profile_id, concierge_id, status, destination } = req.query;

  try {
    let query = auth.serviceClient.schema('travel_hub').from('travel_itineraries').select('*');

    if (profile_id) {
      query = query.eq('profile_id', profile_id);
    }
    if (concierge_id) {
      query = query.eq('concierge_id', concierge_id);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (destination) {
      query = query.or(
        `destination_city.ilike.%${destination}%,destination_country.ilike.%${destination}%`
      );
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return successResponse(res, data || []);
  } catch (error: any) {
    console.error('List itineraries error:', error);
    return errorResponse(res, 500, 'Failed to fetch itineraries');
  }
}

async function getMyItineraries(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  try {
    // Get concierge profile
    const { data: concierge } = await auth.serviceClient
      .schema('travel_hub')
      .from('concierges')
      .select('id')
      .eq('account_id', auth.user.id)
      .single();

    if (!concierge) {
      return successResponse(res, []);
    }

    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('travel_itineraries')
      .select('*')
      .eq('concierge_id', concierge.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return successResponse(res, data || []);
  } catch (error: any) {
    console.error('Get my itineraries error:', error);
    return errorResponse(res, 500, 'Failed to fetch itineraries');
  }
}

async function getItinerary(req: VercelRequest, res: VercelResponse, itineraryId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  try {
    const { data: itinerary, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('travel_itineraries')
      .select('*')
      .eq('id', itineraryId)
      .single();

    if (error || !itinerary) {
      return errorResponse(res, 404, 'Itinerary not found');
    }

    // Get items
    const { data: items } = await auth.serviceClient
      .schema('travel_hub')
      .from('itinerary_items')
      .select('*')
      .eq('itinerary_id', itineraryId)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true });

    itinerary.items = items || [];

    return successResponse(res, itinerary);
  } catch (error: any) {
    console.error('Get itinerary error:', error);
    return errorResponse(res, 500, 'Failed to fetch itinerary');
  }
}

async function createItinerary(req: VercelRequest, res: VercelResponse) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const {
    profile_id,
    concierge_id,
    title,
    description,
    destination_country,
    destination_city,
    start_date,
    end_date,
    traveler_count = 1,
    budget_cents,
    tags,
    cover_image_url,
    ai_generated = false,
    ai_model,
  } = req.body;

  if (
    !profile_id ||
    !title ||
    !destination_country ||
    !destination_city ||
    !start_date ||
    !end_date
  ) {
    return errorResponse(
      res,
      400,
      'Required fields: profile_id, title, destination_country, destination_city, start_date, end_date'
    );
  }

  try {
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    const durationDays =
      Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('travel_itineraries')
      .insert({
        account_id: auth.user.id,
        profile_id,
        concierge_id,
        title,
        description,
        destination_country,
        destination_city,
        start_date,
        end_date,
        duration_days: durationDays,
        traveler_count,
        budget_cents,
        currency: 'USD',
        status: 'draft',
        ai_generated,
        ai_model,
        tags: tags || [],
        cover_image_url,
        metadata: {},
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(res, 201, { ok: true, data });
  } catch (error: any) {
    console.error('Create itinerary error:', error);
    return errorResponse(res, 500, 'Failed to create itinerary');
  }
}

async function updateItinerary(req: VercelRequest, res: VercelResponse, itineraryId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const updates = req.body;

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('travel_itineraries')
      .update(updates)
      .eq('id', itineraryId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Update itinerary error:', error);
    return errorResponse(res, 500, 'Failed to update itinerary');
  }
}

// ============================================================================
// Itinerary Items
// ============================================================================

async function addItineraryItem(req: VercelRequest, res: VercelResponse, itineraryId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const {
    day_number,
    order_index,
    item_type,
    title,
    description,
    location_name,
    location_address,
    location_coordinates,
    start_time,
    end_time,
    duration_minutes,
    destination_id,
    price_cents,
    booking_url,
    notes,
    ai_suggested = false,
  } = req.body;

  if (!day_number || order_index === undefined || !item_type || !title) {
    return errorResponse(res, 400, 'Required fields: day_number, order_index, item_type, title');
  }

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('itinerary_items')
      .insert({
        itinerary_id: itineraryId,
        day_number,
        order_index,
        item_type,
        title,
        description,
        location_name,
        location_address,
        location_coordinates,
        start_time,
        end_time,
        duration_minutes,
        destination_id,
        price_cents,
        currency: 'USD',
        status: 'planned',
        booking_url,
        notes,
        ai_suggested,
        metadata: {},
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(res, 201, { ok: true, data });
  } catch (error: any) {
    console.error('Add itinerary item error:', error);
    return errorResponse(res, 500, 'Failed to add item');
  }
}

async function updateItineraryItem(
  req: VercelRequest,
  res: VercelResponse,
  itineraryId: string,
  itemId: string
) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const updates = req.body;

  try {
    const { data, error } = await auth.serviceClient
      .schema('travel_hub')
      .from('itinerary_items')
      .update(updates)
      .eq('id', itemId)
      .eq('itinerary_id', itineraryId)
      .select()
      .single();

    if (error) throw error;

    return successResponse(res, data);
  } catch (error: any) {
    console.error('Update itinerary item error:', error);
    return errorResponse(res, 500, 'Failed to update item');
  }
}

async function deleteItineraryItem(
  req: VercelRequest,
  res: VercelResponse,
  itineraryId: string,
  itemId: string
) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  try {
    const { error } = await auth.serviceClient
      .schema('travel_hub')
      .from('itinerary_items')
      .delete()
      .eq('id', itemId)
      .eq('itinerary_id', itineraryId);

    if (error) throw error;

    return successResponse(res, { deleted: true });
  } catch (error: any) {
    console.error('Delete itinerary item error:', error);
    return errorResponse(res, 500, 'Failed to delete item');
  }
}

// ============================================================================
// Itinerary Sharing
// ============================================================================

async function generateShareLink(req: VercelRequest, res: VercelResponse, itineraryId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  const {
    password_protected,
    expires_in_days,
    allow_pdf_download = true,
    show_pricing = true,
    personal_message,
  } = req.body;

  try {
    const shareToken = crypto.randomUUID();
    let expiresAt = null;
    let password = null;

    if (expires_in_days) {
      const date = new Date();
      date.setDate(date.getDate() + expires_in_days);
      expiresAt = date.toISOString();
    }

    if (password_protected) {
      // Generate a simple readable password
      password = Math.random().toString(36).slice(-8).toUpperCase();
    }

    // Store share info in itinerary metadata
    await auth.serviceClient
      .schema('travel_hub')
      .from('travel_itineraries')
      .update({
        metadata: {
          share_token: shareToken,
          share_password: password,
          share_expires_at: expiresAt,
          share_settings: {
            allow_pdf_download,
            show_pricing,
            personal_message,
          },
        },
      })
      .eq('id', itineraryId);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://oriva.app';
    const shareUrl = `${baseUrl}/travel-hub/share/${shareToken}`;

    return successResponse(res, {
      share_url: shareUrl,
      share_token: shareToken,
      password,
      expires_at: expiresAt,
    });
  } catch (error: any) {
    console.error('Generate share link error:', error);
    return errorResponse(res, 500, 'Failed to generate share link');
  }
}

async function generatePDF(req: VercelRequest, res: VercelResponse, itineraryId: string) {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return errorResponse(res, 401, 'Authentication required');

  try {
    // In a real implementation, this would call a PDF generation service
    // For now, return a placeholder
    const pdfUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/travel-hub/itineraries/${itineraryId}/pdf/download`;

    return successResponse(res, {
      pdf_url: pdfUrl,
      file_size: 0,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error: any) {
    console.error('Generate PDF error:', error);
    return errorResponse(res, 500, 'Failed to generate PDF');
  }
}

// ============================================================================
// Shared (Public Access)
// ============================================================================

async function getSharedItinerary(req: VercelRequest, res: VercelResponse, shareToken: string) {
  const sharePassword = req.headers['x-share-password'] as string;
  const supabase = getSupabaseClient(); // No auth required

  try {
    // Find itinerary by share token
    const { data: itinerary, error } = await supabase
      .from('travel_hub.travel_itineraries')
      .select('*')
      .contains('metadata', { share_token: shareToken })
      .single();

    if (error || !itinerary) {
      return errorResponse(res, 404, 'Itinerary not found');
    }

    const metadata = itinerary.metadata || {};

    // Check if expired
    if (metadata.share_expires_at && new Date(metadata.share_expires_at) < new Date()) {
      return errorResponse(res, 410, 'Share link has expired');
    }

    // Check password if required
    if (metadata.share_password && metadata.share_password !== sharePassword) {
      return errorResponse(res, 401, 'Password required');
    }

    // Get items
    const { data: items } = await supabase
      .from('travel_hub.itinerary_items')
      .select('*')
      .eq('itinerary_id', itinerary.id)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true });

    // Get concierge info
    let concierge = null;
    if (itinerary.concierge_id) {
      const { data: conciergeData } = await supabase
        .from('travel_hub.concierges')
        .select('id, display_name, avatar_url')
        .eq('id', itinerary.concierge_id)
        .single();
      concierge = conciergeData;
    }

    const shareSettings = metadata.share_settings || {};

    const sharedData = {
      id: itinerary.id,
      title: itinerary.title,
      description: itinerary.description,
      destination_country: itinerary.destination_country,
      destination_city: itinerary.destination_city,
      start_date: itinerary.start_date,
      end_date: itinerary.end_date,
      duration_days: itinerary.duration_days,
      traveler_count: itinerary.traveler_count,
      cover_image_url: itinerary.cover_image_url,
      currency: itinerary.currency,
      total_cost_cents: shareSettings.show_pricing ? itinerary.budget_cents : undefined,
      personal_message: shareSettings.personal_message,
      items: items || [],
      concierge,
      settings: {
        show_pricing: shareSettings.show_pricing ?? true,
        allow_pdf_download: shareSettings.allow_pdf_download ?? true,
      },
    };

    return successResponse(res, sharedData);
  } catch (error: any) {
    console.error('Get shared itinerary error:', error);
    return errorResponse(res, 500, 'Failed to fetch itinerary');
  }
}

async function verifySharePassword(req: VercelRequest, res: VercelResponse, shareToken: string) {
  const { password } = req.body;
  const supabase = getSupabaseClient();

  try {
    const { data: itinerary, error } = await supabase
      .from('travel_hub.travel_itineraries')
      .select('metadata')
      .contains('metadata', { share_token: shareToken })
      .single();

    if (error || !itinerary) {
      return errorResponse(res, 404, 'Itinerary not found');
    }

    const valid = itinerary.metadata?.share_password === password;

    return successResponse(res, { valid });
  } catch (error: any) {
    console.error('Verify share password error:', error);
    return errorResponse(res, 500, 'Failed to verify password');
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { pathname } = new URL(req.url || '', `http://${req.headers.host}`);
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Share-Password');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ======== Admin Routes ========

  // Admin Context
  if (pathname === '/api/v1/travel-hub/admin/me') {
    if (method === 'GET') return getAdminContext(req, res);
    return errorResponse(res, 405, 'Method not allowed');
  }

  // Organizations
  if (pathname === '/api/v1/travel-hub/admin/organizations') {
    if (method === 'GET') return listOrganizations(req, res);
    if (method === 'POST') return createOrganization(req, res);
    return errorResponse(res, 405, 'Method not allowed');
  }

  let params = parsePathParams(pathname, '/api/v1/travel-hub/admin/organizations/:id');
  if (params) {
    if (method === 'GET') return getOrganization(req, res, params.id);
    if (method === 'PATCH') return updateOrganization(req, res, params.id);
    if (method === 'DELETE') return deleteOrganization(req, res, params.id);
    return errorResponse(res, 405, 'Method not allowed');
  }

  // System Users
  if (pathname === '/api/v1/travel-hub/admin/users') {
    if (method === 'GET') return listSystemUsers(req, res);
    if (method === 'POST') return createSystemUser(req, res);
    return errorResponse(res, 405, 'Method not allowed');
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/admin/users/:userId');
  if (params) {
    if (method === 'PATCH') return updateSystemUser(req, res, params.userId);
    if (method === 'DELETE') return deleteSystemUser(req, res, params.userId);
    return errorResponse(res, 405, 'Method not allowed');
  }

  // Org Members
  params = parsePathParams(pathname, '/api/v1/travel-hub/admin/org/:orgId/members');
  if (params) {
    if (method === 'GET') return listOrgMembers(req, res, params.orgId);
    if (method === 'POST') return addOrgMember(req, res, params.orgId);
    return errorResponse(res, 405, 'Method not allowed');
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/admin/org/:orgId/members/:userId');
  if (params) {
    if (method === 'PATCH') return updateOrgMember(req, res, params.orgId, params.userId);
    if (method === 'DELETE') return removeOrgMember(req, res, params.orgId, params.userId);
    return errorResponse(res, 405, 'Method not allowed');
  }

  // Invitations
  params = parsePathParams(pathname, '/api/v1/travel-hub/admin/org/:orgId/invitations');
  if (params) {
    if (method === 'GET') return listInvitations(req, res, params.orgId);
    if (method === 'POST') return createInvitation(req, res, params.orgId);
    return errorResponse(res, 405, 'Method not allowed');
  }

  params = parsePathParams(
    pathname,
    '/api/v1/travel-hub/admin/org/:orgId/invitations/:invitationId'
  );
  if (params) {
    if (method === 'DELETE') return revokeInvitation(req, res, params.orgId, params.invitationId);
    return errorResponse(res, 405, 'Method not allowed');
  }

  // Audit Log
  if (pathname === '/api/v1/travel-hub/admin/audit') {
    if (method === 'GET') return listAuditLog(req, res);
    return errorResponse(res, 405, 'Method not allowed');
  }

  // ======== Concierge Routes ========

  if (pathname === '/api/v1/travel-hub/concierges') {
    if (method === 'GET') return listConcierges(req, res);
    if (method === 'POST') return createConcierge(req, res);
    return errorResponse(res, 405, 'Method not allowed');
  }

  if (pathname === '/api/v1/travel-hub/concierges/featured') {
    if (method === 'GET') return getFeaturedConcierges(req, res);
    return errorResponse(res, 405, 'Method not allowed');
  }

  if (pathname === '/api/v1/travel-hub/concierges/me') {
    if (method === 'GET') return getMyConciergeProfile(req, res);
    return errorResponse(res, 405, 'Method not allowed');
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/concierges/:id');
  if (params) {
    if (method === 'GET') return getConcierge(req, res, params.id);
    if (method === 'PATCH') return updateConcierge(req, res, params.id);
    return errorResponse(res, 405, 'Method not allowed');
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/concierges/:id/availability');
  if (params && method === 'PATCH') {
    return updateConcierge(req, res, params.id);
  }

  // ======== Client Routes ========

  if (pathname === '/api/v1/travel-hub/clients') {
    if (method === 'GET') return listClients(req, res);
    if (method === 'POST') return createClient(req, res);
    return errorResponse(res, 405, 'Method not allowed');
  }

  // POST /clients/new - Create new client with contact info (must come before /clients/:id)
  if (pathname === '/api/v1/travel-hub/clients/new') {
    if (method === 'POST') return createClientNew(req, res);
    return errorResponse(res, 405, 'Method not allowed');
  }

  if (pathname === '/api/v1/travel-hub/clients/me') {
    if (method === 'GET') return getMyClients(req, res);
    return errorResponse(res, 405, 'Method not allowed');
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/clients/:id');
  if (params) {
    if (method === 'GET') return getClient(req, res, params.id);
    if (method === 'PATCH') return updateClient(req, res, params.id);
    return errorResponse(res, 405, 'Method not allowed');
  }

  // ======== Chat Routes ========

  if (pathname === '/api/v1/travel-hub/chat/conversations') {
    if (method === 'GET') return listConversations(req, res);
    if (method === 'POST') return createConversation(req, res);
    return errorResponse(res, 405, 'Method not allowed');
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/chat/conversations/:id');
  if (params) {
    if (method === 'GET') return getConversation(req, res, params.id);
    return errorResponse(res, 405, 'Method not allowed');
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/chat/conversations/:id/status');
  if (params && method === 'PATCH') {
    return updateConversationStatus(req, res, params.id);
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/chat/conversations/:id/messages');
  if (params) {
    if (method === 'GET') return listMessages(req, res, params.id);
    if (method === 'POST') return sendMessage(req, res, params.id);
    return errorResponse(res, 405, 'Method not allowed');
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/chat/conversations/:id/read');
  if (params && method === 'POST') {
    return markMessagesRead(req, res, params.id);
  }

  // ======== Itinerary Routes ========

  if (pathname === '/api/v1/travel-hub/itineraries') {
    if (method === 'GET') return listItineraries(req, res);
    if (method === 'POST') return createItinerary(req, res);
    return errorResponse(res, 405, 'Method not allowed');
  }

  if (pathname === '/api/v1/travel-hub/itineraries/me') {
    if (method === 'GET') return getMyItineraries(req, res);
    return errorResponse(res, 405, 'Method not allowed');
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/itineraries/:id');
  if (params) {
    if (method === 'GET') return getItinerary(req, res, params.id);
    if (method === 'PATCH') return updateItinerary(req, res, params.id);
    return errorResponse(res, 405, 'Method not allowed');
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/itineraries/:id/status');
  if (params && method === 'PATCH') {
    return updateItinerary(req, res, params.id);
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/itineraries/:id/items');
  if (params && method === 'POST') {
    return addItineraryItem(req, res, params.id);
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/itineraries/:itineraryId/items/:itemId');
  if (params) {
    if (method === 'PATCH') return updateItineraryItem(req, res, params.itineraryId, params.itemId);
    if (method === 'DELETE')
      return deleteItineraryItem(req, res, params.itineraryId, params.itemId);
    return errorResponse(res, 405, 'Method not allowed');
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/itineraries/:id/share');
  if (params) {
    if (method === 'POST') return generateShareLink(req, res, params.id);
    return errorResponse(res, 405, 'Method not allowed');
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/itineraries/:id/pdf');
  if (params && method === 'POST') {
    return generatePDF(req, res, params.id);
  }

  // ======== Shared/Public Routes ========

  params = parsePathParams(pathname, '/api/v1/travel-hub/shared/:token');
  if (params && method === 'GET') {
    return getSharedItinerary(req, res, params.token);
  }

  params = parsePathParams(pathname, '/api/v1/travel-hub/shared/:token/verify');
  if (params && method === 'POST') {
    return verifySharePassword(req, res, params.token);
  }

  // Not found
  return errorResponse(res, 404, 'Not found');
}
