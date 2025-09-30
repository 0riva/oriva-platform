# Oriva Platform Rollback Procedures

**Version**: 1.0.0
**Last Updated**: 2025-09-29
**Owner**: Platform Team
**Task**: T083 - Comprehensive rollback documentation

## Overview

This document provides detailed procedures for rolling back deployments, database changes, and configuration updates in the Oriva Platform backend.

## Table of Contents

1. [When to Rollback](#when-to-rollback)
2. [Pre-Rollback Checklist](#pre-rollback-checklist)
3. [Deployment Rollback](#deployment-rollback)
4. [Database Rollback](#database-rollback)
5. [Configuration Rollback](#configuration-rollback)
6. [Emergency Procedures](#emergency-procedures)
7. [Post-Rollback Verification](#post-rollback-verification)
8. [Incident Documentation](#incident-documentation)

## When to Rollback

### Critical Issues (Immediate Rollback)
- **Error rate >10%**: System is failing for significant portion of users
- **Data corruption**: Incorrect data being written to database
- **Security vulnerability**: Exploit discovered in new deployment
- **Complete service outage**: API unavailable for >5 minutes
- **Payment/billing issues**: Users being charged incorrectly

### Major Issues (Rollback within 30 minutes)
- **Error rate 5-10%**: Significant but not critical failure rate
- **Performance degradation**: p95 >5s (2x SLO)
- **Feature completely broken**: Core functionality not working
- **Integration failures**: External API integration broken

### Minor Issues (Consider Rollback)
- **Error rate 1-5%**: Elevated errors but service mostly functional
- **Performance degradation**: p95 >3s (SLO violation)
- **UI bugs**: Visual issues affecting experience
- **Non-critical feature broken**: Minor functionality issue

### DO NOT Rollback For
- **Expected errors**: Known issues with workarounds
- **User-reported bugs**: Single user reports without reproduction
- **Performance within SLO**: Metrics within acceptable range
- **Cosmetic issues**: Non-functional UI issues

## Pre-Rollback Checklist

Before initiating rollback:

- [ ] **Verify the issue** is caused by recent deployment
- [ ] **Check recent commits** that could be cause
- [ ] **Review error logs** in Sentry and Vercel
- [ ] **Confirm with team** if available
- [ ] **Document the issue** (what, when, severity)
- [ ] **Identify target rollback** (which deployment)
- [ ] **Estimate impact** of rollback on users
- [ ] **Check if database migration** was included
- [ ] **Prepare communication** for stakeholders

## Deployment Rollback

### Method 1: Vercel Rollback (Recommended)

**When to use**: Standard deployment rollback, no database changes

**Steps**:

1. **List recent deployments**:
   ```bash
   vercel ls --prod

   # Output shows:
   # [timestamp] [url] [status] [duration]
   ```

2. **Identify target deployment**:
   - Find last known good deployment
   - Note the deployment URL
   - Verify timestamp is before issue appeared

3. **Perform rollback**:
   ```bash
   vercel rollback [deployment-url]

   # Example:
   vercel rollback https://oriva-platform-abc123.vercel.app

   # Prompts for confirmation:
   # Are you sure you want to rollback to [url]? [y/N]
   ```

4. **Monitor rollback**:
   ```bash
   # Watch deployment logs
   vercel logs --follow

   # Expected: Deployment complete in 30-60s
   ```

5. **Verify health**:
   ```bash
   curl https://api.oriva.ai/api/health | jq

   # Check:
   # - status: "healthy"
   # - No critical alerts
   # - Metrics within SLO
   ```

**Rollback Time**: 1-2 minutes

### Method 2: Git Revert + Redeploy

**When to use**: Need to preserve deployment history, multiple commits to revert

**Steps**:

1. **Identify commits to revert**:
   ```bash
   git log --oneline -10

   # Find commit SHA causing issue
   ```

2. **Create revert commit**:
   ```bash
   # Revert single commit
   git revert [commit-sha]

   # Revert multiple commits (oldest to newest)
   git revert [oldest-sha]^..[newest-sha]

   # OR revert to specific commit (caution: loses history)
   git reset --hard [good-commit-sha]
   git push --force origin main  # Only if absolutely necessary
   ```

3. **Push revert**:
   ```bash
   git push origin main

   # Triggers automatic deployment via CI/CD
   ```

4. **Monitor deployment**:
   ```bash
   # Watch GitHub Actions
   gh run watch

   # Or Vercel dashboard
   vercel logs --follow
   ```

5. **Verify deployment**:
   ```bash
   curl https://api.oriva.ai/api/health
   ```

**Rollback Time**: 3-5 minutes

### Method 3: Emergency Alias Swap

**When to use**: Instant rollback needed, service completely down

**Steps**:

1. **Find last good deployment**:
   ```bash
   vercel ls

   # Look for deployments with "READY" status before incident
   ```

2. **Swap production alias**:
   ```bash
   vercel alias set [good-deployment-url] api.oriva.ai

   # Example:
   vercel alias set https://oriva-platform-xyz789.vercel.app api.oriva.ai
   ```

3. **Verify immediately**:
   ```bash
   curl https://api.oriva.ai/api/health
   ```

**Rollback Time**: <30 seconds

**Note**: This is immediate but doesn't fix the main deployment. Follow up with proper rollback.

## Database Rollback

### Scenario 1: Schema Change (Migration)

**High Risk**: Database schema changes are harder to rollback

**Before Rollback**:
- **Assess impact**: Can new code work with old schema?
- **Check data**: Has data been written with new schema?
- **Backup first**: Take database snapshot

**Rollback Steps**:

1. **Take database snapshot** (if not done):
   ```bash
   # Via Supabase Dashboard:
   # Settings → Database → Backups → Create backup
   ```

2. **Prepare rollback migration**:
   ```sql
   -- Example: Rolling back added column
   -- Original migration added:
   -- ALTER TABLE users ADD COLUMN new_field TEXT;

   -- Rollback migration:
   ALTER TABLE users DROP COLUMN new_field;
   ```

3. **Apply rollback migration**:
   ```bash
   # Via Supabase SQL Editor
   # Execute rollback SQL

   # OR via Supabase CLI
   supabase db reset --version [previous-version]
   ```

4. **Rollback application code**:
   ```bash
   vercel rollback [deployment-before-migration]
   ```

5. **Verify database state**:
   ```sql
   -- Check schema
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'users';

   -- Verify data integrity
   SELECT COUNT(*) FROM users WHERE new_field IS NOT NULL;
   ```

**Rollback Time**: 5-15 minutes

**Best Practice**: Use backward-compatible migrations
```sql
-- Good: Additive change (backward compatible)
ALTER TABLE users ADD COLUMN new_field TEXT DEFAULT NULL;

-- Bad: Breaking change (not backward compatible)
ALTER TABLE users DROP COLUMN old_field;
ALTER TABLE users RENAME COLUMN old_field TO new_field;
```

### Scenario 2: Data Migration

**High Risk**: Data changes are often irreversible

**Before Rollback**:
- **Stop writes**: Prevent new data from being modified
- **Assess data loss**: What data will be lost?
- **Communicate**: Inform users of potential data loss

**Rollback Steps**:

1. **Stop writes** (if possible):
   ```bash
   # Update environment to maintenance mode
   vercel env add MAINTENANCE_MODE production
   # Enter: true

   # Redeploy
   vercel --prod
   ```

2. **Restore from backup**:
   ```bash
   # Via Supabase Dashboard:
   # Settings → Database → Backups
   # Select backup from before migration
   # Click "Restore"

   # Warning: This will REPLACE current database
   ```

3. **Verify data restoration**:
   ```sql
   SELECT COUNT(*) FROM [affected_table];
   SELECT * FROM [affected_table] ORDER BY updated_at DESC LIMIT 10;
   ```

4. **Resume writes**:
   ```bash
   vercel env rm MAINTENANCE_MODE production
   vercel --prod
   ```

**Rollback Time**: 15-60 minutes (depends on database size)

**Data Loss**: Potential for data loss between migration and rollback

### Scenario 3: Backward-Compatible Migration

**Low Risk**: New code works with old schema, old code works with new schema

**Strategy**: Rollback application only, keep database changes

**Steps**:

1. **Rollback application**:
   ```bash
   vercel rollback [previous-deployment]
   ```

2. **Verify compatibility**:
   ```bash
   curl https://api.oriva.ai/api/health

   # Old code should work with new schema
   ```

3. **Decision point**:
   - If working: Keep new schema, fix application in next deployment
   - If broken: Rollback schema (follow Scenario 1)

**Rollback Time**: 1-2 minutes

## Configuration Rollback

### Environment Variables

**Scenario**: Changed environment variable causing issues

**Steps**:

1. **Identify problematic variable**:
   ```bash
   vercel env ls
   ```

2. **Check previous value**:
   ```bash
   # View environment history
   # (Manual: check git history of .env.example or documentation)
   ```

3. **Update variable**:
   ```bash
   # Remove current value
   vercel env rm [VARIABLE_NAME] production

   # Add correct value
   vercel env add [VARIABLE_NAME] production
   # Enter correct value
   ```

4. **Redeploy**:
   ```bash
   vercel --prod
   ```

5. **Verify**:
   ```bash
   curl https://api.oriva.ai/api/health | jq .checks.environment
   ```

**Rollback Time**: 2-3 minutes

### vercel.json Configuration

**Scenario**: Changed function configuration (memory, timeout, regions)

**Steps**:

1. **Revert vercel.json**:
   ```bash
   git log -- vercel.json
   git checkout [commit-sha] -- vercel.json
   git commit -m "Rollback vercel.json configuration"
   git push origin main
   ```

2. **Auto-deploy** triggered by git push

3. **Verify**:
   ```bash
   curl https://api.oriva.ai/api/health
   ```

**Rollback Time**: 3-5 minutes

## Emergency Procedures

### Complete Service Outage

**Symptoms**: API completely unavailable, health check fails

**Immediate Actions**:

1. **Verify it's our issue**:
   ```bash
   # Check Vercel status
   curl https://www.vercel-status.com/api/v2/status.json

   # Check Supabase status
   curl https://status.supabase.com/api/v2/status.json
   ```

2. **If our issue, instant rollback**:
   ```bash
   vercel rollback [last-known-good-deployment]
   ```

3. **Verify recovery**:
   ```bash
   curl https://api.oriva.ai/api/health
   ```

4. **Communicate**:
   - Update status page
   - Notify users via email/social
   - Post incident report

**Target Time**: <2 minutes

### Database Connection Failure

**Symptoms**: All requests failing with database errors

**Immediate Actions**:

1. **Check database health**:
   ```bash
   # Supabase Dashboard → Database → Health
   ```

2. **Check connection pool**:
   ```bash
   curl https://api.oriva.ai/api/health | jq .checks.database
   ```

3. **If pool exhausted, scale up**:
   ```bash
   vercel env add DB_POOL_MAX production
   # Enter higher value (e.g., 40)
   vercel --prod
   ```

4. **If database down, check Supabase**:
   - Supabase Dashboard for status
   - Contact Supabase support if needed

**Target Time**: 5-10 minutes

### High Error Rate (>50%)

**Symptoms**: Most requests failing, Sentry flooded

**Immediate Actions**:

1. **Check recent deployments**:
   ```bash
   vercel ls --limit 5
   ```

2. **Rollback immediately**:
   ```bash
   vercel rollback [last-good-deployment]
   ```

3. **Monitor error rate**:
   ```bash
   watch -n 10 'curl -s https://api.oriva.ai/api/health | jq .alerts'
   ```

4. **Review errors in Sentry** for root cause

**Target Time**: 1-2 minutes

## Post-Rollback Verification

### Health Checks

```bash
# 1. API health
curl https://api.oriva.ai/api/health | jq

# Expected: status "healthy", no critical alerts

# 2. Alert status
curl https://api.oriva.ai/api/alerts?action=status | jq

# Expected: No critical or error alerts

# 3. Key endpoints
curl -X POST https://api.oriva.ai/api/v1/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{"message": "test"}'

# Expected: 200 response

# 4. Database connectivity
curl https://api.oriva.ai/api/health | jq .checks.database

# Expected: "healthy"
```

### Monitoring (15 minute window)

```bash
# Watch metrics continuously
watch -n 10 'curl -s https://api.oriva.ai/api/health | jq .metrics'

# Check for:
# - Error rate dropping to <1%
# - Response times returning to SLO (<1s p95)
# - No new critical alerts
```

### Load Test (Optional)

```bash
# Run smoke test to verify under load
k6 run \
  --env BASE_URL=https://api.oriva.ai \
  --env APP_ID=hugo-matchmaker \
  tests/load/smoke-test.js

# Expected: <1% errors, p95 <1s
```

## Incident Documentation

### Immediate (During Rollback)

Create incident ticket with:
- **Time of incident**: When issue first observed
- **Severity**: Critical/Major/Minor
- **Symptoms**: What users experienced
- **Trigger**: What deployment/change caused it
- **Rollback action**: What was rolled back
- **Resolution time**: How long until resolved

### Post-Incident (Within 24 hours)

Create full incident report:

```markdown
# Incident Report: [DATE] - [TITLE]

## Summary
[Brief description of what happened]

## Timeline
- HH:MM - Deployment deployed
- HH:MM - Issue first detected
- HH:MM - Rollback initiated
- HH:MM - Service restored
- HH:MM - Root cause identified

## Impact
- **Users affected**: [number/percentage]
- **Duration**: [minutes]
- **Severity**: [Critical/Major/Minor]
- **Data loss**: [Yes/No, details]

## Root Cause
[Detailed explanation of what caused the issue]

## Resolution
[What was done to resolve]

## Prevention
[What will be done to prevent recurrence]

## Action Items
- [ ] Fix underlying bug
- [ ] Add test coverage
- [ ] Update monitoring
- [ ] Improve deployment process
```

### Lessons Learned (Within 1 week)

Team retrospective covering:
- What went well?
- What went wrong?
- What can be improved?
- Action items with owners and deadlines

## Rollback Decision Matrix

| Condition | Action | Timeline |
|-----------|--------|----------|
| Error rate >50% | Immediate rollback | <1 min |
| Error rate 10-50% | Rollback within 5 min | <5 min |
| Error rate 5-10% | Investigate, rollback if no quick fix | <15 min |
| Error rate 1-5% | Monitor, consider rollback | <30 min |
| Performance 2x SLO | Rollback within 15 min | <15 min |
| Performance 1.5x SLO | Investigate, rollback if needed | <30 min |
| Data corruption | Immediate stop + rollback | <2 min |
| Security issue | Immediate rollback | <1 min |

## Prevention Strategies

### Reduce Need for Rollbacks

1. **Staging environment**: Test all changes in staging first
2. **Feature flags**: Deploy dark, enable gradually
3. **Canary deployments**: Roll out to small percentage first
4. **Automated testing**: Catch issues before production
5. **Backward-compatible changes**: Reduce breaking changes
6. **Database migration best practices**: Additive changes only

### Improve Rollback Capability

1. **Keep deployments small**: Easier to identify issues
2. **Document changes**: Clear commit messages
3. **Monitor closely after deploy**: Catch issues early
4. **Have rollback command ready**: Don't waste time looking up commands
5. **Practice rollbacks**: Run drills quarterly
6. **Automate where possible**: Reduce human error

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment procedures
- [MONITORING.md](./MONITORING.md) - Monitoring and alerting
- [SCALING.md](./SCALING.md) - Scaling procedures
- [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) - Pre-launch checklist

## Support

- **Platform Team**: platform@oriva.ai
- **On-Call**: Use PagerDuty rotation
- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support