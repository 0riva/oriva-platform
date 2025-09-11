# CI/CD Pipeline

This directory contains GitHub Actions workflows for automated testing and deployment.

## Workflows

### `ci-cd.yml`
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
