# API Health Monitoring System

## Overview

The Oriva Platform API now includes a comprehensive health monitoring system designed to ensure all endpoints and services are functioning correctly in production on Vercel.

## Features

### 1. **Real-time Health Monitoring**
- Track endpoint performance and response times
- Monitor external service dependencies (Database, Auth, Rate Limiting)
- System metrics (Memory, CPU, Request rates)
- Error tracking and success rates per endpoint

### 2. **Multiple Health Check Endpoints**

#### Basic Health Check
```
GET /health
GET /api/v1/health
```
Returns basic health status, timestamp, and uptime.

#### Detailed Health Check
```
GET /api/v1/health/detailed
```
Returns comprehensive health information including:
- Service status (Database, API Key Validation, Rate Limiting, Logging)
- Endpoint health metrics
- System resource usage
- Performance metrics

### 3. **Automated Health Check Script**

A command-line tool for monitoring production API health.

## Usage

### Running Health Checks

#### Check Production (Vercel)
```bash
npm run health:check:prod
```

#### Check Custom URL
```bash
npm run health:check https://your-api-url.vercel.app
```

#### Verbose Mode (Show All Tests)
```bash
npm run health:check:verbose
```

#### Detailed Health Information
```bash
npm run health:check:detailed
```

#### With API Key (for authenticated endpoints)
```bash
API_KEY=ok_live_xxxxx npm run health:check:prod
```

### Command Line Options

```bash
# Full command with all options
node api/monitoring/check-api-health.ts --url=https://api.example.com --key=ok_live_xxx --verbose --detailed

Options:
  --url=<URL>      API base URL (default: from env API_BASE_URL)
  --key=<KEY>      API key for authenticated endpoints
  -v, --verbose    Show all test results (not just failures)
  -d, --detailed   Show detailed health information
  -h, --help       Show help message
```

## Health Check Response Format

### Basic Health Response
```json
{
  "status": "ok",
  "timestamp": "2025-01-26T10:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.4",
  "environment": "production"
}
```

### Detailed Health Response
```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2025-01-26T10:00:00.000Z",
  "uptime": 3600,
  "services": {
    "database": {
      "name": "PostgreSQL (Supabase)",
      "status": "up",
      "responseTime": 45,
      "lastChecked": "2025-01-26T10:00:00.000Z"
    },
    "apiKeyValidation": {
      "name": "API Key Validation",
      "status": "up",
      "responseTime": 2,
      "lastChecked": "2025-01-26T10:00:00.000Z"
    },
    "rateLimiting": {
      "name": "Rate Limiting",
      "status": "up",
      "details": {
        "maxRequests": 1000,
        "windowMs": 900000
      }
    },
    "logging": {
      "name": "Logging (Winston)",
      "status": "up",
      "details": {
        "level": "info",
        "transports": ["console", "file"]
      }
    }
  },
  "endpoints": {
    "GET /api/v1/health": {
      "path": "/api/v1/health",
      "method": "GET",
      "status": "available",
      "lastResponseTime": 10,
      "successRate": 100
    }
  },
  "metrics": {
    "memoryUsage": {
      "rss": 134217728,
      "heapTotal": 67108864,
      "heapUsed": 50331648,
      "external": 2097152
    },
    "requestsPerMinute": 150,
    "averageResponseTime": 125,
    "errorRate": 0.5
  }
}
```

## Monitored Endpoints

The health check system monitors the following critical endpoints:

### Public Endpoints (No Auth)
- `/health` - Basic health check
- `/api/v1/health` - API health status
- `/api/v1/health/detailed` - Comprehensive health metrics

### Authenticated Endpoints
- `/api/v1/auth/profile` - Authentication system
- `/api/v1/user/me` - User service
- `/api/v1/profiles/active` - Profile management
- `/api/v1/profiles/available` - Profile availability
- `/api/v1/groups` - Group management
- `/api/v1/entries` - Entry system
- `/api/v1/developer/apps` - Developer portal
- `/api/v1/analytics/summary` - Analytics service
- `/api/v1/team/members` - Team management

