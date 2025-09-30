# Architecture Decision Records (ADR)

**Task**: T082 - Document architectural decisions

## Overview

This directory contains Architecture Decision Records (ADRs) documenting significant architectural decisions made in the Oriva Platform backend.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences.

## ADR Format

Each ADR follows this structure:
- **Title**: Short noun phrase
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Context**: What is the issue we're seeing that motivates this decision?
- **Decision**: What is the change we're actually proposing/doing?
- **Consequences**: What becomes easier or harder as a result?

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](./001-serverless-architecture.md) | Serverless Architecture with Vercel Edge Functions | Accepted | 2025-09-29 |
| [002](./002-supabase-database.md) | Supabase as Primary Database | Accepted | 2025-09-29 |
| [003](./003-connection-pooling.md) | Database Connection Pooling Strategy | Accepted | 2025-09-29 |
| [004](./004-multi-ai-provider.md) | Multi-Provider AI Strategy | Accepted | 2025-09-29 |
| [005](./005-monitoring-stack.md) | Monitoring and Observability Stack | Accepted | 2025-09-29 |
| [006](./006-rate-limiting.md) | User-Based Rate Limiting | Accepted | 2025-09-29 |

## Creating a New ADR

When making a significant architectural decision:

1. Copy the template: `cp template.md XXX-your-decision.md`
2. Fill in the sections
3. Submit for review via pull request
4. Update this index when accepted

## Guidelines

**When to write an ADR**:
- Technology selection (database, framework, service)
- Architectural patterns (event-driven, microservices)
- Infrastructure decisions (hosting, regions)
- Security approaches (authentication, authorization)
- Performance strategies (caching, scaling)

**When NOT to write an ADR**:
- Implementation details
- Code style preferences
- Bug fixes
- Feature specifications