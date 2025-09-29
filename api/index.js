/**
 * ORIVA PLATFORM API - STANDALONE BUNDLED VERSION
 * Generated from TypeScript compilation with all dependencies inlined
 * This is a serverless-optimized single-file version for Vercel deployment
 */

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = exports.handler = exports.app = void 0;

// External dependencies
const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
const rateLimit = require("express-rate-limit");
const { validationResult, body, param, query } = require("express-validator");
const winston = require("winston");

// Load environment configuration
dotenv.config();

// ==== INLINED DEPENDENCIES ====

// types/database/entities.js
const AUDIENCE_TYPES = [
    'public',
    'private',
    'followers',
    'groups',
    'draft'
];

// types/errors/index.js
const createApiError = (error) => ({
    code: error.code,
    message: error.message,
    details: error.details,
    status: error.status,
    cause: error.cause
});

const toErrorResponse = (error) => {
    const response = {
        ok: false,
        success: false,
        error: error.message,
        message: error.message,
        code: error.code
    };
    if (error.code === 'VALIDATION_ERROR' ||
        (error.details && error.details.length > 0 &&
            (error.code === 'AUTH_REQUIRED' ||
                error.code === 'INVALID_API_KEY' ||
                error.code === 'UNAUTHORIZED'))) {
        response.details = error.details;
    }
    return response;
};

const createValidationError = (message, details = [], fieldErrors) => ({
    code: 'VALIDATION_ERROR',
    message,
    details,
    fieldErrors,
    status: 400
});

const createAuthError = (code, message, details = []) => ({
    code,
    message,
    details,
    status: code === 'UNAUTHORIZED' ? 403 : 401
});

const createDatabaseError = (message, details = []) => ({
    code: 'DATABASE_ERROR',
    message,
    details,
    status: 500
});

// middleware/auth.js - API Key Authentication
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
        return res.status(401).json(toErrorResponse(createAuthError('AUTH_REQUIRED', 'API key is required', ['Provide API key in X-API-Key header'])));
    }

    // Validate API key format (simple validation)
    if (!apiKey || apiKey.length < 20) {
        return res.status(401).json(toErrorResponse(createAuthError('INVALID_API_KEY', 'Invalid API key format')));
    }

    // Store API key for logging/tracking
    req.apiKey = apiKey;
    next();
};

// middleware/error-handler.js - Global Error Handler
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Handle validation errors
    if (err.code === 'VALIDATION_ERROR') {
        return res.status(err.status || 400).json(toErrorResponse(err));
    }

    // Handle database errors
    if (err.code === 'DATABASE_ERROR') {
        return res.status(err.status || 500).json(toErrorResponse(err));
    }

    // Handle auth errors
    if (err.code && err.code.includes('AUTH')) {
        return res.status(err.status || 401).json(toErrorResponse(err));
    }

    // Default error
    const defaultError = createApiError({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        status: 500
    });

    res.status(500).json(toErrorResponse(defaultError));
};

// services/health-check.js - Health Check Service
const performHealthCheck = async () => {
    const checks = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        api: { status: 'up' },
        database: { status: 'unknown' }
    };

    try {
        // Test database connectivity if configured
        if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            await supabase.from('profiles').select('count').limit(1);
            checks.database = { status: 'connected' };
        }
    } catch (error) {
        checks.database = { status: 'error', message: error.message };
        checks.status = 'degraded';
    }

    return checks;
};

// ==== MAIN APPLICATION ====

const webcrypto = globalThis.crypto ?? crypto.webcrypto;
const app = express();

// Production logging setup
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Middleware setup
app.use(limiter);
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    logger.info('Request received', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});

// ==== BASIC ROUTES ====

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const healthData = await performHealthCheck();
        res.json(healthData);
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Oriva Platform API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/health',
            hugo_ai: '/api/hugo-ai/*'
        }
    });
});

// ==== HUGO AI ENDPOINTS ====

// Initialize Supabase client
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Hugo AI Chat endpoint
app.post('/api/hugo-ai/chat', validateApiKey, [
    body('message').notEmpty().withMessage('Message is required'),
    body('userId').optional().isString(),
    body('sessionId').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(toErrorResponse(createValidationError(
                'Invalid request data',
                errors.array()
            )));
        }

        const { message, userId, sessionId } = req.body;

        // Mock Hugo AI response for now
        const response = {
            id: crypto.randomUUID(),
            message: `Hugo AI Response to: "${message}"`,
            timestamp: new Date().toISOString(),
            userId,
            sessionId,
            metadata: {
                type: 'coaching_response',
                confidence: 0.95
            }
        };

        res.json({
            ok: true,
            success: true,
            data: response
        });
    } catch (error) {
        logger.error('Hugo AI chat error:', error);
        next(error);
    }
});

// Hugo AI Sessions endpoint
app.get('/api/hugo-ai/sessions', validateApiKey, [
    query('userId').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(toErrorResponse(createValidationError(
                'Invalid query parameters',
                errors.array()
            )));
        }

        // Mock sessions data
        const sessions = [
            {
                id: crypto.randomUUID(),
                userId: req.query.userId || 'anonymous',
                title: 'Dating Confidence Session',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                message_count: 12
            }
        ];

        res.json({
            ok: true,
            success: true,
            data: sessions,
            pagination: {
                total: sessions.length,
                limit: parseInt(req.query.limit) || 20,
                offset: 0
            }
        });
    } catch (error) {
        logger.error('Hugo AI sessions error:', error);
        next(error);
    }
});

// Hugo AI User Management
app.post('/api/hugo-ai/users', validateApiKey, [
    body('email').isEmail().withMessage('Valid email is required'),
    body('profile').optional().isObject()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(toErrorResponse(createValidationError(
                'Invalid user data',
                errors.array()
            )));
        }

        const { email, profile } = req.body;

        const user = {
            id: crypto.randomUUID(),
            email,
            profile: profile || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: 'active'
        };

        res.json({
            ok: true,
            success: true,
            data: user
        });
    } catch (error) {
        logger.error('Hugo AI user creation error:', error);
        next(error);
    }
});

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        ok: false,
        success: false,
        error: 'Endpoint not found',
        message: `Cannot ${req.method} ${req.path}`,
        code: 'NOT_FOUND'
    });
});

// Server startup
const startServer = (port = 3000) => {
    return app.listen(port, () => {
        logger.info(`Oriva Platform API server running on port ${port}`);
        logger.info('Environment:', process.env.NODE_ENV || 'development');
    });
};

// Serverless handler for Vercel
const handler = (req, res) => app(req, res);

// Exports
exports.app = app;
exports.handler = handler;
exports.startServer = startServer;

// Export as default for Vercel
module.exports = handler;
module.exports.default = handler;