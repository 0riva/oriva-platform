# Oriva Platform Deployment Guide

**Version**: 1.0.0
**Last Updated**: 2025-09-29
**Owner**: Platform Team
**Task**: T080 - Comprehensive deployment documentation

## Overview

This guide provides complete instructions for deploying the Oriva Platform backend to production, including initial setup, configuration, continuous deployment workflows, and verification procedures.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [First Deployment](#first-deployment)
6. [Continuous Deployment](#continuous-deployment)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Deployment Best Practices](#deployment-best-practices)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Accounts
- [x] GitHub account with repository access
- [x] Vercel account (Pro or Enterprise for production)
- [x] Supabase account (Pro tier for production)
- [x] OpenAI API account
- [x] Anthropic API account
- [x] Sentry account (recommended for error tracking)

### Required Tools
```bash
# Node.js (v20.x or higher)
node --version  # Should be >= 20.0.0

# Vercel CLI
npm install -g vercel
vercel --version

# Supabase CLI (optional, for migrations)
npm install -g supabase

# Git
git --version

# jq (for JSON processing)
brew install jq  # macOS
sudo apt-get install jq  # Linux
```

### Repository Access
```bash
# Clone the repository
git clone https://github.com/0riva/oriva-platform.git
cd oriva-platform

# Verify you're on main branch
git checkout main
git pull origin main
```

## Initial Setup

### 1. Vercel Project Setup

#### Login and Link Project
```bash
# Login to Vercel
vercel login

# Link to project (creates .vercel directory)
vercel link
# Prompts:
# - Set up and link existing project? Yes
# - Which scope? [Select your team/account]
# - Link to existing project? Yes (or create new)
# - What's the project name? oriva-platform
# - In which directory is your code located? ./
```

#### Configure Project Settings
The project is configured via `vercel.json`:
- **Regions**: iad1, sfo1, fra1
- **Runtime**: Node.js 20.x
- **Function timeout**: 10s (default), 30s (chat)
- **Memory**: 1024MB (default), 2048MB (chat)

### 2. Supabase Project Setup

#### Create Production Project
1. Go to https://app.supabase.com
2. Click "New Project"
3. Configure:
   - **Name**: oriva-platform-prod
   - **Region**: us-east-1 (or closest to users)
   - **Database Password**: Generate strong password (save in password manager)
   - **Pricing Plan**: Pro (required for production workloads)

#### Save Connection Details
```bash
# From Supabase Dashboard → Settings → API
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Configure Database Settings
1. **Connection Pooling**:
   - Mode: Transaction
   - Pool size: 20 (will be overridden by DB_POOL_MAX env var)

2. **Performance**:
   - Enable connection pooling
   - Configure query timeout: 10s

### 3. External API Keys

#### OpenAI API
```bash
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...
```

#### Anthropic API
```bash
# Get from: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-...
```

#### Sentry (Optional but Recommended)
```bash
# Get from: https://sentry.io/settings/[org]/projects/[project]/keys/
SENTRY_DSN=https://...@sentry.io/...
```

## Environment Configuration

### Required Environment Variables

See [ENVIRONMENT.md](./ENVIRONMENT.md) for complete reference.

#### Add to Vercel
```bash
# Core Database
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# AI Services
vercel env add OPENAI_API_KEY production
vercel env add ANTHROPIC_API_KEY production

# Error Tracking
vercel env add SENTRY_DSN production

# Connection Pool (T068)
vercel env add DB_POOL_MAX production  # Enter: 20
vercel env add DB_POOL_MIN production  # Enter: 2
vercel env add DB_IDLE_TIMEOUT production  # Enter: 30000
vercel env add DB_CONNECT_TIMEOUT production  # Enter: 5000
vercel env add DB_MAX_RETRIES production  # Enter: 3

# Environment
vercel env add NODE_ENV production  # Enter: production

# Verify all variables are set
vercel env ls
```

#### Local Development (.env)
```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env
```

**⚠️ Security**: Never commit `.env` files. Already in `.gitignore`.

## Database Setup

### 1. Apply Database Schema

#### Via Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy and paste SQL from migration files
4. Execute in order:

**Core Schema**:
```sql
-- From: supabase/migrations/001_initial_schema.sql
-- Execute in SQL Editor
```

**Analytics Views** (T076):
```sql
-- From: supabase/functions/analytics/performance-dashboard.sql
-- Execute in SQL Editor
```

#### Via Supabase CLI (Alternative)
```bash
# Link to project
supabase link --project-ref [your-project-ref]

# Push migrations
supabase db push

# Verify
supabase db diff
```

### 2. Seed Initial Data

```sql
-- Create Hugo Matchmaker app
INSERT INTO apps (id, name, domain, api_key, active, metadata)
VALUES (
  'hugo-matchmaker',
  'Hugo Matchmaker',
  'hugomatchmaker.com',
  gen_random_uuid()::text,  -- Generate secure API key
  true,
  jsonb_build_object(
    'version', '1.0.0',
    'features', jsonb_build_array('chat', 'knowledge', 'analytics')
  )
);

-- Verify
SELECT id, name, domain, active FROM apps;
```

### 3. Configure Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;

-- Example policies
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id);
```

### 4. Create Performance Indexes

```sql
-- Core indexes
CREATE INDEX CONCURRENTLY idx_conversations_user_id ON conversations(user_id);
CREATE INDEX CONCURRENTLY idx_conversations_app_id ON conversations(app_id);
CREATE INDEX CONCURRENTLY idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX CONCURRENTLY idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX CONCURRENTLY idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX CONCURRENTLY idx_messages_role ON messages(role);
CREATE INDEX CONCURRENTLY idx_knowledge_entries_category ON knowledge_entries(category);

-- Vector search index (if using embeddings)
CREATE INDEX idx_knowledge_entries_embedding
  ON knowledge_entries
  USING ivfflat(embedding vector_cosine_ops)
  WITH (lists = 100);
```

## First Deployment

### 1. Pre-Deployment Checklist

- [ ] All environment variables configured in Vercel
- [ ] Database schema applied
- [ ] Initial data seeded
- [ ] RLS policies enabled
- [ ] Performance indexes created
- [ ] Local tests passing: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] TypeScript compiles: `npm run type-check`

### 2. Deploy to Production

```bash
# First production deployment
vercel --prod

# Expected output:
# 🔍  Inspect: https://vercel.com/oriva/oriva-platform/[deployment-id]
# ✅  Production: https://oriva-platform.vercel.app [3s]
```

### 3. Verify Deployment

```bash
# Health check
curl https://oriva-platform.vercel.app/api/health | jq

# Expected response:
{
  "status": "healthy",
  "checks": {
    "database": "healthy",
    "environment": "healthy",
    "alerts": "healthy"
  },
  "metrics": {...}
}

# Test alert endpoint
curl https://oriva-platform.vercel.app/api/alerts?action=status | jq
```

### 4. Configure Custom Domain (Optional)

```bash
# Add custom domain
vercel domains add api.oriva.ai

# Configure DNS (at your DNS provider):
# Type: CNAME
# Name: api
# Value: cname.vercel-dns.com
# TTL: 3600

# Verify domain
vercel domains verify api.oriva.ai

# Set as production domain
vercel alias set oriva-platform.vercel.app api.oriva.ai
```

## Continuous Deployment

### Automatic Deployment Workflow

Deployments are triggered automatically via GitHub Actions when:

1. **Path-Based Triggers** - Changes to:
   - `api/**` - API source code
   - `src/**` - Source code
   - `package*.json` - Dependencies
   - `vercel.json` - Vercel configuration

2. **Branch-Based Triggers**:
   - `main` → Production deployment
   - `develop` → Staging deployment
   - Other branches → Preview deployments

### Skipping Deployments

Use commit message prefixes to skip unnecessary deployments:

```bash
# Documentation changes
git commit -m "docs: Update API documentation [skip-deploy]"

# Maintenance tasks
git commit -m "chore: Update dependencies [skip-deploy]"

# Skip CI entirely
git commit -m "docs: Fix typo [skip ci]"
```

**Auto-skip prefixes**:
- `docs:` - Documentation updates
- `chore:` - Maintenance tasks
- `[skip-deploy]` - Explicit skip
- `[skip ci]` - Skip all CI/CD

### Development Workflow

#### 1. Feature Development
```bash
# Create feature branch (no deployments to production)
git checkout -b feature/new-endpoint
git commit -m "feat: Add new endpoint"
git push origin feature/new-endpoint

# Auto-deploys to preview URL:
# https://oriva-platform-git-feature-new-endpoint-oriva.vercel.app
```

#### 2. Staging Deployment
```bash
# Merge to develop (deploys to staging)
git checkout develop
git merge feature/new-endpoint
git push origin develop

# Auto-deploys to staging domain
```

#### 3. Production Deployment
```bash
# Merge to main (deploys to production)
git checkout main
git merge develop
git push origin main

# Auto-deploys to production domain
# Triggers: Build → Test → Deploy → Verify
```

### Deployment Concurrency

- Only **one deployment per branch** runs at a time
- New deployments wait for current ones to complete
- Prevents duplicate deployments from rapid commits

## Post-Deployment Verification

### 1. Health Checks

```bash
# API health
curl https://api.oriva.ai/api/health | jq

# Alert status
curl https://api.oriva.ai/api/alerts?action=status | jq

# Check all endpoints
bash tests/smoke-test.sh
```

### 2. Monitoring Setup

#### Vercel Analytics
1. Go to Vercel Dashboard → Analytics
2. Verify data flowing in after deployment

#### Sentry
1. Go to Sentry Dashboard
2. Check for deployment event
3. Verify no new errors after deployment

#### Custom Metrics
```bash
# Check metrics are being collected
curl https://api.oriva.ai/api/health | jq .metrics

# Verify:
# - Metrics show recent data
# - No critical alerts
# - Response times within SLO
```

### 3. Load Testing

```bash
# Run smoke test (2 minutes, 5 users)
k6 run \
  --env BASE_URL=https://api.oriva.ai \
  --env APP_ID=hugo-matchmaker \
  tests/load/smoke-test.js

# Expected: < 1% errors, p95 < 1s
```

### 4. Performance Validation

```bash
# Check SLO compliance
curl https://api.oriva.ai/api/health | jq '
  .metrics | {
    chat_p95: .chat_response_time_p95,
    knowledge_avg: .knowledge_search_latency_avg,
    api_p95: .api_response_time_p95
  }
'

# Thresholds:
# - chat_p95 < 1000ms (warning), < 3000ms (critical)
# - knowledge_avg < 500ms
# - api_p95 < 1000ms
```

## Deployment Best Practices

### 1. Batch Related Changes

❌ **Don't**: Make multiple small commits
```bash
git commit -m "feat: Add login endpoint"
git commit -m "feat: Add logout endpoint"
git commit -m "feat: Add session management"
git commit -m "test: Add auth tests"
# Result: 4 deployments
```

✅ **Do**: Batch into single commit
```bash
git commit -m "feat: Complete authentication system

- Add login/logout endpoints
- Add session management
- Add comprehensive tests"
# Result: 1 deployment
```

### 2. Use Feature Branches

```bash
# Work on feature branch (preview deployments only)
git checkout -b feature/user-profile
git commit -m "wip: User profile endpoint"
git commit -m "wip: Add validation"
git commit -m "wip: Add tests"
git push origin feature/user-profile

# Merge to main (1 production deployment)
git checkout main
git merge feature/user-profile
git push origin main
```

### 3. Test Before Deploying

```bash
# Run full test suite
npm test

# Check types
npm run type-check

# Lint
npm run lint

# Security audit
npm audit

# Local smoke test
npm run dev &
sleep 5
curl http://localhost:3000/api/health
```

### 4. Monitor After Deploying

```bash
# Watch deployment logs
vercel logs [deployment-url] --follow

# Monitor metrics
watch -n 10 'curl -s https://api.oriva.ai/api/health | jq .metrics'

# Check for errors
curl https://api.oriva.ai/api/alerts?action=recent | jq
```

### 5. Rollback Plan

Always have a rollback plan before deploying:

```bash
# List recent deployments
vercel ls

# Know your rollback command
vercel rollback [previous-deployment-url]
```

See [ROLLBACK.md](./ROLLBACK.md) for detailed procedures.

## Troubleshooting

### Issue: "Environment Variable Missing"

**Symptoms**: Deployment succeeds but health check fails

**Cause**: Required environment variable not set

**Resolution**:
```bash
# Check environment variables
vercel env ls

# Add missing variable
vercel env add [VARIABLE_NAME] production

# Redeploy
vercel --prod
```

### Issue: Database Connection Fails

**Symptoms**: Health check returns `"database": "unhealthy"`

**Cause**: Invalid Supabase credentials or connection string

**Resolution**:
```bash
# Test connection locally
SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run dev

# Verify environment variables in Vercel
vercel env ls | grep SUPABASE

# Check Supabase project status
# Go to Supabase Dashboard → Settings → API
```

### Issue: "Too Many Connections"

**Symptoms**: Intermittent database errors, slow responses

**Cause**: Connection pool exhausted

**Resolution**:
```bash
# Increase pool size
vercel env add DB_POOL_MAX production  # Enter: 30

# Redeploy
vercel --prod

# Monitor pool metrics
curl https://api.oriva.ai/api/health | jq .checks.database
```

### Issue: High Response Times

**Symptoms**: p95 > 3000ms after deployment

**Causes**:
- Cold starts (first requests after deployment)
- Configuration issue
- Database query regression

**Resolution**:
1. Wait 5 minutes for functions to warm up
2. Run load test to warm all functions:
   ```bash
   k6 run tests/load/smoke-test.js
   ```
3. Check function logs:
   ```bash
   vercel logs [deployment-url]
   ```
4. Review recent code changes for performance regressions

### Issue: CORS Errors

**Symptoms**: Frontend can't access API

**Cause**: CORS headers not configured for origin

**Resolution**:
Update `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://your-frontend-domain.com"
        }
      ]
    }
  ]
}
```

### Issue: Rate Limit Hit (100 deployments/day)

**Symptoms**: Deployment fails with rate limit error

**Cause**: Too many deployments in 24 hours (Vercel free tier limit)

**Resolution**:
1. Wait for limit to reset (shown in error message)
2. Use commit message prefixes to skip unnecessary deployments
3. Batch changes into fewer commits
4. Consider upgrading to Vercel Pro for unlimited deployments

## Rate Limit Management

### Current Limits (Free Tier)
- **Deployments**: 100 per day
- **Function execution**: 100GB-hours per month
- **Bandwidth**: 100GB per month

### Prevention Strategies

1. **Use Skip Flags**:
   ```bash
   git commit -m "docs: Update [skip-deploy]"
   ```

2. **Path Filtering**: Only triggers on code changes (configured in `.github/workflows/ci-cd.yml`)

3. **Feature Branches**: Work on branches, merge once

4. **Batch Commits**: Combine related changes

### Monitoring Usage
```bash
# Check deployment count
vercel ls --limit 100

# View GitHub Actions usage
gh run list --limit 100
```

## Rollback Procedures

### Immediate Rollback
```bash
# List recent deployments
vercel ls

# Rollback to previous
vercel rollback [previous-deployment-url]

# Verify
curl https://api.oriva.ai/api/health
```

### Git-Based Rollback
```bash
# Revert last commit
git revert HEAD
git push origin main

# Auto-deploys reverted code
```

See [ROLLBACK.md](./ROLLBACK.md) for comprehensive rollback procedures.

## Security Checklist

### Pre-Deployment
- [ ] Environment variables encrypted in Vercel
- [ ] Database RLS policies enabled
- [ ] API keys rotated if compromised
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Sentry configured

### Post-Deployment
- [ ] Test authentication flows
- [ ] Verify RLS blocks unauthorized access
- [ ] Test rate limiting
- [ ] Monitor Sentry for security errors
- [ ] Check for unusual API patterns

## Related Documentation

- [Environment Variables Reference](./ENVIRONMENT.md) - Complete environment documentation
- [Rollback Procedures](./ROLLBACK.md) - Detailed rollback guide
- [Monitoring Guide](./MONITORING.md) - Post-deployment monitoring
- [Scaling Guide](./SCALING.md) - Scaling procedures
- [Production Readiness Checklist](./PRODUCTION_READINESS.md) - Pre-launch checklist

## Support

- **Platform Team**: platform@oriva.ai
- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support