## Status Indicators

### Overall Health Status
- **HEALTHY** ✅ - All critical services operational
- **DEGRADED** ⚠️ - Non-critical services experiencing issues
- **UNHEALTHY** ❌ - Critical services down (e.g., database)

### Service Status
- **up** - Service is operational
- **degraded** - Service is partially functional
- **down** - Service is unavailable

### Endpoint Status
- **available** - Endpoint is responding correctly
- **unavailable** - Endpoint is not responding
- **unknown** - No data available for endpoint

## Continuous Monitoring

### Setting Up Automated Monitoring

1. **GitHub Actions** - Add to your CI/CD pipeline:
```yaml
- name: Check API Health
  run: |
    npm run health:check:prod
    if [ $? -ne 0 ]; then
      echo "API health check failed!"
      exit 1
    fi
```

2. **Cron Job** - Schedule regular checks:
```bash
# Check every 5 minutes
*/5 * * * * cd /path/to/project && npm run health:check:prod >> health.log 2>&1
```

3. **Monitoring Dashboard** - Use the `/api/v1/health/detailed` endpoint with tools like:
   - Datadog
   - New Relic
   - Grafana
   - Custom dashboards

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check Supabase service status
   - Verify environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - Check network connectivity

2. **High Error Rate**
   - Review application logs
   - Check rate limiting configuration
   - Verify API key validation

3. **Memory Issues**
   - Monitor heap usage trends
   - Check for memory leaks
   - Consider scaling if consistently high

4. **Slow Response Times**
   - Check database query performance
   - Review endpoint implementation
   - Consider caching strategies

## Integration with Vercel

The health monitoring system is optimized for Vercel deployment:

1. **Environment Variables** - Set in Vercel dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `API_SECRET_KEY`
   - `RATE_LIMIT_MAX_REQUESTS`

2. **Monitoring** - Access health endpoints directly:
   ```
   https://your-app.vercel.app/api/v1/health
   https://your-app.vercel.app/api/v1/health/detailed
   ```

3. **Alerts** - Configure Vercel monitoring to alert on:
   - 5xx errors from health endpoints
   - Response time > 5 seconds
   - Memory usage > 90%

## Best Practices

1. **Regular Monitoring**
   - Check health at least every 5 minutes in production
   - Use detailed health checks for debugging
   - Monitor trends over time

2. **Alert Thresholds**
   - Critical: Database down, auth service failure
   - Warning: High error rate (>5%), slow response (>1s)
   - Info: Non-critical service degradation

3. **Response Actions**
   - **UNHEALTHY**: Immediate investigation required
   - **DEGRADED**: Schedule investigation within 24 hours
   - **HEALTHY**: Continue normal monitoring

## Development

### Adding New Health Checks

To add monitoring for a new service or endpoint:

1. Update `api/services/health-check.ts`:
```typescript
// Add to checkServices() method
services.newService = await this.checkNewService();

// Add new check method
private async checkNewService(): Promise<ServiceHealth> {
  // Implement service check
  return {
    name: 'New Service',
    status: 'up',
    lastChecked: new Date().toISOString()
  };
}
```

2. Update endpoint list in `api/monitoring/check-api-health.ts`:
```typescript
{
  name: 'New Endpoint',
  path: '/api/v1/new',
  method: 'GET',
  requiresAuth: true,
  expectedStatus: 200,
  critical: false
}
```

### Testing Health Checks

```bash
# Run in development
npm run dev

# In another terminal, run health check
npm run health:check http://localhost:3000

# Test with mock failures
NODE_ENV=test npm run health:check
```

## Support

For issues or questions about the health monitoring system:
1. Check the detailed health endpoint for diagnostic information
2. Review application logs in Vercel dashboard
3. Contact the development team with health check output

---

Last Updated: 2025-01-26
Version: 1.0.0