/**
 * Multi-Tenant API Server
 * Task: T050
 *
 * Main Express application with multi-tenant routing.
 * Registers all API routes and middleware.
 */

// DATADOG APM - Must be initialized before any other imports
if (process.env.DD_API_KEY) {
  require('dd-trace').init({
    service: 'oriva-api-multitenant',
    env: process.env.DD_ENV || process.env.NODE_ENV || 'production',
    version: process.env.DD_VERSION || process.env.API_VERSION || '1.0.0',
    logInjection: true, // Automatically inject trace IDs into logs
    analytics: true, // Enable analytics
    runtimeMetrics: true, // Collect runtime metrics
  });
}

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import {
  errorHandler,
  notFoundHandler,
  requestTimeout,
} from '../src/express/middleware/errorHandler';
import { validateContentType } from '../src/express/middleware/contentTypeValidator';
import { requestIdMiddleware } from '../src/express/middleware/requestId';

// Route imports
import platformAppsRoutes from '../src/express/routes/platformApps';
import userAppsRoutes from '../src/express/routes/userApps';
import extractionRoutes from '../src/express/routes/extraction';
import sessionsRoutes from '../src/express/routes/sessions';
import insightsRoutes from '../src/express/routes/insights';
import profilesRoutes from '../src/express/routes/profiles';
import iceBreakersRoutes from '../src/express/routes/iceBreakers';
import gdprRoutes from '../src/express/routes/gdpr';
import eventsRoutes from '../src/express/routes/events';
import photosRoutes from '../src/express/routes/photos';
import travelHubRoutes from '../src/express/routes/travel-hub';
import hugoLoveRoutes from '../src/express/routes/hugo-love';
import askMeAnythingRoutes from '../src/express/routes/ask-me-anything';
import locationsRoutes from '../src/express/routes/locations';
import { realtimeDeliveryService } from '../src/services/realtimeDeliveryService';

/**
 * Create and configure Express application
 */
export const createApp = (): Application => {
  const app = express();

  // Security middleware
  app.use(helmet());
  // Production origins for CORS
  const productionOrigins = [
    'https://o-originals.vercel.app',
    'https://oriva.io',
    'https://www.oriva.io',
    'https://app.oriva.io',
    'https://o-core.vercel.app',
  ];

  const developmentOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8081',
    'http://localhost:8084',
  ];

  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        ...productionOrigins,
        ...developmentOrigins,
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-App-ID',
        'X-API-Key',
        'X-Request-ID',
        'X-Tenant-ID',
        'X-Profile-ID',
        'X-Client-ID',
        'X-User-ID',
      ],
    })
  );

  // General middleware
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requestTimeout(30000)); // 30 second timeout

  // OBSERVABILITY: Request ID tracking
  app.use(requestIdMiddleware);

  // OBSERVABILITY: API version header
  app.use((req, res, next) => {
    res.setHeader('X-API-Version', process.env.API_VERSION || '1.0.0');
    next();
  });

  // SECURITY: Validate Content-Type headers
  app.use(validateContentType);

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
    });
  });

  // API version prefix
  const apiPrefix = '/api/v1';

  // Platform routes (no X-App-ID required)
  app.use(`${apiPrefix}/platform/apps`, platformAppsRoutes);
  app.use(`${apiPrefix}/platform/users`, userAppsRoutes);
  app.use(`${apiPrefix}/platform/extraction`, extractionRoutes);
  app.use(`${apiPrefix}/platform/users`, gdprRoutes);

  // Hugo AI routes (X-App-ID required for schema routing)
  app.use(`${apiPrefix}/hugo-ai/sessions`, sessionsRoutes);
  app.use(`${apiPrefix}/hugo-ai/insights`, insightsRoutes);

  // App-specific routes (X-App-ID required for schema routing)
  app.use(`${apiPrefix}/apps/profiles`, profilesRoutes);
  app.use(`${apiPrefix}/apps/ice-breakers`, iceBreakersRoutes);
  app.use(`${apiPrefix}/apps/photos`, photosRoutes);

  // ALIAS: /api/v1/profiles -> /api/v1/apps/profiles (for backward compatibility)
  // Frontend clients call orivaApi.get('/profiles/me') which resolves to /api/v1/profiles/me
  app.use(`${apiPrefix}/profiles`, profilesRoutes);

  // Event bus and notifications routes (X-App-ID required for schema routing)
  app.use(`${apiPrefix}/events`, eventsRoutes);

  // Travel Hub routes (X-App-ID required for schema routing)
  app.use(`${apiPrefix}/travel-hub`, travelHubRoutes);

  // Hugo Love routes (dating app - requires authentication)
  app.use(`${apiPrefix}/hugo-love`, hugoLoveRoutes);

  // Ask Me Anything routes (AMA sessions - requires authentication)
  app.use(`${apiPrefix}/ask-me-anything`, askMeAnythingRoutes);

  // Location routes (geocoding, place search - no auth required)
  app.use('/api/locations', locationsRoutes);

  // TENANT ROUTES: Map /api/v1/tenant/{tenant-slug}/* to the appropriate routes
  // This allows o-orig clients in production to call /api/v1/tenant/hugo-love/profiles/discover
  app.use(`${apiPrefix}/tenant/hugo-love`, hugoLoveRoutes);
  app.use(`${apiPrefix}/tenant/ask-me-anything`, askMeAnythingRoutes);
  app.use(`${apiPrefix}/tenant/travel-hub`, travelHubRoutes);

  // DEVELOPMENT PROXY: Map /api/oriva/* to /api/v1/* for o-orig dev mode
  // This allows o-orig apps using buildApiUrl('/profiles/me') to reach /api/v1/hugo-love/profiles/me
  app.use('/api/oriva/hugo-love', hugoLoveRoutes);
  app.use('/api/oriva/ask-me-anything', askMeAnythingRoutes);
  app.use('/api/oriva/apps/photos', photosRoutes);
  app.use('/api/oriva/apps/profiles', profilesRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};

/**
 * Start server
 */
export const startServer = (port: number = 3002): void => {
  const app = createApp();

  // Initialize real-time delivery service
  realtimeDeliveryService.initialize();

  app.listen(port, () => {
    console.log(`🚀 API server running on port ${port}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Multi-tenant mode: enabled`);
    console.log(`📍 API prefix: /api/v1`);
    console.log(`📡 Real-time delivery service initialized`);
  });
};

// Start server if run directly
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3002');
  startServer(port);
}

export default createApp;
