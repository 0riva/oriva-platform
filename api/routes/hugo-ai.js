"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHugoAIRouter = void 0;
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const hugo_ai_1 = require("../services/hugo-ai");
const auth_1 = require("../middleware/auth");
const winston_1 = __importDefault(require("winston"));
const crypto_1 = __importDefault(require("crypto"));
// Create router
const createHugoAIRouter = (supabase) => {
    const router = express_1.default.Router();
    const hugoService = (0, hugo_ai_1.getHugoAIService)(supabase);
    // Create logger for auth middleware
    const logger = winston_1.default.createLogger({
        level: 'info',
        format: winston_1.default.format.json(),
        transports: [
            new winston_1.default.transports.Console()
        ]
    });
    // Hash function for API keys
    const hashApiKey = async (key) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(key);
        const hashBuffer = await crypto_1.default.subtle.digest('SHA-256', data);
        return Buffer.from(hashBuffer).toString('hex');
    };
    // Create auth middleware with required options
    const requireAuth = (0, auth_1.createAuthMiddleware)({
        supabase,
        logger,
        hashApiKey
    });
    // Debug middleware to log all requests to this router
    router.use('/', (req, res, next) => {
        console.log(`🤖 Hugo AI Router: ${req.method} ${req.originalUrl} (path: ${req.path})`);
        next();
    });
    // Helper to handle async route handlers
    const asyncHandler = (fn) => (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
    // Validation middleware
    const validateRequest = (req, res, next) => {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                ok: false,
                error: 'Validation failed',
                details: errors.array()
            });
            return;
        }
        next();
    };
    /**
     * GET /api/hugo/debug
     * Simple debug endpoint to test router mounting
     */
    router.get('/debug', (req, res) => {
        res.json({
            ok: true,
            message: 'Hugo AI router is working!',
            timestamp: new Date().toISOString(),
            path: req.path,
            originalUrl: req.originalUrl
        });
    });
    /**
     * POST /api/hugo/chat
     * Real-time chat with Hugo AI
     */
    router.post('/chat', requireAuth, [
        (0, express_validator_1.body)('sessionId').isString().notEmpty(),
        (0, express_validator_1.body)('message').isString().notEmpty().isLength({ max: 2000 }),
        (0, express_validator_1.body)('context.domain').isString().isIn([
            'dating', 'relationships', 'communication',
            'emotional_intelligence', 'self_awareness', 'social_dynamics',
            'career', 'health', 'creativity', 'general'
        ]),
        (0, express_validator_1.body)('context.recentMessages').optional().isArray(),
        (0, express_validator_1.body)('context.userProfile').optional(),
        (0, express_validator_1.body)('context.currentGoals').optional().isArray(),
        (0, express_validator_1.body)('localProcessingHint').optional()
    ], validateRequest, asyncHandler(async (req, res) => {
        const chatRequest = req.body;
        // Add user ID from auth context
        if (chatRequest.context.userProfile) {
            chatRequest.context.userProfile.userId = req.keyInfo.userId;
        }
        const response = await hugoService.processChat(chatRequest);
        res.json({
            ok: true,
            data: response
        });
    }));
    /**
     * POST /api/hugo/analyze
     * Deep cognitive analysis
     */
    router.post('/analyze', requireAuth, [
        (0, express_validator_1.body)('context.domain').isString(),
        (0, express_validator_1.body)('context.data').exists(),
        (0, express_validator_1.body)('context.userId').optional(), // Will be overridden by auth
        (0, express_validator_1.body)('context.sessionId').optional().isString(),
        (0, express_validator_1.body)('depth').isIn(['surface', 'standard', 'deep', 'comprehensive']),
        (0, express_validator_1.body)('returnInsights').isBoolean()
    ], validateRequest, asyncHandler(async (req, res) => {
        const analysisRequest = req.body;
        // Override user ID with authenticated user
        analysisRequest.context.userId = req.keyInfo.userId;
        const result = await hugoService.analyze(analysisRequest);
        res.json({
            ok: true,
            data: result
        });
    }));
    /**
     * POST /api/hugo/learn
     * Submit learning data to Hugo AI
     */
    router.post('/learn', requireAuth, [
        (0, express_validator_1.body)('interaction').isObject(),
        (0, express_validator_1.body)('interaction.sessionId').isString(),
        (0, express_validator_1.body)('interaction.domain').isString(),
        (0, express_validator_1.body)('interaction.messages').isArray(),
        (0, express_validator_1.body)('interaction.duration').isNumeric(),
        (0, express_validator_1.body)('outcome').optional(),
        (0, express_validator_1.body)('feedback').optional(),
        (0, express_validator_1.body)('timestamp').optional().isISO8601()
    ], validateRequest, asyncHandler(async (req, res) => {
        const learningData = {
            ...req.body,
            timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date()
        };
        await hugoService.storeLearningData(learningData);
        res.json({
            ok: true,
            message: 'Learning data stored successfully'
        });
    }));
    /**
     * GET /api/hugo/insights
     * Get personalized insights for a user
     */
    router.get('/insights', requireAuth, [
        (0, express_validator_1.query)('domain').optional().isString()
    ], validateRequest, asyncHandler(async (req, res) => {
        const domain = req.query.domain;
        const insights = await hugoService.getInsights(req.keyInfo.userId, domain);
        res.json({
            ok: true,
            data: insights
        });
    }));
    /**
     * POST /api/hugo/sync
     * Sync data between local and cloud
     */
    router.post('/sync', requireAuth, [
        (0, express_validator_1.body)('lastSyncTimestamp').optional().isISO8601(),
        (0, express_validator_1.body)('localData').optional(),
        (0, express_validator_1.body)('requestedData').isArray().notEmpty()
    ], validateRequest, asyncHandler(async (req, res) => {
        const syncRequest = {
            userId: req.keyInfo.userId,
            lastSyncTimestamp: req.body.lastSyncTimestamp
                ? new Date(req.body.lastSyncTimestamp)
                : undefined,
            localData: req.body.localData,
            requestedData: req.body.requestedData
        };
        const syncResponse = await hugoService.sync(syncRequest);
        res.json({
            ok: true,
            data: syncResponse
        });
    }));
    /**
     * POST /api/hugo/memory
     * Store user-specific memory (life goals, values, etc.)
     */
    router.post('/memory', requireAuth, [
        (0, express_validator_1.body)('context_type').isString().isIn([
            'life_goals', 'fears', 'skills', 'core_values',
            'life_lessons', 'lifestyle_preferences', 'conversation', 'insight'
        ]),
        (0, express_validator_1.body)('content').exists(),
        (0, express_validator_1.body)('metadata').optional(),
        (0, express_validator_1.body)('privacy_level').optional().isIn(['private', 'app_shared', 'core_shared', 'public']),
        (0, express_validator_1.body)('app_id').optional().isString()
    ], validateRequest, asyncHandler(async (req, res) => {
        const { context_type, content, metadata, privacy_level, app_id } = req.body;
        // Store in collaboration_memory table
        const { data, error } = await supabase
            .from('hugo_collaboration_memory')
            .insert({
            user_id: req.keyInfo.userId,
            app_id: app_id || 'hugo_core',
            context_type,
            content,
            metadata: metadata || {},
            privacy_level: privacy_level || 'private',
            shared_with_core: privacy_level === 'core_shared'
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
                message: 'Memory stored successfully'
            }
        });
    }));
    /**
     * GET /api/hugo/memory
     * Retrieve user memories
     */
    router.get('/memory', requireAuth, [
        (0, express_validator_1.query)('context_type').optional().isString(),
        (0, express_validator_1.query)('app_id').optional().isString(),
        (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }),
        (0, express_validator_1.query)('offset').optional().isInt({ min: 0 })
    ], validateRequest, asyncHandler(async (req, res) => {
        let query = supabase
            .from('hugo_collaboration_memory')
            .select('*')
            .eq('user_id', req.keyInfo.userId)
            .order('created_at', { ascending: false });
        if (req.query.context_type) {
            query = query.eq('context_type', req.query.context_type);
        }
        if (req.query.app_id) {
            query = query.eq('app_id', req.query.app_id);
        }
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        query = query.range(offset, offset + limit - 1);
        const { data, error, count } = await query;
        if (error) {
            throw error;
        }
        res.json({
            ok: true,
            data: {
                items: data,
                total: count,
                limit,
                offset
            }
        });
    }));
    /**
     * PUT /api/hugo/memory/:id
     * Update a memory entry
     */
    router.put('/memory/:id', requireAuth, [
        (0, express_validator_1.body)('content').optional(),
        (0, express_validator_1.body)('metadata').optional(),
        (0, express_validator_1.body)('privacy_level').optional().isIn(['private', 'app_shared', 'core_shared', 'public'])
    ], validateRequest, asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updates = {};
        if (req.body.content !== undefined)
            updates.content = req.body.content;
        if (req.body.metadata !== undefined)
            updates.metadata = req.body.metadata;
        if (req.body.privacy_level !== undefined) {
            updates.privacy_level = req.body.privacy_level;
            updates.shared_with_core = req.body.privacy_level === 'core_shared';
        }
        const { data, error } = await supabase
            .from('hugo_collaboration_memory')
            .update(updates)
            .eq('id', id)
            .eq('user_id', req.keyInfo.userId) // Ensure user owns this memory
            .select()
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                res.status(404).json({
                    ok: false,
                    error: 'Memory not found'
                });
                return;
            }
            throw error;
        }
        res.json({
            ok: true,
            data: {
                id: data.id,
                message: 'Memory updated successfully'
            }
        });
    }));
    /**
     * DELETE /api/hugo/memory/:id
     * Delete a memory entry
     */
    router.delete('/memory/:id', requireAuth, asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { error } = await supabase
            .from('hugo_collaboration_memory')
            .delete()
            .eq('id', id)
            .eq('user_id', req.keyInfo.userId);
        if (error) {
            throw error;
        }
        res.json({
            ok: true,
            message: 'Memory deleted successfully'
        });
    }));
    /**
     * GET /api/hugo/profile
     * Get user's cognitive profile
     */
    router.get('/profile', requireAuth, asyncHandler(async (req, res) => {
        const { data, error } = await supabase
            .from('hugo_user_profiles')
            .select('*')
            .eq('user_id', req.keyInfo.userId)
            .single();
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        // Create profile if it doesn't exist
        if (!data) {
            const { data: newProfile, error: createError } = await supabase
                .from('hugo_user_profiles')
                .insert({
                user_id: req.keyInfo.userId,
                life_goals: [],
                fears: [],
                skill_set: [],
                core_values: [],
                life_lessons: [],
                lifestyle_preferences: {},
                cognitive_profile: {}
            })
                .select()
                .single();
            if (createError) {
                throw createError;
            }
            res.json({
                ok: true,
                data: newProfile
            });
        }
        res.json({
            ok: true,
            data
        });
    }));
    /**
     * PUT /api/hugo/profile
     * Update user's cognitive profile
     */
    router.put('/profile', requireAuth, [
        (0, express_validator_1.body)('life_goals').optional().isArray(),
        (0, express_validator_1.body)('fears').optional().isArray(),
        (0, express_validator_1.body)('skill_set').optional().isArray(),
        (0, express_validator_1.body)('core_values').optional().isArray(),
        (0, express_validator_1.body)('life_lessons').optional().isArray(),
        (0, express_validator_1.body)('lifestyle_preferences').optional(),
        (0, express_validator_1.body)('cognitive_profile').optional()
    ], validateRequest, asyncHandler(async (req, res) => {
        const updates = {};
        // Only update fields that were provided
        const fields = [
            'life_goals', 'fears', 'skill_set', 'core_values',
            'life_lessons', 'lifestyle_preferences', 'cognitive_profile'
        ];
        fields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });
        const { data, error } = await supabase
            .from('hugo_user_profiles')
            .upsert({
            user_id: req.keyInfo.userId,
            ...updates
        })
            .select()
            .single();
        if (error) {
            throw error;
        }
        res.json({
            ok: true,
            data
        });
    }));
    /**
     * GET /api/hugo/progress
     * Get user's progress across cognitive domains
     */
    router.get('/progress', requireAuth, [
        (0, express_validator_1.query)('domain').optional().isString()
    ], validateRequest, asyncHandler(async (req, res) => {
        let query = supabase
            .from('hugo_user_progress')
            .select('*')
            .eq('user_id', req.keyInfo.userId)
            .order('timestamp', { ascending: false });
        if (req.query.domain) {
            query = query.eq('domain', req.query.domain);
        }
        const { data, error } = await query;
        if (error) {
            throw error;
        }
        res.json({
            ok: true,
            data
        });
    }));
    /**
     * GET /api/hugo/knowledge
     * Search knowledge base
     */
    router.get('/knowledge', [
        (0, express_validator_1.query)('category').optional().isString(),
        (0, express_validator_1.query)('search').optional().isString(),
        (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 })
    ], validateRequest, asyncHandler(async (req, res) => {
        let query = supabase
            .from('hugo_knowledge_base')
            .select('*')
            .order('created_at', { ascending: false });
        if (req.query.category) {
            query = query.eq('category', req.query.category);
        }
        if (req.query.search) {
            query = query.textSearch('title', req.query.search);
        }
        const limit = parseInt(req.query.limit) || 20;
        query = query.limit(limit);
        const { data, error } = await query;
        if (error) {
            throw error;
        }
        res.json({
            ok: true,
            data
        });
    }));
    return router;
};
exports.createHugoAIRouter = createHugoAIRouter;
exports.default = exports.createHugoAIRouter;
