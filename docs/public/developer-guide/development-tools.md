# Development Tools & Utilities

**Essential tools for Oriva platform development and testing**

## 🛠️ Development Environment Setup

### Required Tools

**Node.js Development:**
```bash
# Install Node.js 18+ and npm
node --version  # Should be 18+
npm --version   # Should be 9+

# Install development dependencies
npm install --save-dev \
  @types/node \
  typescript \
  jest \
  @testing-library/react \
  eslint \
  prettier
```

**HTTPS for Local Development:**
```bash
# Install mkcert for local HTTPS
# macOS
brew install mkcert
mkcert -install
mkcert localhost

# Ubuntu/Debian
sudo apt install libnss3-tools
wget -O mkcert https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v*-linux-amd64
chmod +x mkcert
sudo mv mkcert /usr/local/bin/
mkcert -install
mkcert localhost

# Windows
choco install mkcert
mkcert -install
mkcert localhost
```

### Local Development Server

```javascript
// dev-server.js
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();

// Security headers for development
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "frame-ancestors 'self' https://app.oriva.io",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  next();
});

// Serve static files
app.use(express.static('dist'));

// API proxy for development
app.use('/api/oriva', async (req, res) => {
  try {
    const response = await fetch(`https://api.oriva.io/api/v1${req.path}`, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${process.env.ORIVA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HTTPS server for iframe testing
const options = {
  key: fs.readFileSync('localhost-key.pem'),
  cert: fs.readFileSync('localhost.pem')
};

