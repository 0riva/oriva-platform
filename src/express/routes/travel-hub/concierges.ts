/**
 * Concierge Routes
 * GET /api/v1/travel-hub/concierges - List/discover concierges
 * GET /api/v1/travel-hub/concierges/featured - Get featured concierges
 * GET /api/v1/travel-hub/concierges/me - Get current user's concierge profile
 * GET /api/v1/travel-hub/concierges/:id - Get concierge by ID
 * POST /api/v1/travel-hub/concierges - Create concierge profile
 * PATCH /api/v1/travel-hub/concierges/:id - Update concierge profile
 * PATCH /api/v1/travel-hub/concierges/:id/availability - Update availability status
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { getSupabase } from '../../middleware/schemaRouter';
import { logger } from '../../../utils/logger';

const router = Router();

const SCHEMA = 'travel_hub';

// Validation middleware helper
const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, errors: errors.array() });
  }
  next();
};

/**
 * GET /api/v1/travel-hub/concierges
 * List/discover concierges with optional filters
 */
router.get(
  '/',
  [
    query('specialties').optional().isString(),
    query('languages').optional().isString(),
    query('minRating').optional().isFloat({ min: 0, max: 5 }),
    query('maxHourlyRate').optional().isInt({ min: 0 }),
    query('availability').optional().isIn(['available', 'busy', 'offline']),
    query('verified').optional().isBoolean(),
    query('featured').optional().isBoolean(),
    query('search').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const {
        specialties,
        languages,
        minRating,
        maxHourlyRate,
        availability,
        verified,
        featured,
        search,
        limit = 20,
        offset = 0,
      } = req.query;

      let query = supabase
        .schema(SCHEMA)
        .from('concierges')
        .select('*', { count: 'exact' })
        .order('featured', { ascending: false })
        .order('rating', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      // Apply filters
      if (specialties) {
        const specialtiesArray = (specialties as string).split(',');
        query = query.overlaps('specialties', specialtiesArray);
      }

      if (languages) {
        const languagesArray = (languages as string).split(',');
        query = query.overlaps('languages', languagesArray);
      }

      if (minRating) {
        query = query.gte('rating', Number(minRating));
      }

      if (maxHourlyRate) {
        query = query.lte('hourly_rate_cents', Number(maxHourlyRate));
      }

      if (availability) {
        query = query.eq('availability_status', availability);
      }

      if (verified !== undefined) {
        query = query.eq('verified', verified === 'true');
      }

      if (featured !== undefined) {
        query = query.eq('featured', featured === 'true');
      }

      if (search) {
        query = query.or(`display_name.ilike.%${search}%,bio.ilike.%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('[ConciergesRoute] Error fetching concierges', { error });
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
      logger.error('[ConciergesRoute] Unexpected error', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/concierges/featured
 * Get featured concierges for discovery
 */
router.get(
  '/featured',
  [query('limit').optional().isInt({ min: 1, max: 20 })],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const limit = Number(req.query.limit) || 10;

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('concierges')
        .select('*')
        .eq('featured', true)
        .eq('availability_status', 'available')
        .order('rating', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('[ConciergesRoute] Error fetching featured', { error });
        return res.status(500).json({ ok: false, error: error.message });
      }

      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ConciergesRoute] Unexpected error in featured', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/concierges/me
 * Get current user's concierge profile
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('concierges')
      .select('*')
      .eq('account_id', userId)
      .maybeSingle();

    if (error) {
      logger.error('[ConciergesRoute] Error fetching my profile', { error });
      return res.status(500).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, data });
  } catch (error: any) {
    logger.error('[ConciergesRoute] Unexpected error in me', { error });
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/travel-hub/concierges/:id
 * Get concierge by ID
 */
router.get('/:id', [param('id').isUUID()], validate, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { id } = req.params;

    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('concierges')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ ok: false, error: 'Concierge not found' });
      }
      logger.error('[ConciergesRoute] Error fetching concierge', { error, id });
      return res.status(500).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, data });
  } catch (error: any) {
    logger.error('[ConciergesRoute] Unexpected error in getById', { error });
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/travel-hub/concierges
 * Create concierge profile
 */
router.post(
  '/',
  [
    body('profile_id').isUUID(),
    body('display_name').isString().notEmpty().isLength({ max: 100 }),
    body('bio').optional().isString().isLength({ max: 2000 }),
    body('avatar_url').optional().isURL(),
    body('specialties').optional().isArray(),
    body('languages').optional().isArray(),
    body('hourly_rate_cents').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const {
        profile_id,
        display_name,
        bio,
        avatar_url,
        specialties,
        languages,
        hourly_rate_cents,
      } = req.body;

      const conciergeData = {
        account_id: userId,
        profile_id,
        display_name,
        bio,
        avatar_url,
        specialties: specialties || [],
        languages: languages || ['en'],
        hourly_rate_cents,
        currency: 'USD',
        availability_status: 'offline',
        rating: 0,
        review_count: 0,
        total_bookings: 0,
        verified: false,
        featured: false,
        metadata: {},
      };

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('concierges')
        .insert([conciergeData])
        .select()
        .single();

      if (error) {
        logger.error('[ConciergesRoute] Error creating concierge', { error });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ConciergesRoute] Concierge created', { conciergeId: data.id });
      res.status(201).json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ConciergesRoute] Unexpected error in create', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/v1/travel-hub/concierges/:id
 * Update concierge profile
 */
router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('display_name').optional().isString().isLength({ max: 100 }),
    body('bio').optional().isString().isLength({ max: 2000 }),
    body('avatar_url').optional().isURL(),
    body('specialties').optional().isArray(),
    body('languages').optional().isArray(),
    body('hourly_rate_cents').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id } = req.params;

      // Remove undefined fields
      const updates = Object.fromEntries(
        Object.entries(req.body).filter(([_, v]) => v !== undefined)
      );

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('concierges')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Concierge not found' });
        }
        logger.error('[ConciergesRoute] Error updating concierge', { error, id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ConciergesRoute] Concierge updated', { conciergeId: id });
      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ConciergesRoute] Unexpected error in update', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/v1/travel-hub/concierges/:id/availability
 * Update availability status
 */
router.patch(
  '/:id/availability',
  [param('id').isUUID(), body('status').isIn(['available', 'busy', 'offline'])],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id } = req.params;
      const { status } = req.body;

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('concierges')
        .update({ availability_status: status })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Concierge not found' });
        }
        logger.error('[ConciergesRoute] Error updating availability', { error, id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ConciergesRoute] Availability updated', { conciergeId: id, status });
      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ConciergesRoute] Unexpected error in availability', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

export default router;
