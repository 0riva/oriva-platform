/**
 * Oriva Events Routes
 * Mounted at /api/oriva/events
 *
 * Extracted from api/index.ts (Phase 4 sub-router migration).
 * Handlers close over module-level singletons from index.ts, passed in via factory.
 */

import { Router, type Request, type Response, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import type { ApiKeyInfo } from '../../types/middleware/auth';
import { respondWithError } from '../utils/response';

type AuthenticatedHandler = (
  req: Request,
  res: Response,
  keyInfo: ApiKeyInfo
) => Promise<void> | void;

type WithAuthContext = (handler: AuthenticatedHandler) => RequestHandler;

export function createOrivaEventsRouter(
  supabase: SupabaseClient,
  logger: Logger,
  validateAuth: RequestHandler[],
  withAuthContext: WithAuthContext
): Router {
  const router = Router();

  /**
   * POST /api/oriva/events - Create a new event
   * Creates a new event in the events table with validation
   * Requires: title, description, startDate, endDate, location, isOnline, category, maxAttendees, price
   */
  router.post(
    '/',
    ...validateAuth,
    withAuthContext(async (req: any, res: any, keyInfo: ApiKeyInfo) => {
      try {
        const userId = keyInfo?.userId || (req as any).authContext?.userId;
        if (!userId) {
          return respondWithError(res, 401, 'UNAUTHORIZED', 'User authentication required');
        }

        const {
          title,
          description,
          startDate,
          endDate,
          location,
          isOnline,
          category,
          maxAttendees,
          price,
          tags,
          imageUrl,
        } = req.body;

        // Validation
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
          return respondWithError(
            res,
            400,
            'VALIDATION_ERROR',
            'Title is required and must be a non-empty string'
          );
        }

        if (!description || typeof description !== 'string' || description.trim().length === 0) {
          return respondWithError(
            res,
            400,
            'VALIDATION_ERROR',
            'Description is required and must be a non-empty string'
          );
        }

        if (!startDate || !endDate) {
          return respondWithError(
            res,
            400,
            'VALIDATION_ERROR',
            'Start date and end date are required'
          );
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return respondWithError(res, 400, 'VALIDATION_ERROR', 'Invalid date format');
        }

        if (end <= start) {
          return respondWithError(
            res,
            400,
            'VALIDATION_ERROR',
            'End date must be after start date'
          );
        }

        if (typeof isOnline !== 'boolean') {
          return respondWithError(res, 400, 'VALIDATION_ERROR', 'isOnline must be a boolean');
        }

        if (!category || typeof category !== 'string') {
          return respondWithError(res, 400, 'VALIDATION_ERROR', 'Category is required');
        }

        // Get category ID by name
        const { data: categoryData, error: categoryError } = await supabase
          .from('event_categories')
          .select('id')
          .eq('name', category)
          .single();

        if (categoryError || !categoryData) {
          logger.error('Category not found', { category, error: categoryError });
          return respondWithError(res, 400, 'INVALID_CATEGORY', `Category '${category}' not found`);
        }

        const categoryId = categoryData.id;

        // Optional fields
        const eventLocation = location && typeof location === 'string' ? location.trim() : null;
        const eventMaxAttendees =
          maxAttendees && Number.isFinite(maxAttendees) && maxAttendees > 0 ? maxAttendees : null;
        const eventPrice = price !== undefined && Number.isFinite(price) && price >= 0 ? price : 0;
        const eventTags = Array.isArray(tags)
          ? tags.filter((t: any) => typeof t === 'string').slice(0, 20)
          : [];

        // Insert event into events table
        const { data: newEvent, error: insertError } = await supabase
          .from('events')
          .insert({
            title: title.trim(),
            description: description.trim(),
            category_id: categoryId,
            organizer_id: userId,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            location: eventLocation,
            is_online: isOnline,
            max_participants: eventMaxAttendees,
            price: eventPrice > 0 ? eventPrice : null,
            tags: eventTags,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          logger.error('Error creating event', { error: insertError, userId, title });
          return respondWithError(res, 500, 'CREATE_FAILED', 'Failed to create event');
        }

        logger.info('Event created successfully', {
          eventId: newEvent.id,
          userId,
          title,
          category,
        });

        // Transform response to match front-end expectations
        const responseEvent = {
          id: newEvent.id,
          title: newEvent.title,
          description: newEvent.description,
          startDate: newEvent.start_time,
          endDate: newEvent.end_time,
          location: newEvent.location,
          isOnline: newEvent.is_online,
          category: category,
          organizer: newEvent.organizer_id,
          maxAttendees: newEvent.max_participants,
          currentAttendees: newEvent.current_participants,
          price: newEvent.price || 0,
          tags: newEvent.tags || [],
          imageUrl: imageUrl || null,
          createdAt: newEvent.created_at,
          updatedAt: newEvent.updated_at,
          success: true,
        };

        res.status(201).json({
          success: true,
          ok: true,
          data: responseEvent,
          message: 'Event created successfully',
        });
      } catch (error) {
        logger.error('Event creation error', { error });
        respondWithError(res, 500, 'SERVER_ERROR', 'Internal server error');
      }
    })
  );

  /**
   * GET /api/oriva/events - Get all events (with optional filtering)
   * Query parameters: category, limit, offset, startDate, endDate
   */
  router.get('/', async (req, res) => {
    try {
      const { category, limit = 20, offset = 0, startDate, endDate } = req.query;

      let query = supabase
        .from('events')
        .select('*, event_categories(name)', { count: 'exact' })
        .eq('is_active', true)
        .order('start_time', { ascending: true });

      // Apply filters
      if (category && typeof category === 'string') {
        const { data: categoryData } = await supabase
          .from('event_categories')
          .select('id')
          .eq('name', category)
          .single();

        if (categoryData) {
          query = query.eq('category_id', categoryData.id);
        }
      }

      if (startDate && typeof startDate === 'string') {
        query = query.gte('start_time', new Date(startDate).toISOString());
      }

      if (endDate && typeof endDate === 'string') {
        query = query.lte('end_time', new Date(endDate).toISOString());
      }

      const pageLimit = Math.min(Number(limit) || 20, 100);
      const pageOffset = Number(offset) || 0;

      const {
        data: events,
        error,
        count,
      } = await query.range(pageOffset, pageOffset + pageLimit - 1);

      if (error) {
        logger.error('Error fetching events', { error });
        return respondWithError(res, 500, 'FETCH_FAILED', 'Failed to fetch events');
      }

      res.json({
        success: true,
        ok: true,
        data: events || [],
        total: count || 0,
        limit: pageLimit,
        offset: pageOffset,
      });
    } catch (error) {
      logger.error('Events fetch error', { error });
      respondWithError(res, 500, 'SERVER_ERROR', 'Internal server error');
    }
  });

  /**
   * GET /api/oriva/events/:eventId - Get a specific event
   */
  router.get('/:eventId', async (req, res) => {
    try {
      const { eventId } = req.params;

      const { data: event, error } = await supabase
        .from('events')
        .select('*, event_categories(name)')
        .eq('id', eventId)
        .single();

      if (error || !event) {
        logger.warn('Event not found', { eventId });
        return respondWithError(res, 404, 'NOT_FOUND', 'Event not found');
      }

      res.json({
        success: true,
        ok: true,
        data: event,
      });
    } catch (error) {
      logger.error('Error fetching event', { error });
      respondWithError(res, 500, 'SERVER_ERROR', 'Internal server error');
    }
  });

  return router;
}
