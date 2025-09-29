/**
 * JavaScript Entry Point - Simplified Vercel Deployment Version
 *
 * This is a simplified JavaScript implementation created for Vercel deployment:
 * - Basic Express server with core endpoints
 * - No TypeScript compilation issues
 * - No complex dependency resolution problems
 * - Minimal but functional API for testing deployment
 *
 * WHY THIS EXISTS ALONGSIDE index.ts:
 * After trying to deploy the full TypeScript version, we discovered:
 * 1. Vercel serverless struggles with TypeScript compilation
 * 2. OpenAI module resolution issues in serverless environment
 * 3. 60+ TypeScript strict mode compilation errors
 * 4. Complex dependency trees causing deployment failures
 *
 * LESSON LEARNED:
 * "Sometimes the simplest solution really is the best one!"
 * We went full circle: TypeScript → compilation fixes → more fixes → JavaScript works immediately 🤦‍♂️
 *
 * CURRENT STRATEGY:
 * - Use this file (index.js) for Vercel deployment
 * - Keep index.ts for local development with full features
 * - Gradually migrate back to TypeScript once deployment is stable
 *
 * ENDPOINTS PROVIDED:
 * - GET /api/health - Basic health check
 * - GET /api/hugo/debug - Debug information
 * - GET /api/hugo/knowledge - Mock knowledge base (no auth required)
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Simple debug endpoint
app.get('/api/hugo/debug', (req, res) => {
  res.json({
    ok: true,
    message: 'Hugo AI router is working!',
    timestamp: new Date().toISOString(),
    path: req.path,
    originalUrl: req.originalUrl
  });
});

// Knowledge endpoint that doesn't require auth
app.get('/api/hugo/knowledge', (req, res) => {
  // Mock knowledge response
  res.json({
    ok: true,
    data: [
      {
        id: 1,
        title: 'The Intimacy Code Introduction',
        category: 'fundamentals',
        content: 'Understanding the basics of meaningful connection...',
        created_at: new Date().toISOString()
      }
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    ok: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;