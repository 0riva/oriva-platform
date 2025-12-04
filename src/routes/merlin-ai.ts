// @ts-nocheck - TODO: Fix type errors
import express, { type Request, type Response, type NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getMerlinAIService } from '../services/merlin-ai';
import type {
  ChatRequest,
  ChatResponse,
  AnalysisRequest,
  InsightsResponse,
  SyncRequest,
  SyncResponse,
  LearningData,
  CognitiveDomain,
} from '../services/merlin-ai';
import { createAuthMiddleware } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types/middleware/auth';
import winston from 'winston';
import crypto from 'crypto';

// Create router
export const createMerlinAIRouter = (supabase: SupabaseClient) => {
  const router = express.Router();
  const merlinService = getMerlinAIService(supabase);

  // Create logger for auth middleware
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
  });

  // Hash function for API keys
  const hashApiKey = async (key: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Buffer.from(hashBuffer).toString('hex');
  };

  // Create auth middleware with required options
  const requireAuth = createAuthMiddleware({
    supabase,
    logger,
    hashApiKey,
  });

  // Debug middleware to log all requests to this router
  router.use('/', (req, res, next) => {
    console.log(`🧙 Merlin AI Router: ${req.method} ${req.originalUrl} (path: ${req.path})`);
    next();
  });

  // Helper to handle async route handlers
  const asyncHandler =
    (fn: Function) =>
    (req: Request, res: Response, next: NextFunction): void => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

  // Validation middleware
  const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }
    next();
  };

  /**
   * GET /api/merlin/debug
   * Simple debug endpoint to test router mounting
   */
  router.get('/debug', (req: Request, res: Response) => {
    res.json({
      ok: true,
      message: 'Merlin AI router is working!',
      timestamp: new Date().toISOString(),
      path: req.path,
      originalUrl: req.originalUrl,
    });
  });

  /**
   * POST /api/merlin/chat
   * Real-time chat with Merlin AI
   */
  router.post(
    '/chat',
    requireAuth,
    [
      body('sessionId').isString().notEmpty(),
      body('message').isString().notEmpty().isLength({ max: 2000 }),
      body('context.domain')
        .isString()
        .isIn([
          'dating',
          'relationships',
          'communication',
          'emotional_intelligence',
          'self_awareness',
          'social_dynamics',
          'career',
          'health',
          'creativity',
          'general',
        ]),
      body('context.recentMessages').optional().isArray(),
      body('context.userProfile').optional(),
      body('context.currentGoals').optional().isArray(),
      body('localProcessingHint').optional(),
    ],
    validateRequest,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const chatRequest: ChatRequest = req.body;

      // Add user ID from auth context
      if (chatRequest.context.userProfile) {
        chatRequest.context.userProfile.userId = req.keyInfo!.userId;
      }

      const response: ChatResponse = await merlinService.processChat(chatRequest);

      res.json({
        ok: true,
        data: response,
      });
    })
  );

  /**
   * POST /api/merlin/analyze
   * Deep cognitive analysis
   */
  router.post(
    '/analyze',
    requireAuth,
    [
      body('context.domain').isString(),
      body('context.data').exists(),
      body('context.userId').optional(), // Will be overridden by auth
      body('context.sessionId').optional().isString(),
      body('depth').isIn(['surface', 'standard', 'deep', 'comprehensive']),
      body('returnInsights').isBoolean(),
    ],
    validateRequest,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const analysisRequest: AnalysisRequest = req.body;

      // Override user ID with authenticated user
      analysisRequest.context.userId = req.keyInfo!.userId;

      const result = await merlinService.analyze(analysisRequest);

      res.json({
        ok: true,
        data: result,
      });
    })
  );

  /**
   * POST /api/merlin/learn
   * Submit learning data to Merlin AI
   */
  router.post(
    '/learn',
    requireAuth,
    [
      body('interaction').isObject(),
      body('interaction.sessionId').isString(),
      body('interaction.domain').isString(),
      body('interaction.messages').isArray(),
      body('interaction.duration').isNumeric(),
      body('outcome').optional(),
      body('feedback').optional(),
      body('timestamp').optional().isISO8601(),
    ],
    validateRequest,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const learningData: LearningData = {
        ...req.body,
        timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date(),
      };

      await merlinService.storeLearningData(learningData);

      res.json({
        ok: true,
        message: 'Learning data stored successfully',
      });
    })
  );

  /**
   * GET /api/merlin/insights
   * Get personalized insights for a user
   */
  router.get(
    '/insights',
    requireAuth,
    [query('domain').optional().isString()],
    validateRequest,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const domain = req.query.domain as CognitiveDomain | undefined;
      const insights: InsightsResponse = await merlinService.getInsights(
        req.keyInfo!.userId,
        domain
      );

      res.json({
        ok: true,
        data: insights,
      });
    })
  );

  /**
   * POST /api/merlin/sync
   * Sync data between local and cloud
   */
  router.post(
    '/sync',
    requireAuth,
    [
      body('lastSyncTimestamp').optional().isISO8601(),
      body('localData').optional(),
      body('requestedData').isArray().notEmpty(),
    ],
    validateRequest,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const syncRequest: SyncRequest = {
        userId: req.keyInfo!.userId,
        lastSyncTimestamp: req.body.lastSyncTimestamp
          ? new Date(req.body.lastSyncTimestamp)
          : undefined,
        localData: req.body.localData,
        requestedData: req.body.requestedData,
      };

      const syncResponse: SyncResponse = await merlinService.sync(syncRequest);

      res.json({
        ok: true,
        data: syncResponse,
      });
    })
  );

  /**
   * POST /api/merlin/memory
   * Store user-specific memory (life goals, values, etc.)
   */
  router.post(
    '/memory',
    requireAuth,
    [
      body('context_type')
        .isString()
        .isIn([
          'life_goals',
          'fears',
          'skills',
          'core_values',
          'life_lessons',
          'lifestyle_preferences',
          'conversation',
          'insight',
        ]),
      body('content').exists(),
      body('metadata').optional(),
      body('privacy_level').optional().isIn(['private', 'app_shared', 'core_shared', 'public']),
      body('app_id').optional().isString(),
    ],
    validateRequest,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { context_type, content, metadata, privacy_level, app_id } = req.body;

      // Store in collaboration_memory table
      const { data, error } = await supabase
        .from('merlin_ai.user_memory')
        .insert({
          user_id: req.keyInfo!.userId,
          app_id: app_id || 'merlin_core',
          context_type,
          content,
          metadata: metadata || {},
          privacy_level: privacy_level || 'private',
          shared_with_core: privacy_level === 'core_shared',
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.json({
        ok: true,
        data: {
          id: data.id,
          message: 'Memory stored successfully',
        },
      });
    })
  );

  /**
   * GET /api/merlin/memory
   * Retrieve user memories
   */
  router.get(
    '/memory',
    requireAuth,
    [
      query('context_type').optional().isString(),
      query('app_id').optional().isString(),
      query('limit').optional().isInt({ min: 1, max: 100 }),
      query('offset').optional().isInt({ min: 0 }),
    ],
    validateRequest,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      let dbQuery = supabase
        .from('merlin_ai.user_memory')
        .select('*')
        .eq('user_id', req.keyInfo!.userId)
        .order('created_at', { ascending: false });

      if (req.query.context_type) {
        dbQuery = dbQuery.eq('context_type', req.query.context_type);
      }

      if (req.query.app_id) {
        dbQuery = dbQuery.eq('app_id', req.query.app_id);
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      dbQuery = dbQuery.range(offset, offset + limit - 1);

      const { data, error, count } = await dbQuery;

      if (error) {
        throw error;
      }

      res.json({
        ok: true,
        data: {
          items: data,
          total: count,
          limit,
          offset,
        },
      });
    })
  );

  /**
   * PUT /api/merlin/memory/:id
   * Update a memory entry
   */
  router.put(
    '/memory/:id',
    requireAuth,
    [
      body('content').optional(),
      body('metadata').optional(),
      body('privacy_level').optional().isIn(['private', 'app_shared', 'core_shared', 'public']),
    ],
    validateRequest,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const updates: any = {};

      if (req.body.content !== undefined) updates.content = req.body.content;
      if (req.body.metadata !== undefined) updates.metadata = req.body.metadata;
      if (req.body.privacy_level !== undefined) {
        updates.privacy_level = req.body.privacy_level;
        updates.shared_with_core = req.body.privacy_level === 'core_shared';
      }

      const { data, error } = await supabase
        .from('merlin_ai.user_memory')
        .update(updates)
        .eq('id', id)
        .eq('user_id', req.keyInfo!.userId) // Ensure user owns this memory
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          res.status(404).json({
            ok: false,
            error: 'Memory not found',
          });
          return;
        }
        throw error;
      }

      res.json({
        ok: true,
        data: {
          id: data.id,
          message: 'Memory updated successfully',
        },
      });
    })
  );

  /**
   * DELETE /api/merlin/memory/:id
   * Delete a memory entry
   */
  router.delete(
    '/memory/:id',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      const { error } = await supabase
        .from('merlin_ai.user_memory')
        .delete()
        .eq('id', id)
        .eq('user_id', req.keyInfo!.userId);

      if (error) {
        throw error;
      }

      res.json({
        ok: true,
        message: 'Memory deleted successfully',
      });
    })
  );

  /**
   * GET /api/merlin/profile
   * Get user's cognitive profile
   */
  router.get(
    '/profile',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { data, error } = await supabase
        .from('merlin_ai.user_profiles')
        .select('*')
        .eq('user_id', req.keyInfo!.userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Create profile if it doesn't exist
      if (!data) {
        const { data: newProfile, error: createError } = await supabase
          .from('merlin_ai.user_profiles')
          .insert({
            user_id: req.keyInfo!.userId,
            life_goals: [],
            fears: [],
            skill_set: [],
            core_values: [],
            life_lessons: [],
            lifestyle_preferences: {},
            cognitive_profile: {},
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        res.json({
          ok: true,
          data: newProfile,
        });
      }

      res.json({
        ok: true,
        data,
      });
    })
  );

  /**
   * PUT /api/merlin/profile
   * Update user's cognitive profile
   */
  router.put(
    '/profile',
    requireAuth,
    [
      body('life_goals').optional().isArray(),
      body('fears').optional().isArray(),
      body('skill_set').optional().isArray(),
      body('core_values').optional().isArray(),
      body('life_lessons').optional().isArray(),
      body('lifestyle_preferences').optional(),
      body('cognitive_profile').optional(),
    ],
    validateRequest,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const updates: any = {};

      // Only update fields that were provided
      const fields = [
        'life_goals',
        'fears',
        'skill_set',
        'core_values',
        'life_lessons',
        'lifestyle_preferences',
        'cognitive_profile',
      ];

      fields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      const { data, error } = await supabase
        .from('merlin_ai.user_profiles')
        .upsert({
          user_id: req.keyInfo!.userId,
          ...updates,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.json({
        ok: true,
        data,
      });
    })
  );

  /**
   * GET /api/merlin/progress
   * Get user's progress across cognitive domains
   */
  router.get(
    '/progress',
    requireAuth,
    [query('domain').optional().isString()],
    validateRequest,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      let dbQuery = supabase
        .from('merlin_ai.user_progress')
        .select('*')
        .eq('user_id', req.keyInfo!.userId)
        .order('timestamp', { ascending: false });

      if (req.query.domain) {
        dbQuery = dbQuery.eq('domain', req.query.domain);
      }

      const { data, error } = await dbQuery;

      if (error) {
        throw error;
      }

      res.json({
        ok: true,
        data,
      });
    })
  );

  /**
   * GET /api/merlin/knowledge
   * Search knowledge base
   */
  router.get(
    '/knowledge',
    [
      query('category').optional().isString(),
      query('search').optional().isString(),
      query('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    validateRequest,
    asyncHandler(async (req: Request, res: Response) => {
      let dbQuery = supabase
        .from('merlin_ai.knowledge_base')
        .select('*')
        .order('created_at', { ascending: false });

      if (req.query.category) {
        dbQuery = dbQuery.eq('category', req.query.category);
      }

      if (req.query.search) {
        dbQuery = dbQuery.textSearch('title', req.query.search as string);
      }

      const limit = parseInt(req.query.limit as string) || 20;
      dbQuery = dbQuery.limit(limit);

      const { data, error } = await dbQuery;

      if (error) {
        throw error;
      }

      res.json({
        ok: true,
        data,
      });
    })
  );

  return router;
};

export default createMerlinAIRouter;

// Backward compatibility exports (deprecated)
/** @deprecated Use createMerlinAIRouter instead */
export const createHugoAIRouter = createMerlinAIRouter;
