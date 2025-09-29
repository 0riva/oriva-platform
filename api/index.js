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