# Deployment Configuration

## Vercel Project Details
- **Project Name**: oriva-platform
- **Production URL**: https://oriva-platform.vercel.app
- **Repository**: 0riva/oriva-platform

## Deployment Methods

### 1. Direct Vercel Integration (Active)
- Automatic deployments on push to main branch
- Connected via Vercel GitHub App
- Preview deployments for pull requests

### 2. GitHub Actions CI/CD (Active)
- Runs tests before deployment
- Security scanning
- Controlled deployment with quality gates
- Uses Vercel API tokens (stored as GitHub secrets)

## Environment Variables
Ensure the following are set in Vercel project settings:
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- CORS_ORIGIN (includes localhost:8081 for development)

## Recent Changes
- 2024-09-29: Renamed project from oriva-api to oriva-platform
- 2024-09-29: Added localhost:8081 to CORS origins for Oriva Core team
- 2024-09-29: Connected repository directly to Vercel for auto-deployment

## Notes
- Both deployment methods are currently active (Vercel direct + GitHub Actions)
- Consider disabling one to avoid duplicate deployments
- Vercel free tier limit: 100 deployments per day