/**
 * Multi-Tenant API Server
 * Task: T050
 *
 * Main Express application with multi-tenant routing.
 * Registers all API routes and middleware.
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { errorHandler, notFoundHandler, requestTimeout } from './middleware/errorHandler';

// Route imports
import platformAppsRoutes from './routes/platformApps';
import userAppsRoutes from './routes/userApps';
import extractionRoutes from './routes/extraction';
import sessionsRoutes from './routes/sessions';
import insightsRoutes from './routes/insights';
import profilesRoutes from './routes/profiles';
import iceBreakersRoutes from './routes/iceBreakers';
import gdprRoutes from './routes/gdpr';
import eventsRoutes from './routes/events';
import photosRoutes from './routes/photos';
import { realtimeDeliveryService } from './services/realtimeDeliveryService';

/**
 * Create and configure Express application
 */
export const createApp = (): Application => {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    })
  );

  // General middleware
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requestTimeout(30000)); // 30 second timeout

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

  // Event bus and notifications routes (X-App-ID required for schema routing)
  app.use(`${apiPrefix}/events`, eventsRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};

/**
 * Start server
 */
export const startServer = (port: number = 3001): void => {
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
  const port = parseInt(process.env.PORT || '3001');
  startServer(port);
}

export default createApp;
