/**
 * Hugo Love Profiles Routes
 * GET /api/v1/hugo-love/profiles/me - Get current user's dating profile
 * PATCH /api/v1/hugo-love/profiles/me - Update current user's dating profile
 * GET /api/v1/hugo-love/profiles/:userId - Get public profile
 * POST /api/v1/hugo-love/profiles/blocks - Block a user
 * GET /api/v1/hugo-love/profiles/blocks - Get blocked users
 *
 * Uses hugo_love.dating_profiles table for Hugo Love specific data
 * Accesses schema via exec_sql RPC to bypass PostgREST schema restrictions
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getSupabaseServiceClient } from '../../../config/supabase';
import { validateBlockUserRequest } from './validation';
import { ValidationError, isValidUuid } from '../../utils/validation-express';
import {
  validateAndEscapeUuid,
  sqlQuote,
  sqlQuoteJsonb,
  sqlQuoteTextArray,
} from './utils/sql-sanitize';

const router = Router();
router.use(requireAuth);

/**
 * Execute SQL via RPC to access hugo_love schema (for INSERT/UPDATE/DELETE)
 * PostgREST doesn't expose hugo_love schema, so we use exec_sql RPC
 * Returns: string "SQL executed successfully" for non-SELECT queries
 */
async function execHugoLoveSql(sql: string): Promise<string> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('Hugo Love SQL error:', error);
    throw error;
  }

  // exec_sql returns errors as strings like "Error: <message>"
  // Check for this and throw as a proper error
  const result = data as string;
  if (result && result.startsWith('Error:')) {
    console.error('Hugo Love SQL execution error:', result);
    throw new Error(result);
  }

  return result;
}

/**
 * Query hugo_love schema and return results (for SELECT queries)
 * Uses exec_sql_query RPC which returns JSONB array of results
 * Note: exec_sql_query is a custom RPC not in generated types, hence the cast
 */
async function queryHugoLoveSql(sql: string): Promise<any[]> {
  const supabase = getSupabaseServiceClient();
  // Cast to any to bypass TypeScript checking - exec_sql_query is a custom RPC
  // that returns JSONB array of results (not in generated Supabase types)
  const { data, error } = await (supabase.rpc as any)('exec_sql_query', { sql_query: sql });

  if (error) {
    console.error('Hugo Love query error:', error);
    throw error;
  }

  // exec_sql_query returns JSONB array
  return (data as any[]) || [];
}

