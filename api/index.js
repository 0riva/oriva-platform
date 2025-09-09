const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Key validation middleware
const validateApiKey = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'API key required'
    });
  }
  
  const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  // Basic validation - check format
  if (!apiKey.startsWith('oriva_pk_live_') && !apiKey.startsWith('oriva_pk_test_')) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key format'
    });
  }
  
  // For now, accept any key with correct format
  // TODO: Implement proper key validation against database
  req.apiKey = apiKey;
  next();
};

// Health endpoint (no auth required)
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// User endpoints
app.get('/api/v1/user/me', validateApiKey, (req, res) => {
  res.json({
    success: true,
    data: {
      id: 'user_123',
      username: 'testuser',
      displayName: 'Test User',
      email: 'test@example.com',
      bio: 'Test user bio',
      location: 'Test Location',
      website: 'https://example.com',
      avatar: 'https://example.com/avatar.jpg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });
});

// Entries endpoints
app.get('/api/v1/entries', validateApiKey, (req, res) => {
  res.json({
    success: true,
    data: [],
    meta: {
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      }
    }
  });
});

// Templates endpoints
app.get('/api/v1/templates', validateApiKey, (req, res) => {
  res.json({
    success: true,
    data: [],
    meta: {
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      }
    }
  });
});

// Storage endpoints
app.get('/api/v1/storage', validateApiKey, (req, res) => {
  res.json({
    success: true,
    data: {}
  });
});

// UI endpoints
app.post('/api/v1/ui/notifications', validateApiKey, (req, res) => {
  res.json({
    success: true,
    data: {
      id: 'notification_123'
    }
  });
});

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Export for Vercel
module.exports = app;

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });
}
