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
import { randomUUID } from 'crypto';
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
 * GET /api/v1/travel-hub/clients/me
 * Get clients for the currently logged-in concierge
 * @param for_concierge_id - Optional: Fetch clients for a specific concierge (for master admins viewing another agent's clients)
 */
router.get(
  '/me',
  [
    query('status').optional().isIn(['active', 'inactive', 'pending']),
    query('search').optional().isString(),
    query('for_concierge_id').optional().isUUID(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const userId = req.user?.id;
      const userEmail = req.user?.email;

      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const { status, search, for_concierge_id } = req.query;

      // Master admin emails that can view any concierge's clients
      const MASTER_ADMIN_EMAILS = ['tools@gavrielshaw.com', 'think@gavrielshaw.com'];
      const isMasterAdmin = userEmail && MASTER_ADMIN_EMAILS.includes(userEmail);

      let targetConciergeId: string | null = null;

      // If for_concierge_id is provided and user is master admin, use that concierge
      if (for_concierge_id && isMasterAdmin) {
        // for_concierge_id is actually a profile_id (auth user ID), need to look up the concierge record
        let targetConcierge = await supabase
          .schema(SCHEMA)
          .from('concierges')
          .select('id')
          .eq('profile_id', for_concierge_id)
          .single();

        // If concierge doesn't exist for this agent, create one
        if (targetConcierge.error || !targetConcierge.data) {
          logger.info('[ClientsRoute] Creating concierge record for agent', {
            profileId: for_concierge_id,
          });

          // Get a valid account_id from existing org membership or use the profile_id
          const { data: newConcierge, error: createError } = await supabase
            .schema(SCHEMA)
            .from('concierges')
            .insert([
              {
                account_id: for_concierge_id, // Use profile_id as account placeholder
                profile_id: for_concierge_id,
                display_name: `Agent ${(for_concierge_id as string).slice(0, 8)}`,
                bio: 'Travel concierge agent',
                specialties: ['general'],
                languages: ['en'],
                currency: 'USD',
                availability_status: 'available',
                rating: 0,
                review_count: 0,
                total_bookings: 0,
                verified: false,
                featured: false,
                metadata: { auto_created: true, created_by_master_admin: userId },
              },
            ])
            .select('id')
            .single();

          if (createError || !newConcierge) {
            logger.error('[ClientsRoute] Failed to create concierge for agent', {
              error: createError,
              profileId: for_concierge_id,
            });
            return res.json({ ok: true, data: [] });
          }

          targetConciergeId = newConcierge.id;
          logger.info('[ClientsRoute] Created new concierge for agent', {
            conciergeId: targetConciergeId,
            profileId: for_concierge_id,
          });
        } else {
          targetConciergeId = targetConcierge.data.id;
        }

        logger.debug('[ClientsRoute] Master admin fetching clients for concierge', {
          userId,
          profileId: for_concierge_id,
          targetConciergeId,
        });
      } else {
        // Get the concierge record for the current user (using account_id which is the auth user ID)
        const { data: concierge, error: conciergeError } = await supabase
          .schema(SCHEMA)
          .from('concierges')
          .select('id')
          .eq('account_id', userId)
          .single();

        if (conciergeError || !concierge) {
          // User is not a concierge - return empty array
          logger.debug('[ClientsRoute] User is not a concierge, returning empty clients', {
            userId,
          });
          return res.json({ ok: true, data: [] });
        }

        targetConciergeId = concierge.id;
      }

      let clientQuery = supabase
        .schema(SCHEMA)
        .from('travel_clients')
        .select('*')
        .eq('concierge_id', targetConciergeId)
        .order('created_at', { ascending: false });

      if (status) {
        clientQuery = clientQuery.eq('status', status);
      }

      if (search) {
        clientQuery = clientQuery.ilike('notes', `%${search}%`);
      }

      const { data, error } = await clientQuery;

      if (error) {
        logger.error('[ClientsRoute] Error fetching my clients', { error, userId });
        return res.status(500).json({ ok: false, error: error.message });
      }

      res.json({ ok: true, data: data || [] });
    } catch (error: any) {
      logger.error('[ClientsRoute] Unexpected error in getMyClients', { error });
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

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
        .from('travel_clients')
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
      .from('travel_clients')
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
 * Master admins can also create clients without being a concierge
 * @param for_concierge_id - Optional: Create client for a specific concierge (for master admins creating on behalf of another agent)
 */
router.post(
  '/new',
  [
    body('name').isString().isLength({ min: 1, max: 200 }),
    body('email').isEmail(),
    body('phone').optional().isString().isLength({ max: 50 }),
    body('notes').optional().isString().isLength({ max: 2000 }),
    body('preferences').optional().isObject(),
    body('for_concierge_id').optional().isUUID(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase(req);
      const userId = req.user?.id;
      const userEmail = req.user?.email;

      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }

      const { name, email, phone, notes, preferences, for_concierge_id } = req.body;

      // Master admin emails that can create clients without being a concierge
      const MASTER_ADMIN_EMAILS = ['tools@gavrielshaw.com', 'think@gavrielshaw.com'];
      const isMasterAdmin = userEmail && MASTER_ADMIN_EMAILS.includes(userEmail);

      let conciergeId: string | undefined;
      let accountId: string | undefined;

      // If for_concierge_id is provided and user is master admin, use that concierge
      if (for_concierge_id && isMasterAdmin) {
        // Get the target concierge's account_id
        let targetConcierge = await supabase
          .schema(SCHEMA)
          .from('concierges')
          .select('id, account_id')
          .eq('profile_id', for_concierge_id)
          .single();

        // If concierge doesn't exist for this agent, create one
        if (targetConcierge.error || !targetConcierge.data) {
          logger.info('[ClientsRoute] Creating concierge record for agent', {
            profileId: for_concierge_id,
          });

          const { data: newConcierge, error: createError } = await supabase
            .schema(SCHEMA)
            .from('concierges')
            .insert([
              {
                account_id: for_concierge_id, // Use profile_id as account placeholder
                profile_id: for_concierge_id,
                display_name: `Agent ${(for_concierge_id as string).slice(0, 8)}`,
                bio: 'Travel concierge agent',
                specialties: ['general'],
                languages: ['en'],
                currency: 'USD',
                availability_status: 'available',
                rating: 0,
                review_count: 0,
                total_bookings: 0,
                verified: false,
                featured: false,
                metadata: { auto_created: true, created_by_master_admin: userId },
              },
            ])
            .select('id, account_id')
            .single();

          if (createError || !newConcierge) {
            logger.error('[ClientsRoute] Failed to create concierge for agent', {
              error: createError,
              profileId: for_concierge_id,
            });
            return res.status(500).json({ ok: false, error: 'Failed to create concierge profile' });
          }

          conciergeId = newConcierge.id;
          accountId = newConcierge.account_id;
          logger.info('[ClientsRoute] Created new concierge for agent', {
            conciergeId,
            profileId: for_concierge_id,
          });
        } else {
          conciergeId = targetConcierge.data.id;
          accountId = targetConcierge.data.account_id;
        }

        logger.info('[ClientsRoute] Master admin creating client for specific concierge', {
          userId,
          targetConciergeId: conciergeId,
        });
      } else {
        // Get the concierge record for the current user (using account_id which is the auth user ID)
        const { data: concierge, error: conciergeError } = await supabase
          .schema(SCHEMA)
          .from('concierges')
          .select('id, account_id')
          .eq('account_id', userId)
          .single();

        // Allow master admins to create clients even without being a concierge
        conciergeId = concierge?.id;
        accountId = concierge?.account_id;

        if ((conciergeError || !concierge) && !isMasterAdmin) {
          logger.warn('[ClientsRoute] User is not a concierge', { userId });
          return res
            .status(403)
            .json({ ok: false, error: 'You must be a concierge to create clients' });
        }

        // For master admin without concierge record and no for_concierge_id, use first available concierge or create placeholder
        if (!concierge && isMasterAdmin) {
          // Try to get any concierge from the system to associate with
          const { data: anyConc } = await supabase
            .schema(SCHEMA)
            .from('concierges')
            .select('id, account_id')
            .limit(1)
            .single();

          if (anyConc) {
            conciergeId = anyConc.id;
            accountId = anyConc.account_id;
            logger.info('[ClientsRoute] Master admin using existing concierge', { conciergeId });
          } else {
            // No concierge exists - create one for the master admin
            const { data: newConc, error: createError } = await supabase
              .schema(SCHEMA)
              .from('concierges')
              .insert([
                {
                  account_id: userId, // Use user ID as placeholder account
                  profile_id: userId, // Use user ID as profile reference
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
                },
              ])
              .select()
              .single();

            if (createError || !newConc) {
              logger.error('[ClientsRoute] Failed to create placeholder concierge', {
                error: createError,
              });
              return res
                .status(500)
                .json({ ok: false, error: 'Failed to set up concierge profile' });
            }

            conciergeId = newConc.id;
            accountId = newConc.account_id;
            logger.info('[ClientsRoute] Created placeholder concierge for master admin', {
              conciergeId,
            });
          }
        }
      }

      // Create client record with embedded contact info in metadata
      // Generate a unique placeholder profile_id for clients without a real user account
      const placeholderProfileId = randomUUID();

      const clientData = {
        account_id: accountId,
        concierge_id: conciergeId,
        profile_id: placeholderProfileId, // Unique placeholder for each client
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
          is_placeholder_profile: true, // Flag indicating this is not a real user profile
          created_by_master_admin: isMasterAdmin && for_concierge_id ? true : undefined,
        },
      };

      const { data, error } = await supabase
        .schema(SCHEMA)
        .from('travel_clients')
        .insert([clientData])
        .select()
        .single();

      if (error) {
        logger.error('[ClientsRoute] Error creating new client', { error });
        return res.status(500).json({ ok: false, error: error.message });
      }

      logger.info('[ClientsRoute] New client created', {
        clientId: data.id,
        name,
        email,
        forConciergeId: for_concierge_id || 'self',
      });
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
        .from('travel_clients')
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
        .from('travel_clients')
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
        .from('travel_clients')
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
