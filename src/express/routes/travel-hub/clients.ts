/**
 * Client Routes
 * GET /api/v1/travel-hub/clients - List clients for a concierge
 * GET /api/v1/travel-hub/clients/:id - Get client by ID
 * POST /api/v1/travel-hub/clients/new - Create new client with contact info
 * POST /api/v1/travel-hub/clients - Create client relationship (existing profile)
 * PATCH /api/v1/travel-hub/clients/:id - Update client relationship
 * PATCH /api/v1/travel-hub/clients/:id/status - Update client status
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
 * GET /api/v1/travel-hub/clients
 * List clients for a concierge
 */
router.get(
  '/',
  [
    query('concierge_id').isUUID(),
    query('status').optional().isIn(['active', 'inactive', 'pending']),
    query('search').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { concierge_id, status, search, limit = 20, offset = 0 } = req.query;

      let query = supabase
        .schema(SCHEMA)
        .from('concierge_clients')
        .select('*', { count: 'exact' })
        .eq('concierge_id', concierge_id)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.ilike('notes', `%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('[ClientsRoute] Error fetching clients', { error });
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
      logger.error('[ClientsRoute] Unexpected error', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/v1/travel-hub/clients/:id
 * Get client by ID
 */
router.get('/:id', [param('id').isUUID()], validate, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    const { id } = req.params;

    const { data, error } = await supabase
      .schema(SCHEMA)
      .from('concierge_clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ ok: false, error: 'Client not found' });
      }
      logger.error('[ClientsRoute] Error fetching client', { error, id });
      return res.status(500).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, data });
  } catch (error: any) {
    logger.error('[ClientsRoute] Unexpected error in getById', { error });
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/travel-hub/clients/new
 * Create a new client with basic contact info
 * (Creates a placeholder profile and links to current concierge)
 */
router.post(
  '/new',
  [
    body('name').isString().isLength({ min: 1, max: 200 }),
    body('email').isEmail(),
    body('phone').optional().isString().isLength({ max: 50 }),
    body('notes').optional().isString().isLength({ max: 2000 }),
    body('preferences').optional().isObject(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const { name, email, phone, notes, preferences } = req.body;

      // Get the concierge record for the current user
      const { data: concierge, error: conciergeError } = await supabase
        .schema(SCHEMA)
        .from('concierges')
        .select('id, account_id')
        .eq('user_id', userId)
        .single();

      if (conciergeError || !concierge) {
        logger.warn('[ClientsRoute] User is not a concierge', { userId });
        return res
          .status(403)
          .json({ ok: false, error: 'You must be a concierge to create clients' });
      }

      // Create client record with embedded contact info in metadata
      const clientData = {
        account_id: concierge.account_id,
        concierge_id: concierge.id,
        profile_id: userId, // Use concierge's user ID as placeholder profile
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
        },
      };

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('concierge_clients')
        .insert([clientData])
        .select()
        .single();

      if (error) {
        logger.error('[ClientsRoute] Error creating new client', { error });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ClientsRoute] New client created', { clientId: data.id, name, email });
      res.status(201).json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ClientsRoute] Unexpected error in createNew', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/v1/travel-hub/clients
 * Create client relationship (with existing profile)
 */
router.post(
  '/',
  [
    body('concierge_id').isUUID(),
    body('profile_id').isUUID(),
    body('preferences').optional().isObject(),
    body('notes').optional().isString().isLength({ max: 2000 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const { concierge_id, profile_id, preferences, notes } = req.body;

      const clientData = {
        account_id: userId,
        concierge_id,
        profile_id,
        status: 'pending',
        preferences: preferences || {},
        notes,
        total_bookings: 0,
        total_spent_cents: 0,
        metadata: {},
      };

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('concierge_clients')
        .insert([clientData])
        .select()
        .single();

      if (error) {
        logger.error('[ClientsRoute] Error creating client', { error });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ClientsRoute] Client created', { clientId: data.id });
      res.status(201).json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ClientsRoute] Unexpected error in create', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/v1/travel-hub/clients/:id
 * Update client relationship
 */
router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('preferences').optional().isObject(),
    body('notes').optional().isString().isLength({ max: 2000 }),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id } = req.params;

      const updates = Object.fromEntries(
        Object.entries(req.body).filter(([_, v]) => v !== undefined)
      );

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('concierge_clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Client not found' });
        }
        logger.error('[ClientsRoute] Error updating client', { error, id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ClientsRoute] Client updated', { clientId: id });
      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ClientsRoute] Unexpected error in update', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/v1/travel-hub/clients/:id/status
 * Update client status
 */
router.patch(
  '/:id/status',
  [param('id').isUUID(), body('status').isIn(['active', 'inactive', 'pending'])],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const { id } = req.params;
      const { status } = req.body;

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('concierge_clients')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ ok: false, error: 'Client not found' });
        }
        logger.error('[ClientsRoute] Error updating status', { error, id });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ClientsRoute] Status updated', { clientId: id, status });
      res.json({ ok: true, data });
    } catch (error: any) {
      logger.error('[ClientsRoute] Unexpected error in status', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

export default router;