https.createServer(options, app).listen(3000, () => {
  console.log('Development server running at https://localhost:3000');
});
```

## 🧪 Testing Tools

### API Testing Utility

```javascript
// api-tester.js
class OrivaApiTester {
  constructor(apiKey = process.env.ORIVA_API_KEY) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.oriva.io/api/v1';
    this.results = [];
  }

  async testEndpoint(endpoint, options = {}) {
    const startTime = Date.now();
    const testId = `test_${Date.now()}`;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Oriva-API-Tester/1.0.0',
          ...options.headers
        }
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      const result = {
        id: testId,
        endpoint,
        method: options.method || 'GET',
        status: response.status,
        success: response.ok,
        duration,
        data: response.ok ? data : null,
        error: response.ok ? null : data,
        timestamp: new Date().toISOString()
      };

      this.results.push(result);
      this.logResult(result);

      return result;
    } catch (error) {
      const result = {
        id: testId,
        endpoint,
        method: options.method || 'GET',
        status: 0,
        success: false,
        duration: Date.now() - startTime,
        data: null,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.results.push(result);
      this.logResult(result);

      return result;
    }
  }

  logResult(result) {
    const status = result.success ? '✅' : '❌';
    const duration = `${result.duration}ms`;
    const method = result.method.padEnd(6);

    console.log(`${status} ${method} ${result.endpoint} - ${result.status} (${duration})`);

    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
  }

  async runTestSuite() {
    console.log('🧪 Running Oriva API Test Suite\n');

    const tests = [
      { name: 'User Info', endpoint: '/user/me' },
      { name: 'Available Profiles', endpoint: '/profiles/available' },
      { name: 'User Groups', endpoint: '/groups' },
      { name: 'Marketplace Apps', endpoint: '/marketplace/apps' },
      { name: 'Installed Apps', endpoint: '/marketplace/installed' }
    ];

    for (const test of tests) {
      console.log(`Testing ${test.name}...`);
      await this.testEndpoint(test.endpoint);
    }

    this.generateReport();
  }

  generateReport() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = total - passed;
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / total;

    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    console.log(`⏱️ Average Duration: ${avgDuration.toFixed(0)}ms`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   ${r.method} ${r.endpoint} - ${r.error}`);
        });
    }
  }

  exportResults(filename = 'api-test-results.json') {
    const fs = require('fs');
    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
    console.log(`\n📁 Results exported to ${filename}`);
  }
}

// Usage
const tester = new OrivaApiTester();
tester.runTestSuite();
```

### Response Schema Validator

```javascript
// schema-validator.js
const Joi = require('joi');

const OrivaSchemas = {
  // Base response schema
  baseResponse: Joi.object({
    success: Joi.boolean().required(),
    data: Joi.any().when('success', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    error: Joi.string().when('success', {
      is: false,
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),
    error_code: Joi.string().optional(),
    meta: Joi.object().optional()
  }),

  // User schema
  user: Joi.object({
    id: Joi.string().pattern(/^ext_user_[a-zA-Z0-9]+$/).required(),
    name: Joi.string().min(1).required(),
    email: Joi.string().email().required(),
    avatar: Joi.string().uri().allow(null).optional(),
    created_at: Joi.string().isoDate().required(),
    last_login: Joi.string().isoDate().optional(),
    preferences: Joi.object().optional()
  }),

  // Profile schema
  profile: Joi.object({
    id: Joi.string().pattern(/^ext_profile_[a-zA-Z0-9]+$/).required(),
    name: Joi.string().min(1).required(),
    description: Joi.string().allow('').optional(),
    avatar: Joi.string().uri().allow(null).optional(),
    is_active: Joi.boolean().required(),
    permissions: Joi.array().items(Joi.string()).required(),
    created_at: Joi.string().isoDate().required(),
    member_count: Joi.number().integer().min(0).optional(),
    settings: Joi.object().optional()
  }),

  // Group schema
  group: Joi.object({
    id: Joi.string().pattern(/^ext_group_[a-zA-Z0-9]+$/).required(),
    name: Joi.string().min(1).required(),
    description: Joi.string().allow('').optional(),
    role: Joi.string().valid('member', 'admin', 'owner').required(),
    permissions: Joi.array().items(Joi.string()).required(),
    member_count: Joi.number().integer().min(0).optional(),
    created_at: Joi.string().isoDate().required(),
    settings: Joi.object().optional()
  }),

  // Marketplace app schema
  marketplaceApp: Joi.object({
    id: Joi.string().pattern(/^ext_app_[a-zA-Z0-9]+$/).required(),
    name: Joi.string().min(1).required(),
    description: Joi.string().required(),
    category: Joi.string().required(),
    icon: Joi.string().uri().required(),
    developer: Joi.object({
      name: Joi.string().required(),
      verified: Joi.boolean().required()
    }).required(),
    pricing: Joi.object({
      model: Joi.string().valid('free', 'freemium', 'paid').required(),
      base_price: Joi.number().min(0).required(),
      premium_price: Joi.number().min(0).optional()
    }).required(),
    ratings: Joi.object({
      average: Joi.number().min(0).max(5).required(),
      count: Joi.number().integer().min(0).required()
    }).required(),
    permissions: Joi.array().items(Joi.string()).required(),
    updated_at: Joi.string().isoDate().required()
  })
};

class SchemaValidator {
  static validate(schemaName, data) {
    const schema = OrivaSchemas[schemaName];
    if (!schema) {
      throw new Error(`Unknown schema: ${schemaName}`);
    }

    const { error, value } = schema.validate(data, { allowUnknown: true });

    if (error) {
      throw new Error(`Schema validation failed for ${schemaName}: ${error.message}`);
    }

    return value;
  }

  static validateApiResponse(endpoint, response) {
    // Validate base response structure first
    this.validate('baseResponse', response);

    if (!response.success) {
      return response; // Error responses don't need data validation
    }

    // Validate specific endpoint data
    const endpointMappings = {
      '/user/me': { schema: 'user', dataPath: 'data' },
      '/profiles/available': { schema: 'profile', dataPath: 'data', isArray: true },
      '/groups': { schema: 'group', dataPath: 'data', isArray: true },
      '/marketplace/apps': { schema: 'marketplaceApp', dataPath: 'data', isArray: true },
      '/marketplace/installed': { schema: 'marketplaceApp', dataPath: 'data', isArray: true }
    };

    const mapping = endpointMappings[endpoint];
    if (mapping) {
      const data = response[mapping.dataPath];

      if (mapping.isArray) {
        if (!Array.isArray(data)) {
          throw new Error(`Expected array for ${endpoint} data`);
        }
        data.forEach((item, index) => {
          try {
            this.validate(mapping.schema, item);
          } catch (error) {
            throw new Error(`Validation failed for ${endpoint}[${index}]: ${error.message}`);
          }
        });
      } else {
        this.validate(mapping.schema, data);
      }
    }

    return response;
  }
}

module.exports = { OrivaSchemas, SchemaValidator };
```

## 🔍 Debugging Tools

### API Call Logger

```javascript
// api-logger.js
class ApiLogger {
  constructor(logLevel = 'info') {
    this.logLevel = logLevel;
    this.logs = [];
  }

  createProxyClient(baseClient) {
    return new Proxy(baseClient, {
      get: (target, prop) => {
        if (typeof target[prop] === 'function' && prop === 'request') {
          return async (...args) => {
            const requestId = this.generateId();
            const startTime = Date.now();

            this.logRequest(requestId, args);

            try {
              const result = await target[prop].apply(target, args);
              this.logResponse(requestId, result, Date.now() - startTime);
              return result;
            } catch (error) {
              this.logError(requestId, error, Date.now() - startTime);
              throw error;
            }
          };
        }
        return target[prop];
      }
    });
  }

  logRequest(requestId, args) {
    const [endpoint, options = {}] = args;

    const logEntry = {
      id: requestId,
      type: 'request',
      timestamp: new Date().toISOString(),
      endpoint,
      method: options.method || 'GET',
      headers: this.sanitizeHeaders(options.headers),
      body: options.body ? JSON.parse(options.body) : null
    };

    this.logs.push(logEntry);

    if (this.logLevel === 'debug') {
      console.log('📤 API Request:', logEntry);
    }
  }

  logResponse(requestId, response, duration) {
    const logEntry = {
      id: requestId,
      type: 'response',
      timestamp: new Date().toISOString(),
      duration,
      status: response.success ? 'success' : 'error',
      dataSize: JSON.stringify(response).length
    };

    this.logs.push(logEntry);

    if (this.logLevel === 'debug') {
      console.log('📥 API Response:', logEntry);
    }
  }

  logError(requestId, error, duration) {
    const logEntry = {
      id: requestId,
      type: 'error',
      timestamp: new Date().toISOString(),
      duration,
      error: error.message,
      stack: error.stack
    };

    this.logs.push(logEntry);
    console.error('❌ API Error:', logEntry);
  }

  sanitizeHeaders(headers = {}) {
    const sanitized = { ...headers };
    if (sanitized.Authorization) {
      sanitized.Authorization = 'Bearer ***[REDACTED]***';
    }
    return sanitized;
  }

  generateId() {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  exportLogs(filename = 'api-logs.json') {
    const fs = require('fs');
    fs.writeFileSync(filename, JSON.stringify(this.logs, null, 2));
    console.log(`📁 Logs exported to ${filename}`);
  }

  getStats() {
    const requests = this.logs.filter(log => log.type === 'request');
    const responses = this.logs.filter(log => log.type === 'response');
    const errors = this.logs.filter(log => log.type === 'error');

    const avgDuration = responses.length > 0
      ? responses.reduce((sum, log) => sum + log.duration, 0) / responses.length
      : 0;

    return {
      totalRequests: requests.length,
      successfulResponses: responses.filter(log => log.status === 'success').length,
      errors: errors.length,
      averageDuration: Math.round(avgDuration),
      errorRate: requests.length > 0 ? (errors.length / requests.length * 100).toFixed(1) : 0
    };
  }
}

module.exports = { ApiLogger };
```

### Performance Monitor

```javascript
// performance-monitor.js
class PerformanceMonitor {
  constructor() {
    this.metrics = [];
    this.thresholds = {
      slow_request: 2000,    // 2 seconds
      very_slow_request: 5000, // 5 seconds
      high_error_rate: 0.05   // 5%
    };
  }

  recordMetric(endpoint, duration, success, error = null) {
    const metric = {
      timestamp: Date.now(),
      endpoint,
      duration,
      success,
      error: error?.message || null
    };

    this.metrics.push(metric);

    // Alert on slow requests
    if (duration > this.thresholds.very_slow_request) {
      console.warn(`🐌 Very slow request: ${endpoint} took ${duration}ms`);
    } else if (duration > this.thresholds.slow_request) {
      console.warn(`⏱️ Slow request: ${endpoint} took ${duration}ms`);
    }

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
  }

  getEndpointStats(endpoint) {
    const endpointMetrics = this.metrics.filter(m => m.endpoint === endpoint);

    if (endpointMetrics.length === 0) {
      return null;
    }

    const durations = endpointMetrics.map(m => m.duration);
    const errors = endpointMetrics.filter(m => !m.success);

    return {
      endpoint,
      totalRequests: endpointMetrics.length,
      errorCount: errors.length,
      errorRate: (errors.length / endpointMetrics.length * 100).toFixed(1),
      avgDuration: Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p95Duration: this.percentile(durations, 0.95),
      p99Duration: this.percentile(durations, 0.99)
    };
  }

  getAllStats() {
    const endpoints = [...new Set(this.metrics.map(m => m.endpoint))];
    return endpoints.map(endpoint => this.getEndpointStats(endpoint));
  }

  percentile(arr, p) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }

  checkHealthStatus() {
    const recentMetrics = this.metrics.filter(
      m => Date.now() - m.timestamp < 300000 // Last 5 minutes
    );

    if (recentMetrics.length === 0) {
      return { status: 'unknown', message: 'No recent metrics' };
    }

    const errorRate = recentMetrics.filter(m => !m.success).length / recentMetrics.length;
    const avgDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;

    if (errorRate > this.thresholds.high_error_rate) {
      return {
        status: 'unhealthy',
        message: `High error rate: ${(errorRate * 100).toFixed(1)}%`
      };
    }

    if (avgDuration > this.thresholds.very_slow_request) {
      return {
        status: 'degraded',
        message: `Very slow responses: ${Math.round(avgDuration)}ms avg`
      };
    }

    if (avgDuration > this.thresholds.slow_request) {
      return {
        status: 'degraded',
        message: `Slow responses: ${Math.round(avgDuration)}ms avg`
      };
    }

    return { status: 'healthy', message: 'All systems normal' };
  }

  generateReport() {
    const stats = this.getAllStats();
    const health = this.checkHealthStatus();

    console.log('\n📊 Performance Report');
    console.log('====================');
    console.log(`Health Status: ${health.status.toUpperCase()} - ${health.message}`);
    console.log('');

    stats.forEach(stat => {
      console.log(`📍 ${stat.endpoint}`);
      console.log(`   Requests: ${stat.totalRequests}`);
      console.log(`   Error Rate: ${stat.errorRate}%`);
      console.log(`   Avg Duration: ${stat.avgDuration}ms`);
      console.log(`   P95 Duration: ${Math.round(stat.p95Duration)}ms`);
      console.log(`   P99 Duration: ${Math.round(stat.p99Duration)}ms`);
      console.log('');
    });
  }
}

module.exports = { PerformanceMonitor };
```

## 🚀 Development Scripts

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "node dev-server.js",
    "dev:https": "node dev-server.js --https",
    "test:api": "node tools/api-tester.js",
    "test:schema": "node tools/schema-validator.js",
    "test:performance": "node tools/performance-monitor.js",
    "validate:manifest": "node tools/validate-manifest.js",
    "analyze:bundle": "webpack-bundle-analyzer dist/static/js/*.js",
    "lighthouse": "lighthouse https://localhost:3000 --chrome-flags='--headless'",
    "security:scan": "npm audit && node tools/security-scanner.js",
    "pre-deploy": "npm run test:api && npm run validate:manifest && npm run lighthouse"
  }
}
```

### Manifest Validator

```javascript
// validate-manifest.js
const Joi = require('joi');
const fs = require('fs');

