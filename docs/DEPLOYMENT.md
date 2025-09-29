# Deployment Guidelines

## Overview

This document outlines best practices for deploying to avoid hitting Vercel's free tier rate limits (100 deployments/day).

## Automatic Deployment Triggers

Deployments are triggered automatically on:

1. **Path-Based Triggers** - Only when these paths change:
   - `api/**` - API source code
   - `src/**` - Source code
   - `package*.json` - Dependencies
   - `vercel.json` - Vercel configuration
   - `.github/workflows/ci-cd.yml` - CI/CD configuration

2. **Branch-Based Triggers**:
   - `main` → Production deployment
   - `develop` → Staging deployment

## Skipping Deployments

To avoid unnecessary deployments, use these commit message prefixes:

### Documentation Changes
```bash
git commit -m "docs: Update API documentation [skip-deploy]"
```

### Chore/Maintenance Tasks
```bash
git commit -m "chore: Update dependencies [skip-deploy]"
```

### Skip CI Entirely
```bash
git commit -m "docs: Fix typo [skip ci]"
```

## Commit Message Prefixes

The following prefixes will **automatically skip deployment**:

- `docs:` - Documentation updates
- `chore:` - Maintenance tasks
- `[skip-deploy]` - Explicit skip
- `[skip ci]` - Skip all CI/CD

## Rate Limit Prevention

### Concurrency Control
- Only one deployment can run at a time per branch
- New deployments will wait for current ones to complete
- Prevents duplicate deployments from rapid commits

### Path Filtering
- Changes to documentation, tests, or config files won't trigger deployments
- Only meaningful code changes trigger deployments

### Best Practices

1. **Batch Related Changes**
   ```bash
   # Instead of 5 commits with 5 deployments:
   git commit -m "feat: Add user authentication"
   git commit -m "feat: Add login endpoint"
   git commit -m "feat: Add logout endpoint"
   git commit -m "feat: Add session management"
   git commit -m "test: Add auth tests"

   # Do this (1 deployment):
   git commit -m "feat: Complete user authentication system

   - Add login/logout endpoints
   - Add session management
   - Add comprehensive tests"
   ```

2. **Use Feature Branches**
   ```bash
   # Work on feature branch (no deployments)
   git checkout -b feature/new-auth
   git commit -m "Work in progress"
   git commit -m "More changes"
   git commit -m "Final touches"

   # Merge to main (1 deployment)
   git checkout main
   git merge feature/new-auth
   ```

3. **Documentation Updates**
   ```bash
   # Skip deployment for docs
   git commit -m "docs: Update README [skip-deploy]"
   ```

4. **Quick Fixes**
   ```bash
   # Use chore prefix for maintenance
   git commit -m "chore: Fix linting issues [skip-deploy]"
   ```

## Manual Deployment

If you need to deploy manually:

```bash
# Deploy to production (respects rate limits)
npx vercel --prod

# Deploy to preview
npx vercel
```

## Monitoring Deployments

Check deployment status:

```bash
# List recent deployments
npx vercel list

# Check specific deployment logs
npx vercel logs <deployment-url>

# View GitHub Actions
gh run list --limit 5
```

## Rate Limit Recovery

If you hit the rate limit (100 deployments/day):

1. Wait for the limit to reset (shown in error message)
2. Check current deployment is working:
   ```bash
   curl https://your-deployment.vercel.app/api/v1/health
   ```
3. Review recent commits to identify unnecessary deployments
4. Plan changes to avoid future rate limits

## Current Deployment URLs

- **Production**: Check latest successful deployment with `npx vercel list --prod`
- **Staging**: Deployed from `develop` branch
- **GitHub Pages**: https://0riva.github.io/oriva-platform/

## Emergency Procedures

If deployments are failing:

1. Check GitHub Actions: `gh run list --limit 5`
2. Check Vercel status: `npx vercel list --prod`
3. View logs: `gh run view <run-id> --log-failed`
4. If rate limited, wait for reset
5. If build errors, check API tests locally: `npm test`

## Deployment Checklist

Before deploying to production:

- [ ] All tests pass locally: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] TypeScript compiles: `npm run type-check`
- [ ] Security audit clean: `npm audit`
- [ ] Changes tested in development
- [ ] Documentation updated if needed
- [ ] Commit message follows conventions

## Questions?

See [GitHub Actions](.github/workflows/ci-cd.yml) for current CI/CD configuration.