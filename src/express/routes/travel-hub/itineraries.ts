/**
 * Itinerary Routes
 * GET /api/v1/travel-hub/itineraries - List itineraries
 * GET /api/v1/travel-hub/itineraries/:id - Get itinerary with items
 * POST /api/v1/travel-hub/itineraries - Create itinerary
 * PATCH /api/v1/travel-hub/itineraries/:id - Update itinerary
 * PATCH /api/v1/travel-hub/itineraries/:id/status - Update status
 * POST /api/v1/travel-hub/itineraries/:id/items - Add item to itinerary
 * PATCH /api/v1/travel-hub/itineraries/:id/items/:itemId - Update item
 * DELETE /api/v1/travel-hub/itineraries/:id/items/:itemId - Delete item
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
 * GET /api/v1/travel-hub/itineraries/me
 * Get itineraries for the currently logged-in concierge
 */
router.get(
  '/me',
  [
    query('status').optional().isIn(['draft', 'planning', 'confirmed', 'in_progress', 'completed']),
    query('destination').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      // Get the concierge record for the current user (using account_id which is the auth user ID)
      const { data: concierge, error: conciergeError } = await supabase
        .schema(SCHEMA)
        .from('concierges')
        .select('id')
        .eq('account_id', userId)
        .single();

      if (conciergeError || !concierge) {
        // User is not a concierge - return empty array
        logger.debug('[ItinerariesRoute] User is not a concierge, returning empty itineraries', {
          userId,
        });
        return res.json({ ok: true, data: [] });
      }

      const { status, destination, limit = 50, offset = 0 } = req.query;

      let query = supabase
        .schema(SCHEMA)
        .from('travel_itineraries')
        .select('*', { count: 'exact' })
        .eq('concierge_id', concierge.id)
        .order('start_date', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (destination) {
        query = query.or(
          `destination_country.ilike.%${destination}%,destination_city.ilike.%${destination}%`
        );
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('[ItinerariesRoute] Error fetching my itineraries', { error, userId });
        return res.status(500).json({ ok: false, error: error.message });
      }

      res.json({
        ok: true,
        data: data || [],
        pagination: {
          total: count || 0,
          limit: Number(limit),
          offset: Number(offset),
        },
      });
    } catch (error: any) {
      logger.error('[ItinerariesRoute] Unexpected error in getMyItineraries', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/itineraries
 * List itineraries with optional filters
 */
router.get(
  '/',
  [
    query('profile_id').optional().isUUID(),
    query('concierge_id').optional().isUUID(),
    query('status').optional().isIn(['draft', 'planning', 'confirmed', 'in_progress', 'completed']),
    query('destination').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { profile_id, concierge_id, status, destination, limit = 20, offset = 0 } = req.query;

      let query = supabase
        .schema(SCHEMA)
        .from('travel_itineraries')
        .select('*', { count: 'exact' })
        .order('start_date', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

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
          `destination_country.ilike.%${destination}%,destination_city.ilike.%${destination}%`
        );
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('[ItinerariesRoute] Error fetching itineraries', { error });
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
      logger.error('[ItinerariesRoute] Unexpected error', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/itineraries/:id
 * Get itinerary with all items
 */
router.get('/:id', [param('id').isUUID()], validate, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { id } = req.params;

    // Fetch itinerary
    const { data: itinerary, error: itineraryError } = await supabase
      .schema(SCHEMA)
      .from('travel_itineraries')
      .select('*')
      .eq('id', id)
      .single();

    if (itineraryError) {
      if (itineraryError.code === 'PGRST116') {
        return res.status(404).json({ ok: false, error: 'Itinerary not found' });
      }
      logger.error('[ItinerariesRoute] Error fetching itinerary', { error: itineraryError, id });
      return res.status(500).json({ ok: false, error: itineraryError.message });
    }

    // Fetch items
    const { data: items, error: itemsError } = await supabase
      .schema(SCHEMA)
      .from('itinerary_items')
      .select('*')
      .eq('itinerary_id', id)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true });

    if (itemsError) {
      logger.error('[ItinerariesRoute] Error fetching items', { error: itemsError, id });
      return res.status(500).json({ ok: false, error: itemsError.message });
    }

    res.json({
      ok: true,
      data: {
        ...itinerary,
        items: items || [],
      },
    });
  } catch (error: any) {
    logger.error('[ItinerariesRoute] Unexpected error in getById', { error });
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/travel-hub/itineraries
 * Create itinerary
 */
router.post(
  '/',
  [
    body('profile_id').isUUID(),
    body('concierge_id').optional().isUUID(),
    body('title').isString().notEmpty().isLength({ max: 200 }),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('destination_country').isString().notEmpty(),
    body('destination_city').isString().notEmpty(),
    body('start_date').isISO8601(),
    body('end_date').isISO8601(),
    body('traveler_count').optional().isInt({ min: 1, max: 50 }),
    body('budget_cents').optional().isInt({ min: 0 }),
    body('tags').optional().isArray(),
    body('cover_image_url').optional().isURL(),
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
        concierge_id,
        title,
        description,
        destination_country,
        destination_city,
        start_date,
        end_date,
        traveler_count,
        budget_cents,
        tags,
        cover_image_url,
      } = req.body;

      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const durationDays =
        Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const itineraryData = {
        account_id: userId,
        profile_id,
        concierge_id,
        title,
        description,
        destination_country,
        destination_city,
        start_date,
        end_date,
        duration_days: durationDays,
        traveler_count: traveler_count || 1,
        budget_cents,
        currency: 'USD',
        status: 'draft',
        ai_generated: false,
        tags: tags || [],
        cover_image_url,
        metadata: {},
      };

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('travel_itineraries')
        .insert([itineraryData])
        .select()
        .single();

      if (error) {
        logger.error('[ItinerariesRoute] Error creating itinerary', { error });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ItinerariesRoute] Itinerary created', { itineraryId: data.id });
      res.status(201).json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ItinerariesRoute] Unexpected error in create', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/v1/travel-hub/itineraries/:id
 * Update itinerary
 */
router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('title').optional().isString().isLength({ max: 200 }),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('destination_country').optional().isString(),
    body('destination_city').optional().isString(),
    body('start_date').optional().isISO8601(),
    body('end_date').optional().isISO8601(),
    body('traveler_count').optional().isInt({ min: 1, max: 50 }),
    body('budget_cents').optional().isInt({ min: 0 }),
    body('tags').optional().isArray(),
    body('cover_image_url').optional().isURL(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id } = req.params;

      const updates = Object.fromEntries(
        Object.entries(req.body).filter(([_, v]) => v !== undefined)
      );

      // Recalculate duration if dates changed
      if (updates.start_date && updates.end_date) {
        const startDate = new Date(updates.start_date as string);
        const endDate = new Date(updates.end_date as string);
        updates.duration_days =
          Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('travel_itineraries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Itinerary not found' });
        }
        logger.error('[ItinerariesRoute] Error updating itinerary', { error, id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ItinerariesRoute] Itinerary updated', { itineraryId: id });
      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ItinerariesRoute] Unexpected error in update', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/v1/travel-hub/itineraries/:id/status
 * Update itinerary status
 */
router.patch(
  '/:id/status',
  [
    param('id').isUUID(),
    body('status').isIn(['draft', 'planning', 'confirmed', 'in_progress', 'completed']),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id } = req.params;
      const { status } = req.body;

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('travel_itineraries')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Itinerary not found' });
        }
        logger.error('[ItinerariesRoute] Error updating status', { error, id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ItinerariesRoute] Status updated', { itineraryId: id, status });
      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ItinerariesRoute] Unexpected error in status', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/v1/travel-hub/itineraries/:id/items
 * Add item to itinerary
 */
router.post(
  '/:id/items',
  [
    param('id').isUUID(),
    body('day_number').isInt({ min: 1 }),
    body('order_index').isInt({ min: 0 }),
    body('item_type').isIn([
      'activity',
      'destination',
      'transport',
      'accommodation',
      'dining',
      'free_time',
    ]),
    body('title').isString().notEmpty().isLength({ max: 200 }),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('location_name').optional().isString(),
    body('location_address').optional().isString(),
    body('start_time').optional().isString(),
    body('end_time').optional().isString(),
    body('duration_minutes').optional().isInt({ min: 0 }),
    body('destination_id').optional().isUUID(),
    body('price_cents').optional().isInt({ min: 0 }),
    body('booking_url').optional().isURL(),
    body('notes').optional().isString(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id } = req.params;

      const {
        day_number,
        order_index,
        item_type,
        title,
        description,
        location_name,
        location_address,
        start_time,
        end_time,
        duration_minutes,
        destination_id,
        price_cents,
        booking_url,
        notes,
      } = req.body;

      const itemData = {
        itinerary_id: id,
        day_number,
        order_index,
        item_type,
        title,
        description,
        location_name,
        location_address,
        start_time,
        end_time,
        duration_minutes,
        destination_id,
        price_cents,
        currency: 'USD',
        status: 'planned',
        booking_url,
        notes,
        ai_suggested: false,
        metadata: {},
      };

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('itinerary_items')
        .insert([itemData])
        .select()
        .single();

      if (error) {
        logger.error('[ItinerariesRoute] Error adding item', { error, itineraryId: id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ItinerariesRoute] Item added', { itemId: data.id, itineraryId: id });
      res.status(201).json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ItinerariesRoute] Unexpected error in addItem', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/v1/travel-hub/itineraries/:id/items/:itemId
 * Update itinerary item
 */
router.patch(
  '/:id/items/:itemId',
  [
    param('id').isUUID(),
    param('itemId').isUUID(),
    body('day_number').optional().isInt({ min: 1 }),
    body('order_index').optional().isInt({ min: 0 }),
    body('item_type')
      .optional()
      .isIn(['activity', 'destination', 'transport', 'accommodation', 'dining', 'free_time']),
    body('title').optional().isString().isLength({ max: 200 }),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('status').optional().isIn(['planned', 'booked', 'confirmed', 'completed', 'cancelled']),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id, itemId } = req.params;

      const updates = Object.fromEntries(
        Object.entries(req.body).filter(([_, v]) => v !== undefined)
      );

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('itinerary_items')
        .update(updates)
        .eq('id', itemId)
        .eq('itinerary_id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Item not found' });
        }
        logger.error('[ItinerariesRoute] Error updating item', { error, itemId });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ItinerariesRoute] Item updated', { itemId });
      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ItinerariesRoute] Unexpected error in updateItem', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/v1/travel-hub/itineraries/:id/items/:itemId
 * Delete itinerary item
 */
router.delete(
  '/:id/items/:itemId',
  [param('id').isUUID(), param('itemId').isUUID()],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id, itemId } = req.params;

      const { error } = await supabase
        .schema(SCHEMA)
        .from('itinerary_items')
        .delete()
        .eq('id', itemId)
        .eq('itinerary_id', id);

      if (error) {
        logger.error('[ItinerariesRoute] Error deleting item', { error, itemId });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ItinerariesRoute] Item deleted', { itemId, itineraryId: id });
      res.json({ ok: true });
    } catch (error: any) {
      logger.error('[ItinerariesRoute] Unexpected error in deleteItem', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

export default router;