const manifestSchema = Joi.object({
  id: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).required(),
  name: Joi.string().min(1).max(50).required(),
  version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(),
  description: Joi.string().min(1).max(200).required(),
  execution_url: Joi.string().uri({ scheme: ['https'] }).required(),
  icon_url: Joi.string().uri({ scheme: ['https'] }).required(),
  permissions: Joi.array().items(
    Joi.string().valid(
      'read:profiles',
      'read:groups',
      'read:marketplace',
      'write:preferences'
    )
  ).min(1).required(),
  developer: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    support_url: Joi.string().uri().required()
  }).required(),
  display_config: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'auto').default('auto'),
    responsive: Joi.boolean().default(true),
    min_width: Joi.number().integer().min(320).default(320),
    min_height: Joi.number().integer().min(480).default(480),
    max_width: Joi.number().integer().min(Joi.ref('min_width')).optional(),
    supports_mobile: Joi.boolean().default(true),
    iframe_options: Joi.object({
      allow_popups: Joi.boolean().default(false),
      allow_downloads: Joi.boolean().default(false),
      sandbox: Joi.string().default('allow-scripts allow-same-origin allow-forms'),
      referrer_policy: Joi.string().default('strict-origin-when-cross-origin')
    }).optional()
  }).optional()
});

function validateManifest(manifestPath = './manifest.json') {
  try {
    if (!fs.existsSync(manifestPath)) {
      console.error('❌ Manifest file not found:', manifestPath);
      process.exit(1);
    }

    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    const { error, value } = manifestSchema.validate(manifest, {
      allowUnknown: false,
      abortEarly: false
    });

    if (error) {
      console.error('❌ Manifest validation failed:');
      error.details.forEach(detail => {
        console.error(`   ${detail.path.join('.')}: ${detail.message}`);
      });
      process.exit(1);
    }

    console.log('✅ Manifest validation passed');

    // Additional checks
    checkSecuritySettings(value);
    checkPerformanceSettings(value);

    return value;
  } catch (error) {
    console.error('❌ Error validating manifest:', error.message);
    process.exit(1);
  }
}