/**
 * GET /api/v1/hugo-love/profiles/me
 * Uses hugo_love.dating_profiles table via exec_sql_query RPC
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use Oriva profile ID from X-Profile-ID header for dating_profiles
    // Each Oriva profile has its own dating profile (DID = profile identity)
    const rawProfileId = req.profileId || req.user!.id;
    // SECURITY: Validate UUID format before SQL interpolation (defense-in-depth)
    const profileId = validateAndEscapeUuid(rawProfileId, 'profileId');

    // Query the hugo_love.dating_profiles table via SQL
    const sql = `
      SELECT * FROM hugo_love.dating_profiles
      WHERE user_id = '${profileId}'
      LIMIT 1
    `;

    const result = await queryHugoLoveSql(sql);

    // Handle case where no profile exists - auto-create one
    // This ensures every Oriva profile that opens Hugo Love gets a dating profile
    if (!result || result.length === 0) {
      console.log('📝 No Hugo Love profile found, auto-creating for:', profileId);
      const insertSql = `
        INSERT INTO hugo_love.dating_profiles (user_id, display_name, created_at, updated_at)
        VALUES ('${profileId}', 'New User', NOW(), NOW())
        RETURNING *
      `;
      // Use exec_sql for insert, then query to get the created row
      await execHugoLoveSql(insertSql.replace(' RETURNING *', ''));
      const newResult = await queryHugoLoveSql(
        `SELECT * FROM hugo_love.dating_profiles WHERE user_id = '${profileId}' LIMIT 1`
      );
      if (newResult && newResult.length > 0) {
        const profile = newResult[0];
        res.json({
          success: true,
          data: {
            id: profile.id,
            user_id: profile.user_id,
            display_name: profile.display_name,
            bio: profile.bio,
            profile_photos: profile.profile_photos || [],
            created_at: profile.created_at,
            updated_at: profile.updated_at,
          },
          message: 'Profile auto-created',
        });
        return;
      }
      // Fallback if insert somehow failed silently
      res.json({ success: true, data: null, message: 'No profile found' });
      return;
    }

    const profile = result[0];

    // Return full dating profile wrapped in standard response format
    res.json({
      success: true,
      data: {
        id: profile.id,
        user_id: profile.user_id,
        display_name: profile.display_name,
        bio: profile.bio,
        birth_month: profile.birth_month,
        birth_year: profile.birth_year,
        age: profile.age,
        age_range_min: profile.age_range_min,
        age_range_max: profile.age_range_max,
        distance_max_km: profile.distance_max_km,
        location: profile.location,
        interests: profile.interests || [],
        looks: profile.looks || [],
        personality: profile.personality || [],
        lifestyle: profile.lifestyle || [],
        profile_photos: profile.profile_photos || [],
        profile_videos: profile.profile_videos || [],
        whatsapp_number: profile.whatsapp_number,
        instagram_url: profile.instagram_url,
        linkedin_url: profile.linkedin_url,
        twitter_url: profile.twitter_url,
        // Match preferences - user's attributes
        gender: profile.gender,
        height_cm: profile.height_cm,
        ethnicity: profile.ethnicity,
        // Match preferences - seeking preferences
        seeking_genders: profile.seeking_genders || [],
        seeking_height_min: profile.seeking_height_min,
        seeking_height_max: profile.seeking_height_max,
        seeking_ethnicities: profile.seeking_ethnicities || [],
        seeking_interests: profile.seeking_interests || [],
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Hugo Love profile endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

/**
 * PATCH /api/v1/hugo-love/profiles/me
 * Uses hugo_love.dating_profiles table - stores ALL dating-specific fields
 */
