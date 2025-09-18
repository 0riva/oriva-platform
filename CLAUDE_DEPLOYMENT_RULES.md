# Claude Code Deployment Rules for Oriva Platform

## Critical Deployment Rule

**NEVER use `vercel --prod` or `vercel deploy` commands directly.**

## Correct Deployment Process

1. **Make Changes**: Edit code locally
2. **Test Locally**: Verify changes work with `cd api && node index.js`
3. **Commit to Git**: `git add .` and `git commit -m "description"`
4. **Push to GitHub**: `git push origin main`
5. **Auto-Deploy**: GitHub Actions automatically deploys to Vercel production

## Why This Rule Exists

- GitHub Actions handle proper environment variables
- Deployment history is tracked in Git
- CI/CD pipeline includes validation and testing
- Production domain mapping is handled correctly
- Team collaboration requires Git-based deployments

## GitHub Actions Workflow

The repository has configured GitHub Actions that:
- Trigger on push to main branch
- Build and test the API
- Deploy to Vercel production (api.oriva.io)
- Handle environment variables properly
- Provide deployment status

## Monitoring Deployments

```bash
# Check deployment status
gh run list --limit 5

# Watch active deployment
gh run watch <run-id>

# Test production endpoints after deployment
curl -s https://api.oriva.io/api/v1/health
```

## Environment Setup

- Local: `.env` and `api/.env` (for local development)
- Production: Environment variables managed through GitHub Actions and Vercel integration

---

**Remember**: Always deploy through GitHub, never directly to Vercel!