function checkSecuritySettings(manifest) {
  const warnings = [];

  if (manifest.display_config?.iframe_options?.allow_popups) {
    warnings.push('⚠️ Warning: allow_popups is enabled (security risk)');
  }

  if (manifest.display_config?.iframe_options?.allow_downloads) {
    warnings.push('⚠️ Warning: allow_downloads is enabled (security risk)');
  }

  if (!manifest.execution_url.startsWith('https://')) {
    warnings.push('❌ Error: execution_url must use HTTPS');
  }

  if (!manifest.icon_url.startsWith('https://')) {
    warnings.push('❌ Error: icon_url must use HTTPS');
  }

  warnings.forEach(warning => console.log(warning));
}

function checkPerformanceSettings(manifest) {
  const recommendations = [];

  if (manifest.display_config?.min_width < 320) {
    recommendations.push('📱 Recommendation: min_width should be at least 320px for mobile compatibility');
  }

  if (manifest.display_config?.min_height < 480) {
    recommendations.push('📱 Recommendation: min_height should be at least 480px for mobile compatibility');
  }

  if (!manifest.display_config?.responsive) {
    recommendations.push('📱 Recommendation: Enable responsive design for better user experience');
  }

  recommendations.forEach(rec => console.log(rec));
}

// Run validation if called directly
if (require.main === module) {
  validateManifest();
}

