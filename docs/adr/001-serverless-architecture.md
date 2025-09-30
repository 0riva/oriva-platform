# ADR-001: Serverless Architecture with Vercel Edge Functions

**Status**: Accepted
**Date**: 2025-09-29
**Deciders**: Platform Team
**Related**: T067 (Auto-scaling infrastructure)

## Context

The Oriva Platform backend needs to serve multiple applications (starting with Hugo Matchmaker) with:
- Variable traffic patterns (low baseline, potential spikes)
- Global user base requiring low latency
- Limited initial team size for infrastructure management
- Need for rapid iteration and deployment

Traditional server-based architectures would require:
- Manual capacity planning and scaling
- Infrastructure maintenance overhead
- Regional deployment complexity
- Fixed costs regardless of usage

## Decision

We will build the Oriva Platform backend as a **serverless application** deployed on **Vercel Edge Functions** with the following characteristics:

### Architecture Components

1. **Compute**: Vercel Edge Functions (Node.js 20.x)
   - Automatic scaling (0 to N instances)
   - Multi-region deployment (US East, US West, Europe)
   - Function-specific resource allocation

2. **API Design**: RESTful HTTP endpoints
   - Stateless request handling
   - JWT-based authentication
   - JSON request/response format

3. **Resource Allocation**:
   - Default functions: 10s timeout, 1024MB memory
   - Chat functions: 30s timeout, 2048MB memory
   - Knowledge search: 5s timeout, 512MB memory

### Deployment Strategy

- **Regions**: iad1 (US East), sfo1 (US West), fra1 (Europe)
- **Routing**: Automatic edge routing to nearest region
- **Cold starts**: Accepted trade-off for cost efficiency
- **Concurrency**: Automatic per-region scaling

## Consequences

### Positive

✅ **Automatic Scaling**
- No manual capacity planning required
- Scales to zero during low traffic (cost savings)
- Handles traffic spikes automatically

✅ **Global Performance**
- Multi-region deployment out of the box
- Edge routing reduces latency
- Automatic failover between regions

✅ **Operational Simplicity**
- No server management or patching
- Automatic SSL/TLS certificates
- Built-in monitoring and logging

✅ **Cost Efficiency**
- Pay only for actual compute time
- No idle server costs
- Predictable pricing model

✅ **Developer Experience**
- Git-based deployments
- Preview deployments for branches
- Fast iteration cycles

### Negative

⚠️ **Cold Starts**
- First request after idle period can be slower (500-1000ms)
- Mitigated by: Traffic patterns, warm functions, connection pooling

⚠️ **Execution Time Limits**
- Maximum 30s per function invocation
- Not suitable for long-running background jobs
- Mitigated by: Async patterns, separate background workers if needed

⚠️ **Stateless Constraint**
- No local state between requests
- Must use external storage (database, cache)
- Mitigated by: Database connection pooling, Redis for caching

⚠️ **Vendor Lock-in**
- Vercel-specific deployment configuration
- Migration effort if switching providers
- Mitigated by: Standard Node.js code, minimal platform-specific code

### Trade-offs Accepted

1. **Cold starts** for cost efficiency and operational simplicity
2. **30s timeout** limits for automatic scaling benefits
3. **Vercel dependency** for developer experience and global deployment

## Implementation Notes

### Function Configuration (vercel.json)

```json
{
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs20.x",
      "maxDuration": 10,
      "memory": 1024
    },
    "api/v1/hugo/chat.ts": {
      "maxDuration": 30,
      "memory": 2048
    }
  }
}
```

### Region Selection Rationale

- **iad1 (US East)**: Primary region, largest user base
- **sfo1 (US West)**: West coast coverage, lower latency for Pacific users
- **fra1 (Europe)**: European coverage, GDPR compliance

### Scaling Triggers

Vercel automatically scales based on:
- Request volume
- CPU utilization (>80% for 30s)
- Memory usage (>80% allocated)

Up to 100 concurrent instances per region.

## Alternatives Considered

### 1. Traditional VPS/EC2 Deployment

**Pros**:
- Full control over infrastructure
- No cold starts
- No execution time limits

**Cons**:
- Manual scaling and capacity planning
- Infrastructure maintenance overhead
- Fixed costs regardless of usage
- Complex multi-region setup

**Rejected**: Infrastructure overhead not justified for initial launch

### 2. Container-based (Docker/Kubernetes)

**Pros**:
- Good scaling characteristics
- Portable across providers
- Industry standard

**Cons**:
- Complex setup and management
- Requires DevOps expertise
- Higher operational overhead
- Still requires capacity planning

**Rejected**: Operational complexity too high for team size

### 3. AWS Lambda + API Gateway

**Pros**:
- Similar serverless benefits
- Mature ecosystem
- More configuration options

**Cons**:
- More complex setup
- Cold start optimization needed
- Regional deployment more complex
- Steeper learning curve

**Rejected**: Vercel offers better DX and simpler deployment

## Metrics for Success

- **Availability**: > 99.9% uptime
- **Response time p95**: < 1000ms (excluding cold starts)
- **Response time p99**: < 3000ms
- **Cold start rate**: < 10% of requests
- **Cost per request**: < $0.0001

## Review Schedule

- **3 months**: Review cold start impact and cost
- **6 months**: Evaluate scaling behavior under real traffic
- **12 months**: Reassess architecture for scale and cost

## References

- [Vercel Edge Functions Documentation](https://vercel.com/docs/functions)
- [Serverless Architecture Patterns](https://martinfowler.com/articles/serverless.html)
- [SCALING.md](../SCALING.md) - Infrastructure scaling procedures
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Deployment guide