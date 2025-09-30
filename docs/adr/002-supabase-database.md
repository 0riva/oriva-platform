# ADR-002: Supabase as Primary Database

**Status**: Accepted
**Date**: 2025-09-29
**Deciders**: Platform Team
**Related**: ADR-001 (Serverless Architecture), T068 (Connection Pooling)

## Context

The Oriva Platform requires a database solution that can:
- Store user profiles, conversations, messages, and knowledge entries
- Support both structured (user data) and semi-structured (JSON metadata) data
- Scale with serverless architecture (connection pooling)
- Provide real-time capabilities for future features
- Offer built-in authentication and authorization
- Support vector embeddings for knowledge search

Traditional database choices:
- Self-hosted PostgreSQL: Requires infrastructure management
- Amazon RDS: Good but requires AWS ecosystem integration
- MongoDB Atlas: NoSQL, less suitable for relational data
- PlanetScale: MySQL-based, lacks PostgreSQL features

## Decision

We will use **Supabase** as the primary database for the Oriva Platform with:

### Core Components

1. **Database**: PostgreSQL 15+ (managed by Supabase)
   - Full ACID compliance
   - Rich feature set (JSON, arrays, triggers, functions)
   - Vector embeddings via pgvector extension

2. **Connection Pooling**: Transaction mode via Supavisor
   - Handles serverless connection challenges
   - Configurable pool size per environment
   - Automatic connection lifecycle management

3. **Authentication** (future): Supabase Auth
   - Built-in user management
   - JWT token generation
   - Social OAuth providers

4. **Real-time** (future): Supabase Realtime
   - Database change streams
   - WebSocket connections
   - Pub/sub messaging

### Configuration

**Production**:
- Plan: Supabase Pro ($25/month)
- Region: us-east-1 (primary user base)
- Connection pooling: Transaction mode
- Pool size: 20 (configurable via `DB_POOL_MAX`)

**Database Schema**:
- Row Level Security (RLS) enabled
- Performance indexes on foreign keys
- JSON metadata fields for flexibility
- Vector columns for semantic search

## Consequences

### Positive

✅ **Serverless-Friendly**
- Built-in connection pooling via Supavisor
- Handles connection lifecycle automatically
- Optimized for edge/serverless environments

✅ **Developer Experience**
- Auto-generated REST API
- Real-time subscriptions out of the box
- Studio UI for database management
- Automatic migrations support

✅ **PostgreSQL Benefits**
- Full SQL capabilities
- JSONB for flexible metadata
- Powerful indexing options
- pgvector for embeddings

✅ **Built-in Features**
- Row Level Security for multi-tenancy
- Realtime for future live features
- Storage for file uploads (future)
- Edge Functions for database logic

✅ **Operational Simplicity**
- Managed backups (daily + point-in-time recovery)
- Automatic updates and patching
- Built-in monitoring and logs
- Simple scaling (vertical and connection pool)

✅ **Cost Efficiency**
- Pro plan: $25/month baseline
- Included: 8GB database, 100GB bandwidth, 50GB file storage
- Predictable pricing
- No per-query charges

### Negative

⚠️ **Vendor Lock-in**
- Supabase-specific features (Realtime, Auth)
- Migration effort if switching providers
- Mitigated by: Standard PostgreSQL, minimal Supabase-specific code

⚠️ **Connection Pool Limits**
- Maximum connections limited by plan
- Pro plan: ~500 concurrent connections
- Mitigated by: Connection pooling, efficient query patterns

⚠️ **Regional Limitations**
- Database lives in single region (us-east-1)
- Cross-region latency for non-US users
- Mitigated by: Edge caching, read replicas (future), CDN

⚠️ **Scaling Limitations**
- Vertical scaling has limits
- Eventually may need sharding or read replicas
- Mitigated by: Sufficient for current scale, future migration path exists

### Trade-offs Accepted

1. **Single-region database** for operational simplicity
2. **Vendor-specific features** for developer experience
3. **Connection pool limits** for cost efficiency

## Implementation Notes

### Connection Configuration

```typescript
// api/config/supabase.ts
export const CONNECTION_POOL_CONFIG = {
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  maxRetries: 3,
};
```

### Schema Design Principles

1. **Normalized Core Tables**: Users, conversations, messages
2. **JSON for Flexibility**: Metadata, preferences, dynamic fields
3. **Indexes for Performance**: Foreign keys, frequently queried fields
4. **RLS for Security**: User-level data isolation

### Migration Strategy

- SQL migrations in `supabase/migrations/`
- Applied via Supabase CLI or SQL Editor
- Version controlled in git
- Backward compatible changes preferred

### Monitoring

- Built-in dashboard for connection pool, queries, storage
- Custom metrics via `/api/health` endpoint
- SQL analytics views for performance dashboards
- Slow query log monitoring

## Alternatives Considered

### 1. Self-Hosted PostgreSQL

**Pros**:
- Full control
- No vendor lock-in
- Customizable configuration

**Cons**:
- Infrastructure management overhead
- Manual backups and updates
- Connection pooling setup
- No built-in realtime/auth

**Rejected**: Infrastructure overhead too high

### 2. Amazon RDS PostgreSQL

**Pros**:
- Mature, reliable service
- Good scaling options
- AWS ecosystem integration

**Cons**:
- Requires AWS setup and knowledge
- More complex configuration
- No built-in realtime or auth features
- Connection pooling requires external tool (PgBouncer)

**Rejected**: More complex, missing features Supabase provides

### 3. PlanetScale (MySQL)

**Pros**:
- Excellent branching model
- Automatic connection pooling
- Good serverless support

**Cons**:
- MySQL instead of PostgreSQL
- Lacks full-text search capabilities
- No vector embeddings support
- Less flexible JSON handling

**Rejected**: PostgreSQL features needed for knowledge search

### 4. MongoDB Atlas

**Pros**:
- Excellent for JSON documents
- Flexible schema
- Good serverless support

**Cons**:
- NoSQL lacks relational integrity
- More complex queries for relationships
- No pgvector equivalent
- Steeper learning curve for SQL-familiar teams

**Rejected**: Relational data model preferred

## Performance Targets

- **Query latency p95**: < 100ms
- **Connection pool utilization**: < 80%
- **Slow queries** (>500ms): < 1% of queries
- **Connection errors**: < 0.1%

## Scaling Strategy

**Current (Launch → 10K users)**:
- Single PostgreSQL instance (Pro plan)
- Connection pooling (20-40 connections)
- Read queries optimized with indexes

**Future (10K → 100K users)**:
- Increase connection pool to 50-100
- Add read replicas for analytics queries
- Implement query result caching (Redis)

**Long-term (100K+ users)**:
- Consider horizontal sharding by app_id
- Dedicated analytics database
- Read replicas in additional regions

## Review Schedule

- **1 month**: Review query performance and connection pool utilization
- **3 months**: Evaluate cost vs. usage
- **6 months**: Assess scaling needs and replica strategy
- **12 months**: Comprehensive architecture review

## References

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [ENVIRONMENT.md](../ENVIRONMENT.md) - Database configuration
- [SCALING.md](../SCALING.md) - Database scaling procedures