module.exports = { validateManifest, manifestSchema };
```

## 📚 Usage Examples

### Basic Development Setup

```bash
# 1. Clone your app repository
git clone https://github.com/your-org/your-oriva-app.git
cd your-oriva-app

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys

# 4. Generate local HTTPS certificates
mkcert localhost
mv localhost.pem localhost-cert.pem
mv localhost-key.pem localhost-key.pem

# 5. Start development server
npm run dev:https

# 6. Test your app
npm run test:api
npm run validate:manifest
```

### Testing Workflow

```bash
# Test API integration
npm run test:api

# Validate response schemas
npm run test:schema

# Check performance
npm run test:performance

# Validate app manifest
npm run validate:manifest

# Run security scan
npm run security:scan

# Performance audit
npm run lighthouse

# Pre-deployment checks
npm run pre-deploy
```

---

## 📞 Support & Resources

### Getting Help
- [API Troubleshooting Guide](./api-troubleshooting-guide.md) - Debug API issues
- [Security Warning](./SECURITY-WARNING.md) - Critical security information
- **GitHub Issues**: Technical support and bug reports
- **GitHub Discussions**: Questions and community support

### Additional Tools
- [Postman Collection](https://example.com/postman) - Ready-to-use API testing collection
- [Browser Extensions](https://example.com/extensions) - Development helper extensions
- [VS Code Extension](https://example.com/vscode) - Oriva development tools for VS Code

---

**Note**: These tools are designed to work with the secure development patterns outlined in our documentation. Always follow security best practices when developing Oriva platform integrations.

*Last Updated: January 2025*