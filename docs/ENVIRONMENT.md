# Oriva Platform Environment Variables Reference

**Version**: 1.0.0
**Last Updated**: 2025-09-29
**Owner**: Platform Team
**Task**: T081 - Complete environment variable documentation

## Overview

This document provides a complete reference for all environment variables used in the Oriva Platform backend, including required vs. optional variables, default values, and configuration examples.

## Table of Contents

1. [Required Variables](#required-variables)
2. [Optional Variables](#optional-variables)
3. [Environment-Specific Configuration](#environment-specific-configuration)
4. [Security Best Practices](#security-best-practices)
5. [Configuration Examples](#configuration-examples)
6. [Validation](#validation)

## Required Variables

### Database (Supabase)

#### `SUPABASE_URL`
- **Description**: Supabase project URL
- **Format**: `https://[project-ref].supabase.co`
- **Required**: Yes
- **Example**: `https://abc123xyz.supabase.co`
- **Where to get**: Supabase Dashboard → Settings → API → Project URL

#### `SUPABASE_ANON_KEY`
- **Description**: Supabase anonymous (public) API key
- **Format**: JWT token (eyJ...)
- **Required**: Yes
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to get**: Supabase Dashboard → Settings → API → anon/public key
- **Security**: Can be exposed to clients (limited permissions)

#### `SUPABASE_SERVICE_ROLE_KEY`
- **Description**: Supabase service role key with admin privileges
- **Format**: JWT token (eyJ...)
- **Required**: Yes
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to get**: Supabase Dashboard → Settings → API → service_role key
- **Security**: **CRITICAL** - Never expose to clients, server-side only

### AI Services

#### `OPENAI_API_KEY`
- **Description**: OpenAI API key for GPT models
- **Format**: `sk-...`
- **Required**: Yes (for chat functionality)
- **Example**: `sk-proj-abc123xyz789`
- **Where to get**: https://platform.openai.com/api-keys
- **Security**: Keep secret, server-side only

#### `ANTHROPIC_API_KEY`
- **Description**: Anthropic API key for Claude models
- **Format**: `sk-ant-...`
- **Required**: Yes (for chat fallback/alternative)
- **Example**: `sk-ant-api03-abc123xyz789`
- **Where to get**: https://console.anthropic.com/settings/keys
- **Security**: Keep secret, server-side only

### Runtime Environment

#### `NODE_ENV`
- **Description**: Node.js environment mode
- **Format**: `development` | `production` | `test`
- **Required**: Yes
- **Default**: `development`
- **Example**: `production`
- **Effect**:
  - Controls error verbosity
  - Affects Sentry reporting
  - Determines logging level

## Optional Variables

### Error Tracking (Sentry)

#### `SENTRY_DSN`
- **Description**: Sentry project DSN for error tracking
- **Format**: `https://[key]@[org].ingest.sentry.io/[project-id]`
- **Required**: No (recommended for production)
- **Example**: `https://abc123@o123456.ingest.sentry.io/789012`
- **Where to get**: Sentry → Settings → Projects → [project] → Client Keys (DSN)
- **Effect**: If not set, errors logged to console only

#### `SENTRY_ENVIRONMENT`
- **Description**: Environment name for Sentry events
- **Format**: String
- **Required**: No
- **Default**: Value from `VERCEL_ENV` or `NODE_ENV`
- **Example**: `production`
- **Effect**: Tags errors by environment in Sentry

#### `SENTRY_RELEASE`
- **Description**: Release version for Sentry tracking
- **Format**: String (semantic version or git SHA)
- **Required**: No
- **Default**: Value from `VERCEL_GIT_COMMIT_SHA`
- **Example**: `v1.0.0` or `abc123def456`
- **Effect**: Associates errors with specific releases

### Database Connection Pool (T068)

#### `DB_POOL_MAX`
- **Description**: Maximum database connections per function instance
- **Format**: Integer (1-100)
- **Required**: No
- **Default**: `20`
- **Example**: `30`
- **Effect**: Higher = more concurrent queries, more database load
- **Recommendation**:
  - Development: 10
  - Production: 20-40 (based on traffic)
  - High traffic: 30-50

#### `DB_POOL_MIN`
- **Description**: Minimum idle connections to maintain
- **Format**: Integer (0-10)
- **Required**: No
- **Default**: `2`
- **Example**: `2`
- **Effect**: Reduces connection setup latency

#### `DB_IDLE_TIMEOUT`
- **Description**: Milliseconds before idle connection is closed
- **Format**: Integer (milliseconds)
- **Required**: No
- **Default**: `30000` (30 seconds)
- **Example**: `60000` (1 minute)
- **Effect**: Lower = more aggressive cleanup, higher = better reuse

#### `DB_CONNECT_TIMEOUT`
- **Description**: Milliseconds to wait for new connection
- **Format**: Integer (milliseconds)
- **Required**: No
- **Default**: `5000` (5 seconds)
- **Example**: `10000` (10 seconds)
- **Effect**: Timeout for initial database connection

#### `DB_MAX_RETRIES`
- **Description**: Maximum connection retry attempts
- **Format**: Integer (0-10)
- **Required**: No
- **Default**: `3`
- **Example**: `5`
- **Effect**: Higher = more resilient to transient failures

### Vercel Platform Variables (Auto-set)

These are automatically set by Vercel and generally don't need manual configuration:

#### `VERCEL_ENV`
- **Description**: Deployment environment
- **Values**: `production` | `preview` | `development`
- **Auto-set**: Yes (by Vercel)
- **Usage**: Determining deployment context

#### `VERCEL_URL`
- **Description**: Deployment URL
- **Format**: `[deployment-id].vercel.app`
- **Auto-set**: Yes (by Vercel)
- **Usage**: Building absolute URLs

#### `VERCEL_GIT_COMMIT_SHA`
- **Description**: Git commit SHA of deployment
- **Format**: 40-character hex string
- **Auto-set**: Yes (by Vercel)
- **Usage**: Release tracking in Sentry

#### `VERCEL_GIT_COMMIT_REF`
- **Description**: Git branch or tag name
- **Format**: String
- **Auto-set**: Yes (by Vercel)
- **Usage**: Branch-specific behavior

## Environment-Specific Configuration

### Development (.env)

```bash
# Local development configuration
NODE_ENV=development

# Database (use development/staging Supabase project)
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI Services (use separate keys with lower rate limits)
OPENAI_API_KEY=sk-dev-...
ANTHROPIC_API_KEY=sk-ant-dev-...

# Error Tracking (optional for local dev)
# SENTRY_DSN=  # Comment out to disable

# Connection Pool (lower limits for local dev)
DB_POOL_MAX=10
DB_POOL_MIN=1
DB_IDLE_TIMEOUT=15000
DB_CONNECT_TIMEOUT=5000
DB_MAX_RETRIES=2
```

### Staging (Vercel Environment)

```bash
# Staging environment - use Vercel CLI to set
NODE_ENV=production  # Use production mode for realistic testing

# Database (staging Supabase project)
SUPABASE_URL=https://staging-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI Services (staging keys with rate limits)
OPENAI_API_KEY=sk-staging-...
ANTHROPIC_API_KEY=sk-ant-staging-...

# Error Tracking (separate Sentry project)
SENTRY_DSN=https://...@sentry.io/staging-project

# Connection Pool (moderate limits)
DB_POOL_MAX=15
DB_POOL_MIN=2
DB_IDLE_TIMEOUT=30000
DB_CONNECT_TIMEOUT=5000
DB_MAX_RETRIES=3
```

### Production (Vercel Environment)

```bash
# Production environment - use Vercel CLI to set
NODE_ENV=production

# Database (production Supabase project)
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI Services (production keys with full rate limits)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Error Tracking (production Sentry project)
SENTRY_DSN=https://...@sentry.io/prod-project

# Connection Pool (production tuned)
DB_POOL_MAX=30
DB_POOL_MIN=2
DB_IDLE_TIMEOUT=30000
DB_CONNECT_TIMEOUT=5000
DB_MAX_RETRIES=3
```

## Security Best Practices

### Secret Management

#### ✅ DO:
- Use Vercel environment variables for all secrets
- Rotate API keys regularly (quarterly minimum)
- Use different API keys for dev/staging/production
- Store secrets in password manager (1Password, LastPass)
- Use `vercel env pull` to sync local .env file
- Enable Vercel Environment Variable Encryption

#### ❌ DON'T:
- Commit .env files to git (.gitignore already excludes them)
- Share API keys in Slack/email
- Use production keys in development
- Hardcode secrets in source code
- Log or console.log secrets
- Store secrets in plain text files

### Key Rotation Procedure

#### When to Rotate:
- Quarterly (routine rotation)
- Immediately if compromised
- When team member leaves
- After security audit

#### How to Rotate:

1. **Generate new keys**:
   - Supabase: Dashboard → Settings → API → Reset
   - OpenAI: Platform → API Keys → Create new
   - Anthropic: Console → Settings → Create new

2. **Update Vercel environment**:
   ```bash
   vercel env rm OPENAI_API_KEY production
   vercel env add OPENAI_API_KEY production
   # Enter new key
   ```

3. **Deploy with new keys**:
   ```bash
   vercel --prod
   ```

4. **Verify functionality**:
   ```bash
   curl https://api.oriva.ai/api/health
   ```

5. **Revoke old keys**:
   - Only after verifying new keys work
   - Delete old keys from provider dashboards

### Access Control

#### Principle of Least Privilege:
- Service role key: Backend only, never exposed
- Anon key: Can be exposed to frontend (limited permissions)
- API keys: Only accessible to functions that need them

#### Vercel Team Permissions:
- Production environment: Admin access only
- Staging environment: Developer access
- Development: Full team access

## Configuration Examples

### Adding Environment Variables

#### Via Vercel CLI (Recommended)
```bash
# Add single variable to production
vercel env add SUPABASE_URL production
# Prompt: Enter value for SUPABASE_URL: https://...

# Add to all environments
vercel env add DB_POOL_MAX
# Prompts: production? Yes, preview? Yes, development? Yes

# Pull environment variables to local .env
vercel env pull .env

# List all environment variables
vercel env ls
```

#### Via Vercel Dashboard
1. Go to Project Settings → Environment Variables
2. Click "Add New"
3. Enter key, value, select environments
4. Click "Save"

### Updating Environment Variables

```bash
# Remove old value
vercel env rm OPENAI_API_KEY production

# Add new value
vercel env add OPENAI_API_KEY production

# Or use dashboard to edit directly
```

### Template .env.example

Create `.env.example` in repository root (safe to commit):

```bash
# Oriva Platform Environment Variables
# Copy to .env and fill in your values

# Database (Supabase)
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Error Tracking (Optional)
SENTRY_DSN=https://...@sentry.io/...

# Connection Pool (Optional, defaults provided)
DB_POOL_MAX=20
DB_POOL_MIN=2
DB_IDLE_TIMEOUT=30000
DB_CONNECT_TIMEOUT=5000
DB_MAX_RETRIES=3

# Environment
NODE_ENV=development
```

## Validation

### Environment Variable Validation

The platform validates critical environment variables on startup:

```typescript
// api/config/validate.ts (example)
export function validateEnvironment(): void {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

### Health Check Validation

The `/api/health` endpoint validates environment:

```bash
curl https://api.oriva.ai/api/health | jq .checks.environment

# Response:
{
  "environment": "healthy"  # All required variables present
}
```

### Pre-Deployment Checklist

```bash
# Check all required variables are set
vercel env ls | grep -E "SUPABASE|OPENAI|ANTHROPIC"

# Should show:
# SUPABASE_URL (production)
# SUPABASE_ANON_KEY (production)
# SUPABASE_SERVICE_ROLE_KEY (production)
# OPENAI_API_KEY (production)
# ANTHROPIC_API_KEY (production)
```

## Troubleshooting

### Issue: "Environment variable not found"

**Cause**: Variable not set in deployment environment

**Resolution**:
```bash
# Check if variable exists
vercel env ls | grep [VARIABLE_NAME]

# Add if missing
vercel env add [VARIABLE_NAME] production
```

### Issue: Health check fails with "environment": "unhealthy"

**Cause**: One or more required variables missing or invalid

**Resolution**:
```bash
# Check health endpoint for details
curl https://api.oriva.ai/api/health | jq

# Verify all required variables
vercel env ls

# Test locally with production variables
vercel env pull .env
npm run dev
curl http://localhost:3000/api/health
```

### Issue: Database connections fail

**Cause**: Invalid Supabase credentials

**Resolution**:
```bash
# Verify Supabase credentials
# Go to Supabase Dashboard → Settings → API
# Copy current values

# Update in Vercel
vercel env rm SUPABASE_URL production
vercel env add SUPABASE_URL production
# Repeat for ANON_KEY and SERVICE_ROLE_KEY

# Redeploy
vercel --prod
```

### Issue: AI requests fail with 401

**Cause**: Invalid or expired API keys

**Resolution**:
```bash
# Test API keys locally
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# If invalid, rotate keys (see Key Rotation Procedure)
```

## Related Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Environment setup during deployment
- [Security Guide](./SECURITY.md) - Security best practices
- [Monitoring Guide](./MONITORING.md) - Monitoring environment health

## Support

- **Platform Team**: platform@oriva.ai
- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support