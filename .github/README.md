# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the Oriva Platform API.

## Available Workflows

- **`ci-cd.yml`** - Main CI/CD pipeline for testing and deployment
- **`api-ci.yml`** - API-specific continuous integration
- **`sdk-ci.yml`** - Plugin SDK continuous integration  
- **`pages.yml`** - Documentation site deployment

## Workflow Details

### CI/CD Pipeline (`ci-cd.yml`)
- **Triggers**: Push to `main` or `develop` branches, Pull Requests
- **Jobs**:
  - **Test**: Runs tests on Node.js 18.x and 20.x
  - **Security Scan**: Runs npm audit for vulnerability checks
  - **Deploy Staging**: Deploys to Vercel staging on `develop` branch
  - **Deploy Production**: Deploys to Vercel production on `main` branch
  - **Notify**: Sends deployment status notifications

## Required Secrets

Add these secrets to your GitHub repository:

- `VERCEL_TOKEN`: Vercel authentication token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID

## Local Development

Run the same checks locally:

```bash
# Run all CI checks
npm run ci

# Run tests with coverage
npm run test:ci

# Run security audit
npm run security:audit

# Run linting
npm run lint
```

## Test Coverage

Current test coverage: **24.92%** (70 tests passing)

The coverage is intentionally low as we're focusing on core functionality first. Coverage will increase as we implement more features.

---

**Note**: This is a technical documentation file for GitHub Actions. For the main project documentation, see the root [README.md](../README.md).
