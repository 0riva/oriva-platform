/**
 * User, Sessions, Profiles, Groups & Entries Routes
 * Mounted at /api/v1 (subpaths: /user/*, /users/me, /sessions/*, /team/*,
 * /analytics/*, /auth/profile, /profiles/*, /groups/*, /entries, /templates,
 * /storage, /ui/notifications)
 *
 * Extracted from api/index.ts (Phase 4 sub-router migration).
 * Handlers close over module-level singletons from index.ts, passed in via factory.
 *
 * NOTE: this router registers GET /auth/profile (the withAuthContext keyInfo
 * version). It must be mounted BEFORE the /api/v1/auth sub-router so Express
 * first-match keeps this handler live — preserving pre-extraction behaviour.
 */

import { Router, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import type { ApiKeyInfo } from '../../types/middleware/auth';
import type { ApiResponse, PaginatedResponse } from '../../types/api/responses';
import {
  AUDIENCE_TYPES,
  type AudienceType,
  type Entry,
  type Group,
  type Profile,
} from '../../types/database/entities';
import { ProfileIdParamSchema, UpdateProfileBodySchema } from '../../openapi/schemas/profiles';
import { GroupIdParamSchema } from '../../openapi/schemas/groups';
import { validateRequestData, ValidationError } from '../../middleware/validation';
import type { ExpressAuthenticatedRequest } from '../../middleware/auth';
import { respondWithError } from '../utils/response';
import { toNumber } from '../utils/query';

type ProfileRecord = Pick<
  Profile,
  | 'id'
  | 'username'
  | 'display_name'
  | 'bio'
  | 'location'
  | 'website_url'
  | 'avatar_url'
  | 'created_at'
  | 'updated_at'
  | 'account_id'
> & {
  is_active?: boolean | null;
  is_default?: boolean | null;
};

type ProfileSummary = {
  profileId: string;
  profileName: string;
  isActive: boolean;
  avatar: string | null;
  isDefault: boolean;
};

type ActiveProfileSummary = ProfileSummary;

type TeamMember = {
  memberId: string;
  displayName: string;
  role: string;
  joinedAt: string;
  avatar: string | null;
};

type GroupSummary = {
  groupId: string;
  groupName: string;
  memberCount: number;
  isActive: boolean;
  role: string;
  description: string | null;
  image_url: string | null; // OCR-82: Optional group image
  external_link: string | null; // OCR-82: Optional external link
};

type AuthenticatedHandler = (req: any, res: any, keyInfo: ApiKeyInfo) => Promise<void> | void;

type WithAuthContext = (handler: AuthenticatedHandler) => RequestHandler;

const normalizeAudienceType = (value: string): AudienceType =>
  AUDIENCE_TYPES.includes(value as AudienceType) ? (value as AudienceType) : 'public';

export function createUserPublicRouter(
  supabase: SupabaseClient,
  logger: Logger,
  validateApiKey: RequestHandler,
  validateAuth: RequestHandler[],
  withAuthContext: WithAuthContext
): Router {
  const router = Router();

  // User endpoints
  router.get(
    '/user/me',
    validateApiKey,
    withAuthContext(async (_req, res, keyInfo) => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(
            'id, username, display_name, bio, location, website_url, avatar_url, created_at, updated_at, account_id'
          )
          .eq('account_id', keyInfo.userId)
          .eq('is_active', true)
          .eq('is_default', true)
          .single();

        if (error || !profile) {
          logger.error('Failed to fetch user profile', { error });
          respondWithError(res, 500, 'USER_PROFILE_ERROR', 'Failed to fetch user profile');
          return;
        }

        res.json({
          ok: true,
          success: true,
          data: {
            id: profile.account_id,
            username: profile.username,
            displayName: profile.display_name || profile.username,
            email: keyInfo.authType === 'supabase_auth' ? keyInfo.name : null,
            bio: profile.bio,
            location: profile.location,
            website: profile.website_url,
            avatar: profile.avatar_url,
            createdAt: profile.created_at,
            updatedAt: profile.updated_at,
            apiKeyInfo: {
              keyId: keyInfo.id,
              name: keyInfo.name,
              userId: keyInfo.userId,
              permissions: keyInfo.permissions,
              usageCount: keyInfo.usageCount,
            },
          },
        });
      } catch (error) {
        logger.error('User profile endpoint error', { error });
        respondWithError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
      }
    })
  );

  // Alternative plural endpoint for compatibility
  router.get('/users/me', validateApiKey, async (req, res, next) => {
    // Re-dispatch internally to the canonical /user/me handler
    req.url = '/user/me';
    router(req, res, next);
  });

  // =============================================================================
  // SESSION ENDPOINTS
  // =============================================================================

  // Get user's sessions
  router.get('/sessions', validateApiKey, async (req, res) => {
    try {
      // Sessions are not implemented in the current Oriva Core schema
      // Return empty array until sessions feature is added
      res.json({
        ok: true,
        success: true,
        data: [],
        meta: {
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        },
        message: 'Sessions feature not yet implemented',
      });
    } catch (error) {
      logger.error('Failed to fetch sessions', { error });
      respondWithError(res, 500, 'SESSIONS_ERROR', 'Failed to fetch sessions');
    }
  });

  // Get upcoming sessions
  router.get('/sessions/upcoming', validateApiKey, async (req, res) => {
    try {
      // Sessions are not implemented in the current Oriva Core schema
      res.json({
        ok: true,
        success: true,
        data: [],
        message: 'Sessions feature not yet implemented',
      });
    } catch (error) {
      logger.error('Failed to fetch upcoming sessions', { error });
      respondWithError(res, 500, 'SESSIONS_ERROR', 'Failed to fetch upcoming sessions');
    }
  });

  // =============================================================================
  // TEAM ENDPOINTS
  // =============================================================================

  // Get team members
  router.get(
    '/team/members',
    validateApiKey,
    withAuthContext(async (_req, res, keyInfo) => {
      try {
        // Team concept maps to groups in Oriva Core
        // Return user's group memberships as "team members"
        const { data: groupMemberships, error } = await supabase
          .from('group_members')
          .select(
            `
          groups!inner (
            id,
            name
          ),
          profiles!inner (
            id,
            display_name,
            username,
            avatar_url
          ),
          role,
          joined_at
        `
          )
          .eq('profile_id', keyInfo.userId)
          .eq('is_active', true);

        if (error) {
          logger.error('Failed to fetch team members', { error, userId: keyInfo.userId });
          res.json({
            ok: true,
            success: true,
            data: [],
            meta: {
              total: 0,
              roles: [],
            },
            message: 'No team memberships found',
          });
          return;
        }

        type GroupMembershipRecord = {
          role: string;
          joined_at: string;
          profiles: {
            id: string;
            display_name: string | null;
            username: string;
            avatar_url: string | null;
          };
          groups: {
            name: string;
          };
        };

        const memberships = (groupMemberships ?? []) as unknown as GroupMembershipRecord[];

        const teamMembers = memberships.map((member) => ({
          memberId: member.profiles.id,
          name: member.profiles.display_name || member.profiles.username,
          email: null as string | null,
          role: member.role,
          avatar: member.profiles.avatar_url,
          status: 'active' as const,
          joinedAt: member.joined_at,
          groupName: member.groups.name,
        }));

        const roles = [...new Set(teamMembers.map((member) => member.role))];

        res.json({
          ok: true,
          success: true,
          data: teamMembers,
          meta: {
            total: teamMembers.length,
            roles,
          },
        });
      } catch (error) {
        logger.error('Failed to fetch team members', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'TEAM_MEMBERS_ERROR', 'Failed to fetch team members');
      }
    })
  );

  // =============================================================================
  // ANALYTICS ENDPOINTS
  // =============================================================================

  // Get analytics summary
  router.get(
    '/analytics/summary',
    validateApiKey,
    withAuthContext(async (_req, res, keyInfo) => {
      try {
        // Get real analytics from database
        const [entriesCount, responsesCount, groupsCount, installedAppsCount] = await Promise.all([
          supabase
            .from('entries')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', keyInfo.userId),
          supabase
            .from('responses')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', keyInfo.userId),
          supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', keyInfo.userId)
            .eq('is_active', true),
          supabase
            .from('user_app_installs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', keyInfo.userId)
            .eq('is_active', true),
        ]);

        const analytics = {
          overview: {
            totalEntries: entriesCount.count || 0,
            totalResponses: responsesCount.count || 0,
            totalGroups: groupsCount.count || 0,
            installedApps: installedAppsCount.count || 0,
          },
          metrics: {
            entriesGrowth: 'N/A', // Would need historical data
            responseGrowth: 'N/A',
            groupActivity: 'N/A',
            appUsage: 'N/A',
          },
          recentActivity: [], // Would need activity log table
          timeRange: {
            start: new Date(Date.now() - 604800000).toISOString(), // 7 days ago
            end: new Date().toISOString(),
          },
        };

        res.json({
          ok: true,
          success: true,
          data: analytics,
          message: 'Real analytics based on user data',
        });
      } catch (error) {
        logger.error('Failed to fetch analytics summary', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'ANALYTICS_ERROR', 'Failed to fetch analytics summary');
      }
    })
  );

  // =============================================================================
  // AUTH ENDPOINTS
  // =============================================================================

  // Get auth profile (similar to user/me but focused on auth data)
  router.get(
    '/auth/profile',
    validateAuth,
    withAuthContext((_, res, keyInfo) => {
      try {
        res.json({
          ok: true,
          success: true,
          data: {
            id: keyInfo.userId,
            email: keyInfo.authType === 'supabase_auth' ? keyInfo.name : null,
            displayName: keyInfo.name,
            avatar: null,
            authType: keyInfo.authType,
            permissions: keyInfo.permissions,
            lastLogin: new Date().toISOString(),
            accountStatus: 'active',
            twoFactorEnabled: false,
            emailVerified: true,
          },
        });
      } catch (error) {
        logger.error('Failed to fetch auth profile', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'AUTH_PROFILE_ERROR', 'Failed to fetch auth profile');
      }
    })
  );

  // =============================================================================
  // PROFILE ENDPOINTS
  // =============================================================================

  // Get available profiles for the extension
  router.get(
    '/profiles/available',
    validateApiKey,
    withAuthContext(async (_req, res, keyInfo) => {
      try {
        // Get real profiles from Supabase database (excluding anonymous profiles for third-party apps)
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select(
            'id, username, display_name, bio, location, website_url, avatar_url, created_at, updated_at, account_id, is_active, is_default'
          )
          .eq('account_id', keyInfo.userId)
          .eq('is_active', true)
          .eq('is_anonymous', false)
          .order('created_at', { ascending: true });

        if (error) {
          logger.error('Failed to fetch profiles from database', { error, userId: keyInfo.userId });
          const fallbackProfiles = [
            {
              profileId: 'ext_fallback_profile',
              profileName: 'My Profile',
              isActive: true,
              avatar: null,
              isDefault: true,
            },
          ];

          res.json({
            ok: true,
            success: true,
            data: fallbackProfiles,
            message: 'Using fallback data due to database error',
          });
          return;
        }

        // Transform database profiles to API format
        type ProfileRecord = {
          id: string;
          display_name: string | null;
          username: string | null;
          avatar_url: string | null;
          is_active: boolean;
          is_default: boolean;
        };

        const profileRecords = (profiles ?? []) as ProfileRecord[];
        const transformedProfiles: ProfileSummary[] = profileRecords.map((profile) => ({
          profileId: profile.id,
          profileName: profile.display_name ?? profile.username ?? 'Unnamed Profile',
          isActive: Boolean(profile.is_active),
          avatar: profile.avatar_url ?? null,
          isDefault: Boolean(profile.is_default),
        }));

        const response: ApiResponse<ProfileSummary[]> = {
          ok: true,
          success: true,
          data: transformedProfiles,
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to fetch available profiles', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'PROFILES_ERROR', 'Failed to fetch profiles');
      }
    })
  );

  // Get currently active profile
  router.get(
    '/profiles/active',
    validateApiKey,
    withAuthContext(async (_req, res, keyInfo) => {
      try {
        // Get the default (primary) profile from Supabase database (excluding anonymous profiles for third-party apps)
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(
            'id, username, display_name, bio, location, website_url, avatar_url, created_at, updated_at, account_id, is_active, is_default'
          )
          .eq('account_id', keyInfo.userId)
          .eq('is_active', true)
          .eq('is_default', true)
          .eq('is_anonymous', false)
          .single();

        if (error) {
          logger.error('Failed to fetch active profile from database', {
            error,
            userId: keyInfo.userId,
          });
          const fallbackProfile = {
            profileId: 'ext_fallback_active',
            profileName: 'My Active Profile',
            isActive: true,
            avatar: null,
            isDefault: true,
          };

          res.json({
            ok: true,
            success: true,
            data: fallbackProfile,
            message: 'Using fallback data due to database error',
          });
          return;
        }

        // Transform database profile to API format
        const profileRecord = profile as ProfileRecord;
        const activeProfile: ActiveProfileSummary = {
          profileId: profileRecord.id,
          profileName: profileRecord.display_name ?? profileRecord.username ?? 'Unnamed Profile',
          isActive: Boolean(profileRecord.is_active),
          avatar: profileRecord.avatar_url ?? null,
          isDefault: Boolean(profileRecord.is_default),
        };

        const response: ApiResponse<ActiveProfileSummary> = {
          ok: true,
          success: true,
          data: activeProfile,
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to fetch active profile', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'PROFILES_ERROR', 'Failed to fetch active profile');
      }
    })
  );

  // Update profile information
  router.put(
    '/profiles/:profileId',
    validateApiKey,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { profileId } = validateRequestData(ProfileIdParamSchema, req.params);
        const { profileName, avatar, bio, location } = validateRequestData(
          UpdateProfileBodySchema,
          req.body ?? {}
        );

        const updates: Record<string, unknown> = {};
        if (profileName !== undefined) updates.display_name = profileName;
        if (avatar !== undefined) updates.avatar_url = avatar;
        if (bio !== undefined) updates.bio = bio;
        if (location !== undefined) updates.location = location;

        if (Object.keys(updates).length === 0) {
          return respondWithError(
            res,
            400,
            'VALIDATION_ERROR',
            'At least one field must be provided'
          );
        }

        // Ownership: only update a profile owned by the caller's account.
        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', profileId)
          .eq('account_id', keyInfo.userId)
          .select('id, display_name, username, bio, location, avatar_url, is_active, updated_at')
          .single();

        if (error || !data) {
          return respondWithError(res, 404, 'PROFILE_NOT_FOUND', 'Profile not found');
        }

        res.json({
          ok: true,
          success: true,
          data,
          message: 'Profile updated successfully',
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          respondWithError(res, 400, 'VALIDATION_ERROR', error.message, error.details as unknown[]);
          return;
        }
        logger.error('Failed to update profile', {
          error,
          profileId: req.params.profileId,
          userId: keyInfo.userId,
        });
        respondWithError(res, 500, 'PROFILES_ERROR', 'Failed to update profile');
      }
    })
  );

  // Switch the account's default/active profile
  router.post(
    '/profiles/:profileId/activate',
    validateApiKey,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { profileId } = validateRequestData(ProfileIdParamSchema, req.params);

        // Ownership: confirm the target profile belongs to the caller.
        const { data: target, error: lookupError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', profileId)
          .eq('account_id', keyInfo.userId)
          .single();

        if (lookupError || !target) {
          return respondWithError(res, 404, 'PROFILE_NOT_FOUND', 'Profile not found');
        }

        // Clear is_default across the account's profiles, then set it on the
        // target. Both updates are scoped by account_id.
        await supabase
          .from('profiles')
          .update({ is_default: false })
          .eq('account_id', keyInfo.userId);

        const { error: activateError } = await supabase
          .from('profiles')
          .update({ is_default: true })
          .eq('id', profileId)
          .eq('account_id', keyInfo.userId);

        if (activateError) {
          logger.error('Failed to switch profile', {
            error: activateError,
            profileId,
            userId: keyInfo.userId,
          });
          return respondWithError(res, 500, 'PROFILES_ERROR', 'Failed to switch profile');
        }

        res.json({
          ok: true,
          success: true,
          data: {
            activeProfile: profileId,
            switchedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          respondWithError(res, 400, 'VALIDATION_ERROR', error.message, error.details as unknown[]);
          return;
        }
        logger.error('Failed to switch profile', { error, profileId: req.params.profileId });
        respondWithError(res, 500, 'PROFILES_ERROR', 'Failed to switch profile');
      }
    })
  );

  // =============================================================================
  // GROUP ENDPOINTS
  // =============================================================================

  // Get user's groups
  router.get(
    '/groups',
    validateApiKey,
    withAuthContext(async (_req, res, keyInfo) => {
      try {
        // Step 1: Get user's profiles (profiles.account_id = keyInfo.userId)
        const { data: userProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id')
          .eq('account_id', keyInfo.userId)
          .eq('is_active', true);

        if (profilesError) {
          logger.error('Failed to fetch user profiles', {
            profilesError,
            userId: keyInfo.userId,
          });
        }

        const profileIds = (userProfiles ?? []).map((p) => p.id);

        // Step 2: Get groups created by user (groups.created_by = keyInfo.userId)
        const { data: createdGroups, error: createdGroupsError } = await supabase
          .from('groups')
          .select('id, name, description, is_private, image_url, external_link, created_at')
          .eq('created_by', keyInfo.userId);

        if (createdGroupsError) {
          logger.error('Failed to fetch created groups', {
            createdGroupsError,
            userId: keyInfo.userId,
          });
        }

        // Step 3: Get profile_memberships for user's profiles
        let joinedGroupIds: string[] = [];
        let profileMemberships: Array<{ group_id: string; role: string }> = [];

        if (profileIds.length > 0) {
          const { data: memberships, error: membershipsError } = await supabase
            .from('profile_memberships')
            .select('group_id, role')
            .in('profile_id', profileIds)
            .eq('is_active', true);

          if (membershipsError) {
            logger.error('Failed to fetch profile memberships', {
              membershipsError,
              userId: keyInfo.userId,
              profileIds,
            });
          } else {
            profileMemberships = (memberships ?? []) as Array<{ group_id: string; role: string }>;
            joinedGroupIds = [...new Set(profileMemberships.map((m) => m.group_id))];
          }
        }

        // Step 4: Get groups for joined group_ids (exclude already created groups)
        const createdGroupIds = new Set((createdGroups ?? []).map((g) => g.id));
        const joinedGroupIdsToFetch = joinedGroupIds.filter((id) => !createdGroupIds.has(id));

        let joinedGroups: Array<{
          id: string;
          name: string;
          description: string | null;
          is_private: boolean;
          image_url: string | null;
          external_link: string | null;
          created_at: string;
        }> = [];

        if (joinedGroupIdsToFetch.length > 0) {
          const { data: joinedGroupsData, error: joinedGroupsError } = await supabase
            .from('groups')
            .select('id, name, description, is_private, image_url, external_link, created_at')
            .in('id', joinedGroupIdsToFetch);

          if (joinedGroupsError) {
            logger.error('Failed to fetch joined groups', {
              joinedGroupsError,
              userId: keyInfo.userId,
              joinedGroupIdsToFetch,
            });
          } else {
            joinedGroups = (joinedGroupsData ?? []) as Array<{
              id: string;
              name: string;
              description: string | null;
              is_private: boolean;
              image_url: string | null;
              external_link: string | null;
              created_at: string;
            }>;
          }
        }

        // Step 5: Combine and deduplicate (created groups take precedence)
        const allGroups = [
          ...(createdGroups ?? []).map((g) => ({
            ...g,
            role: 'admin' as string, // Creator is admin
            image_url: (g as any).image_url || null,
            external_link: (g as any).external_link || null,
          })),
          ...joinedGroups.map((g) => {
            const membership = profileMemberships.find((m) => m.group_id === g.id);
            return {
              ...g,
              role: membership?.role || 'member',
            };
          }),
        ];

        // Step 6: Get member counts from profile_memberships
        const groups: GroupSummary[] = [];

        for (const group of allGroups) {
          // Count members from profile_memberships
          const { count: memberCount } = await supabase
            .from('profile_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)
            .eq('is_active', true);

          groups.push({
            groupId: group.id,
            groupName: group.name,
            memberCount: memberCount || 0,
            isActive: !group.is_private, // Map is_private to isActive (private=false means active/visible)
            role: group.role,
            description: group.description,
            image_url: (group as any).image_url || null, // OCR-82: Optional group image
            external_link: (group as any).external_link || null, // OCR-82: Optional external link
          });
        }

        const response: ApiResponse<GroupSummary[]> = {
          ok: true,
          success: true,
          data: groups,
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to fetch groups', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'GROUPS_ERROR', 'Failed to fetch groups');
      }
    })
  );

  // Get group members
  router.get(
    '/groups/:groupId/members',
    validateApiKey,
    withAuthContext(async (req, res, keyInfo) => {
      try {
        const { groupId } = validateRequestData(GroupIdParamSchema, req.params);

        // Step 1: Check if user created the group
        const { data: group, error: groupError } = await supabase
          .from('groups')
          .select('id, created_by')
          .eq('id', groupId)
          .single();

        if (groupError || !group) {
          respondWithError(res, 404, 'NOT_FOUND', 'Group not found');
          return;
        }

        const isCreator = group.created_by === keyInfo.userId;

        // Step 2: Check if user's profiles are members
        let hasProfileMembership = false;
        if (!isCreator) {
          // Get user's profiles
          const { data: userProfiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id')
            .eq('account_id', keyInfo.userId)
            .eq('is_active', true);

          if (profilesError) {
            logger.error('Failed to fetch user profiles for access check', {
              profilesError,
              userId: keyInfo.userId,
            });
          }

          const profileIds = (userProfiles ?? []).map((p) => p.id);

          if (profileIds.length > 0) {
            const { data: membership, error: membershipError } = await supabase
              .from('profile_memberships')
              .select('id')
              .eq('group_id', groupId)
              .in('profile_id', profileIds)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle();

            if (membershipError) {
              logger.error('Failed to check profile membership', {
                membershipError,
                userId: keyInfo.userId,
                groupId,
              });
            } else {
              hasProfileMembership = !!membership;
            }
          }
        }

        // Step 3: Deny access if neither creator nor member
        if (!isCreator && !hasProfileMembership) {
          respondWithError(res, 403, 'FORBIDDEN', 'Access denied to this group');
          return;
        }

        // Step 4: Get members from profile_memberships joined with profiles
        const { data: members, error: membersError } = await supabase
          .from('profile_memberships')
          .select(
            `
            id,
            role,
            joined_at,
            profiles!inner (
              id,
              display_name,
              username,
              avatar_url
            )
          `
          )
          .eq('group_id', groupId)
          .eq('is_active', true)
          .order('joined_at', { ascending: true });

        if (membersError) {
          logger.error('Failed to fetch group members', { membersError, groupId });
          respondWithError(res, 500, 'GROUP_MEMBERS_ERROR', 'Failed to fetch group members');
          return;
        }

        type GroupMemberRow = {
          id: string;
          role: string;
          joined_at: string;
          profiles: {
            id: string;
            display_name: string | null;
            username: string;
            avatar_url: string | null;
          };
        };

        const formattedMembers: TeamMember[] = ((members ?? []) as unknown as GroupMemberRow[]).map(
          (member) => ({
            memberId: member.profiles.id,
            displayName: member.profiles.display_name || member.profiles.username,
            role: member.role,
            joinedAt: member.joined_at,
            avatar: member.profiles.avatar_url,
          })
        );

        const response: ApiResponse<TeamMember[]> = {
          ok: true,
          success: true,
          data: formattedMembers,
        };

        res.json(response);
      } catch (error) {
        if (error instanceof ValidationError) {
          respondWithError(res, 400, 'VALIDATION_ERROR', error.message, error.details as unknown[]);
          return;
        }
        logger.error('Failed to fetch group members', {
          error,
          groupId: req.params.groupId,
          userId: keyInfo.userId,
        });
        respondWithError(res, 500, 'GROUP_MEMBERS_ERROR', 'Failed to fetch group members');
      }
    })
  );

  // Entries endpoints
  router.get('/entries', validateApiKey, async (req, res) => {
    try {
      // Extract authenticated user context
      const authReq = req as ExpressAuthenticatedRequest;
      if (!authReq.authContext) {
        respondWithError(res, 401, 'AUTH_REQUIRED', 'Authentication required');
        return;
      }

      const limit = toNumber(req.query.limit, 20);
      const offset = toNumber(req.query.offset, 0);

      // Get user's profile_id from their account
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authReq.authContext.userId)
        .single();

      if (profileError || !userProfile) {
        respondWithError(res, 404, 'PROFILE_NOT_FOUND', 'User profile not found');
        return;
      }

      // Query entries for authenticated user's profile only
      // RLS policies will automatically filter to only this user's entries
      let query = supabase
        .from('entries')
        .select('id, title, content, profile_id, created_at, updated_at, audience_type')
        .eq('profile_id', userProfile.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: entries, error } = await query;

      if (error) {
        logger.error('Failed to fetch entries', {
          error,
          offset,
          limit,
          userId: authReq.authContext.userId,
        });
        res.json({
          ok: true,
          success: true,
          data: [],
          meta: {
            pagination: {
              page: Math.floor(offset / limit) + 1,
              limit,
              total: 0,
              totalPages: 0,
            },
          },
          message: 'Using empty dataset due to query error',
        });
        return;
      }

      type EntryRow = {
        id: string;
        title: string;
        content: string;
        profile_id: string;
        created_at: string;
        updated_at: string;
        audience_type: string;
      };

      const entryRows = (entries ?? []) as EntryRow[];
      const items: Entry[] = entryRows.map((entry) => ({
        id: entry.id,
        title: entry.title,
        content: entry.content,
        profile_id: entry.profile_id,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
        audience_type: normalizeAudienceType(entry.audience_type),
      }));

      const total = items.length;
      const pagination = {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: limit === 0 ? 0 : Math.ceil(total / limit),
      };

      const response: PaginatedResponse<Entry> = {
        ok: true,
        success: true,
        data: items,
        meta: { pagination },
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to fetch entries', { error });
      respondWithError(res, 500, 'ENTRIES_ERROR', 'Failed to fetch entries');
    }
  });

  // Templates endpoints
  router.get('/templates', validateApiKey, (req, res) => {
    res.json({
      ok: true,
      success: true,
      data: [],
      meta: {
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      },
    });
  });

  // Storage endpoints
  router.get('/storage', validateApiKey, (req, res) => {
    res.json({
      ok: true,
      success: true,
      data: {},
    });
  });

  // UI endpoints
  router.post('/ui/notifications', validateApiKey, (req, res) => {
    res.json({
      ok: true,
      success: true,
      data: {
        id: 'notification_123',
      },
    });
  });

  return router;
}