router.patch('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use Oriva profile ID from X-Profile-ID header for dating_profiles
    // Each Oriva profile has its own dating profile (DID = profile identity)
    const rawProfileId = req.profileId || req.user!.id;
    // SECURITY: Validate UUID format before SQL interpolation (defense-in-depth)
    const profileId = validateAndEscapeUuid(rawProfileId, 'profileId');
    const body = req.body;

    // DEBUG: Log incoming profile_photos
    console.log('[PATCH /me] DEBUG profile_photos:', {
      profileId,
      reqUserId: req.user!.id, // For debugging - shows the Supabase auth user ID
      hasProfilePhotos: body.profile_photos !== undefined,
      profilePhotosType: typeof body.profile_photos,
      profilePhotosIsArray: Array.isArray(body.profile_photos),
      profilePhotosLength: Array.isArray(body.profile_photos) ? body.profile_photos.length : 'N/A',
      profilePhotos: body.profile_photos,
    });

    // Check if profile exists
    const checkSql = `
      SELECT id FROM hugo_love.dating_profiles
      WHERE user_id = '${profileId}'
      LIMIT 1
    `;

    const existingResult = await queryHugoLoveSql(checkSql);
    const existingProfile = existingResult.length > 0 ? existingResult[0] : null;

    // Build SET clause for updates
    // SECURITY: Using imported sql-sanitize utilities for robust escaping
    const updates: string[] = [];
    const updatedFields: string[] = [];

    // Basic info
    if (body.display_name !== undefined) {
      updates.push(`display_name = ${sqlQuote(body.display_name)}`);
      updatedFields.push('display_name');
    }
    if (body.bio !== undefined) {
      updates.push(`bio = ${sqlQuote(body.bio)}`);
      updatedFields.push('bio');
    }

    // Age/Birth info
    if (body.birth_month !== undefined) {
      updates.push(`birth_month = ${sqlQuote(body.birth_month)}`);
      updatedFields.push('birth_month');
    }
    if (body.birth_year !== undefined) {
      updates.push(`birth_year = ${sqlQuote(body.birth_year)}`);
      updatedFields.push('birth_year');
    }
    if (body.age !== undefined) {
      updates.push(`age = ${sqlQuote(body.age)}`);
      updatedFields.push('age');
    }

    // Preferences
    if (body.age_range_min !== undefined) {
      updates.push(`age_range_min = ${sqlQuote(body.age_range_min)}`);
      updatedFields.push('age_range_min');
    }
    if (body.age_range_max !== undefined) {
      updates.push(`age_range_max = ${sqlQuote(body.age_range_max)}`);
      updatedFields.push('age_range_max');
    }
    if (body.distance_max_km !== undefined) {
      updates.push(`distance_max_km = ${sqlQuote(body.distance_max_km)}`);
      updatedFields.push('distance_max_km');
    }

    // Location (stored as JSONB)
    if (body.location !== undefined) {
      updates.push(`location = ${sqlQuoteJsonb(body.location)}`);
      updatedFields.push('location');
    }

    // Arrays
    if (body.interests !== undefined) {
      updates.push(`interests = ${sqlQuoteTextArray(body.interests)}`);
      updatedFields.push('interests');
    }
    if (body.looks !== undefined) {
      updates.push(`looks = ${sqlQuoteTextArray(body.looks)}`);
      updatedFields.push('looks');
    }
    if (body.personality !== undefined) {
      updates.push(`personality = ${sqlQuoteTextArray(body.personality)}`);
      updatedFields.push('personality');
    }
    if (body.lifestyle !== undefined) {
      updates.push(`lifestyle = ${sqlQuoteTextArray(body.lifestyle)}`);
      updatedFields.push('lifestyle');
    }
    if (body.profile_photos !== undefined) {
      updates.push(`profile_photos = ${sqlQuoteTextArray(body.profile_photos)}`);
      updatedFields.push('profile_photos');
    }
    if (body.profile_videos !== undefined) {
      updates.push(`profile_videos = ${sqlQuoteTextArray(body.profile_videos)}`);
      updatedFields.push('profile_videos');
    }

    // Social links
    if (body.whatsapp_number !== undefined) {
      updates.push(`whatsapp_number = ${sqlQuote(body.whatsapp_number)}`);
      updatedFields.push('whatsapp_number');
    }
    if (body.instagram_url !== undefined) {
      updates.push(`instagram_url = ${sqlQuote(body.instagram_url)}`);
      updatedFields.push('instagram_url');
    }
    if (body.linkedin_url !== undefined) {
      updates.push(`linkedin_url = ${sqlQuote(body.linkedin_url)}`);
      updatedFields.push('linkedin_url');
    }
    if (body.twitter_url !== undefined) {
      updates.push(`twitter_url = ${sqlQuote(body.twitter_url)}`);
      updatedFields.push('twitter_url');
    }

    // Match preferences - user's attributes
    if (body.gender !== undefined) {
      updates.push(`gender = ${sqlQuote(body.gender)}`);
      updatedFields.push('gender');
    }
    if (body.height_cm !== undefined) {
      updates.push(`height_cm = ${sqlQuote(body.height_cm)}`);
      updatedFields.push('height_cm');
    }
    if (body.ethnicity !== undefined) {
      updates.push(`ethnicity = ${sqlQuote(body.ethnicity)}`);
      updatedFields.push('ethnicity');
    }

    // Match preferences - seeking preferences
    if (body.seeking_genders !== undefined) {
      updates.push(`seeking_genders = ${sqlQuoteTextArray(body.seeking_genders)}`);
      updatedFields.push('seeking_genders');
    }
    if (body.seeking_height_min !== undefined) {
      updates.push(`seeking_height_min = ${sqlQuote(body.seeking_height_min)}`);
      updatedFields.push('seeking_height_min');
    }
    if (body.seeking_height_max !== undefined) {
      updates.push(`seeking_height_max = ${sqlQuote(body.seeking_height_max)}`);
      updatedFields.push('seeking_height_max');
    }
    if (body.seeking_ethnicities !== undefined) {
      updates.push(`seeking_ethnicities = ${sqlQuoteTextArray(body.seeking_ethnicities)}`);
      updatedFields.push('seeking_ethnicities');
    }
    if (body.seeking_interests !== undefined) {
      updates.push(`seeking_interests = ${sqlQuoteTextArray(body.seeking_interests)}`);
      updatedFields.push('seeking_interests');
    }

    // Always update timestamp
    updates.push(`updated_at = NOW()`);

    let sql: string;

    if (existingProfile) {
      // Update existing profile (no RETURNING - exec_sql doesn't return results)
      sql = `
        UPDATE hugo_love.dating_profiles
        SET ${updates.join(', ')}
        WHERE user_id = '${profileId}'
      `;
    } else {
      // Insert new profile
      sql = `
        INSERT INTO hugo_love.dating_profiles (
          user_id, display_name, bio, birth_month, birth_year, age,
          age_range_min, age_range_max, distance_max_km, location,
          interests, looks, personality, lifestyle,
          profile_photos, profile_videos,
          whatsapp_number, instagram_url, linkedin_url, twitter_url,
          gender, height_cm, ethnicity,
          seeking_genders, seeking_height_min, seeking_height_max,
          seeking_ethnicities, seeking_interests,
          updated_at
        ) VALUES (
          '${profileId}',
          ${sqlQuote(body.display_name || 'User')},
          ${sqlQuote(body.bio || null)},
          ${sqlQuote(body.birth_month || null)},
          ${sqlQuote(body.birth_year || null)},
          ${sqlQuote(body.age || null)},
          ${sqlQuote(body.age_range_min || 18)},
          ${sqlQuote(body.age_range_max || 99)},
          ${sqlQuote(body.distance_max_km || 50)},
          ${sqlQuoteJsonb(body.location || null)},
          ${sqlQuoteTextArray(body.interests || [])},
          ${sqlQuoteTextArray(body.looks || [])},
          ${sqlQuoteTextArray(body.personality || [])},
          ${sqlQuoteTextArray(body.lifestyle || [])},
          ${sqlQuoteTextArray(body.profile_photos || [])},
          ${sqlQuoteTextArray(body.profile_videos || [])},
          ${sqlQuote(body.whatsapp_number || null)},
          ${sqlQuote(body.instagram_url || null)},
          ${sqlQuote(body.linkedin_url || null)},
          ${sqlQuote(body.twitter_url || null)},
          ${sqlQuote(body.gender || null)},
          ${sqlQuote(body.height_cm || null)},
          ${sqlQuote(body.ethnicity || null)},
          ${sqlQuoteTextArray(body.seeking_genders || [])},
          ${sqlQuote(body.seeking_height_min || 150)},
          ${sqlQuote(body.seeking_height_max || 200)},
          ${sqlQuoteTextArray(body.seeking_ethnicities || [])},
          ${sqlQuoteTextArray(body.seeking_interests || [])},
          NOW()
        )
      `;
    }

    // DEBUG: Log the SQL being executed
    console.log('[PATCH /me] DEBUG sql execution:', {
      profileId,
      updatedFields,
      sqlLength: sql.length,
      includesProfilePhotos: sql.includes('profile_photos'),
      sqlSnippet: sql.substring(0, 500),
    });

    // Execute the UPDATE/INSERT (exec_sql doesn't return results)
    await execHugoLoveSql(sql);

    // Fetch the updated profile to get id and updated_at
    const fetchSql = `
      SELECT id, user_id, updated_at FROM hugo_love.dating_profiles
      WHERE user_id = '${profileId}'
      LIMIT 1
    `;
    const result = await queryHugoLoveSql(fetchSql);
    const updated = result.length > 0 ? result[0] : { user_id: profileId };

    res.json({
      userId: updated.user_id || profileId,
      profileId: updated.id,
      updatedFields,
      updatedAt: updated.updated_at || new Date().toISOString(),
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      console.error('Hugo Love profile update endpoint error:', error);
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

/**
 * GET /api/v1/hugo-love/profiles/discover
 * Get discoverable profiles for the Glance/FotoFlash swipe interface
 * Returns only profiles from hugo_love.dating_profiles (registered Love Puzl members)
 * Excludes: current user and blocked users only
 * NOTE: Swiped profiles remain visible until user interacts with them on Rate screen
 */
router.get('/discover', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use profileId from X-Profile-ID header if provided, else fall back to user ID
    const rawProfileId = req.profileId || req.user!.id;
    // SECURITY: Validate UUID format before SQL interpolation (defense-in-depth)
    const profileId = validateAndEscapeUuid(rawProfileId, 'profileId');
    // SECURITY: Validate pagination params - prevent negative number bypass
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    // Get IDs of users to exclude (blocked users only)
    // NOTE: Swiped profiles are NOT excluded - they remain on Glance until
    // the user interacts with them on the Rate screen
    const excludeSql = `
      SELECT blocked_id as user_id FROM hugo_love.blocks WHERE blocker_id = '${profileId}'
    `;
    const excludeResult = await queryHugoLoveSql(excludeSql);
    // SECURITY: Validate all excluded IDs are valid UUIDs before SQL interpolation
    const excludeIds = excludeResult
      .map((r: any) => r.user_id)
      .filter((id: string) => isValidUuid(id));

    // Always exclude current user/profile
    excludeIds.push(profileId);

    // Build exclude clause - IDs are validated UUIDs
    const excludeClause =
      excludeIds.length > 0
        ? `AND user_id NOT IN (${excludeIds.map((id: string) => `'${id}'`).join(', ')})`
        : '';

    // Query discoverable profiles from hugo_love.dating_profiles
    const sql = `
      SELECT
        id,
        user_id,
        display_name,
        bio,
        age,
        birth_month,
        birth_year,
        location,
        profile_photos,
        interests,
        personality,
        lifestyle,
        looks,
        gender
      FROM hugo_love.dating_profiles
      WHERE user_id IS NOT NULL
      ${excludeClause}
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const profiles = await queryHugoLoveSql(sql);

    // Map to discover profile format expected by client
    const discoverProfiles = profiles.map((profile: any) => ({
      profileId: profile.user_id,
      id: profile.id,
      profileName: profile.display_name || 'Anonymous',
      display_name: profile.display_name,
      bio: profile.bio || '',
      age: profile.age,
      age_range_min: profile.birth_year
        ? new Date().getFullYear() - profile.birth_year
        : profile.age,
      age_range_max: profile.age,
      location: profile.location,
      avatar: profile.profile_photos?.[0] || '',
      profile_image_url: profile.profile_photos?.[0] || '',
      profile_photos: profile.profile_photos || [],
      interests: profile.interests || [],
      personality: profile.personality || [],
      lifestyle: profile.lifestyle || [],
      looks: profile.looks || [],
      gender: profile.gender,
    }));

    res.json({
      success: true,
      data: discoverProfiles,
      pagination: {
        limit,
        offset,
        count: discoverProfiles.length,
      },
    });
  } catch (error: any) {
    console.error('Hugo Love discover profiles endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
});

/**
 * GET /api/v1/hugo-love/profiles/:userId
 * Get public view of another user's dating profile
 */
router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId: rawUserId } = req.params;

    // SECURITY: Validate UUID format and escape before SQL interpolation
    // This is a URL parameter - MUST be validated to prevent SQL injection
    let userId: string;
    try {
      userId = validateAndEscapeUuid(rawUserId, 'userId');
    } catch {
      res.status(400).json({ error: 'Invalid user ID format', code: 'INVALID_USER_ID' });
      return;
    }

    const sql = `
      SELECT user_id, display_name, age, bio, profile_photos, interests, location
      FROM hugo_love.dating_profiles
      WHERE user_id = '${userId}'
      LIMIT 1
    `;

    const result = await queryHugoLoveSql(sql);

    if (!result || result.length === 0) {
      res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' });
      return;
    }

    const profile = result[0];

    // Return public view (limited fields for privacy)
    res.json({
      userId: profile.user_id,
      displayName: profile.display_name,
      age: profile.age,
      bio: profile.bio,
      photos: profile.profile_photos || [],
      interests: profile.interests || [],
      location: profile.location,
    });
  } catch (error: any) {
    console.error('Hugo Love public profile endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

/**
 * POST /api/v1/hugo-love/profiles/blocks
 * Uses hugo_love.blocks table via exec_sql RPC
 */
router.post('/blocks', async (req: Request, res: Response): Promise<void> => {
  try {
    // Use profileId from X-Profile-ID header if provided, else fall back to user ID
    const rawBlockerId = req.profileId || req.user!.id;
    // SECURITY: Validate UUID format before SQL interpolation (defense-in-depth)
    const blockerId = validateAndEscapeUuid(rawBlockerId, 'blockerId');

    const validated = validateBlockUserRequest(req.body);
    // SECURITY: Validate blockedUserId from request body
    const blockedUserId = validateAndEscapeUuid(validated.blockedUserId, 'blockedUserId');

    if (blockerId === blockedUserId) {
      throw new ValidationError('Cannot block yourself', { field: 'blockedUserId' });
    }

    // Check if already blocked
    const checkSql = `
      SELECT id, created_at FROM hugo_love.blocks
      WHERE blocker_id = '${blockerId}' AND blocked_id = '${blockedUserId}'
      LIMIT 1
    `;
    const existingBlock = await queryHugoLoveSql(checkSql);

    if (existingBlock && existingBlock.length > 0) {
      // Already blocked
      res.status(200).json({
        message: 'User already blocked',
        blockedUserId: validated.blockedUserId,
        blockedAt: existingBlock[0].created_at,
      });
      return;
    }

    // Insert into hugo_love.blocks via SQL (no RETURNING - exec_sql doesn't return results)
    const insertSql = `
      INSERT INTO hugo_love.blocks (blocker_id, blocked_id, created_at)
      VALUES ('${blockerId}', '${blockedUserId}', NOW())
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    `;
    await execHugoLoveSql(insertSql);

    // Fetch the inserted block
    const fetchSql = `
      SELECT id, blocker_id, blocked_id, created_at FROM hugo_love.blocks
      WHERE blocker_id = '${blockerId}' AND blocked_id = '${blockedUserId}'
      LIMIT 1
    `;
    const result = await queryHugoLoveSql(fetchSql);

    if (!result || result.length === 0) {
      // Something went wrong but we'll return success anyway
      res.status(201).json({
        blockedUserId: validated.blockedUserId,
        blockedAt: new Date().toISOString(),
      });
      return;
    }

    const block = result[0];
    res.status(201).json({
      blockId: block.id,
      blockedUserId: validated.blockedUserId,
      blockedAt: block.created_at,
    });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, code: 'INVALID_INPUT', details: error.details });
    } else {
      console.error('Block endpoint error:', error);
      res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
    }
  }
});

/**
 * GET /api/v1/hugo-love/profiles/blocks
 * Uses hugo_love.blocks table via exec_sql_query RPC
 */
router.get('/blocks', async (req: Request, res: Response): Promise<void> => {
  try {
    // SECURITY: Validate and escape profileId to prevent SQL injection
    const rawBlockerId = req.profileId || req.user!.id;
    const blockerId = validateAndEscapeUuid(rawBlockerId, 'blockerId');

    const sql = `
      SELECT id, blocker_id, blocked_id, created_at
      FROM hugo_love.blocks
      WHERE blocker_id = '${blockerId}'
      ORDER BY created_at DESC
    `;

    const result = await queryHugoLoveSql(sql);

    // Handle case where no blocks
    res.json({ blocks: result || [] });
  } catch (error: any) {
    console.error('Blocks endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', code: 'SERVER_ERROR' });
  }
});

export default router;
