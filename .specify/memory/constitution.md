<!--
Sync Impact Report:
Version change: Not specified in template → 1.0.0
Modified principles:
- All template placeholders replaced with concrete values specific to Oriva Platform
Added sections:
- API-First Development
- Test-Driven Development (TDD)
- Privacy-First Architecture
- Phase-Based Implementation
- Database Integration Standards
Removed sections: None (all template sections converted to concrete content)
Templates requiring updates:
✅ plan-template.md - Constitution Check section aligns with principles
✅ spec-template.md - Requirements align with privacy-first approach
✅ tasks-template.md - TDD workflow matches constitution requirements
✅ agent-file-template.md - Structure supports constitution principles
Follow-up TODOs: None - all placeholders resolved
-->

# Oriva Platform Constitution

## Core Principles

### I. API-First Development
Every feature begins as a well-defined API contract; Implementation follows OpenAPI specifications; Authentication uses Bearer token format with comprehensive validation; All endpoints support JSON format with structured error responses; Rate limiting and CORS protection are mandatory for production readiness.

*Rationale: The Oriva Platform serves as an API gateway for third-party applications. API contracts ensure consistent integration patterns and developer experience.*

### II. Test-Driven Development (NON-NEGOTIABLE)
TDD cycle is strictly enforced: Tests written → User approved → Tests fail → Then implement; Contract tests required for all API endpoints; Integration tests mandatory for database operations; All tests must pass before any code merge; Coverage targets: ≥80% unit tests, ≥70% integration tests.

*Rationale: API reliability is critical for third-party developers. TDD ensures robust, well-tested endpoints that external applications can depend on.*

### III. Privacy-First Architecture
User data protection is paramount: ID sanitization with ext_ prefixes for all external exposure; No personal information in API responses; Cross-profile data isolation enforced; User-controlled permissions for extension access; Secure external ID generation with configurable salts.

*Rationale: Oriva's privacy-first design is a core differentiator. All platform APIs must maintain this standard to protect user privacy and enable safe third-party integrations.*

### IV. Phase-Based Implementation
All features follow structured phases: Phase 0 (Research), Phase 1 (Design & Contracts), Phase 2 (Task Planning), Phase 3+ (Implementation & Validation); Constitutional compliance checked at phase boundaries; Documentation requirements: data-model.md, contracts/, quickstart.md; Agent files updated incrementally using specified scripts.

*Rationale: Systematic development reduces errors and ensures consistent quality across the platform. Phase gates prevent architectural drift.*

### V. Database Integration Standards
Supabase client usage for all data operations; Service role key validation for security; Structured logging with Winston for all database operations; Error handling with fallback responses; Real-time data validation against database schema.

*Rationale: Consistent database patterns ensure reliability and maintainability across the platform's API surface.*

## Development Workflow

Specification-driven development: All features begin with business requirements in spec.md; Technical planning follows with plan.md including constitutional compliance; Task generation uses tasks.md template with TDD ordering; Implementation execution with continuous validation gates.

## Quality Standards

Code quality requirements: TypeScript strict mode enforcement; ESLint and security audit compliance; Express.js best practices with middleware validation; Production logging and monitoring integration; Deployment readiness verification before merge.

## Governance

Constitution supersedes all other development practices; All feature plans must verify constitutional compliance at Phase 0 and Phase 1 boundaries; Amendments require documentation in this file with version increment; Development agents must reference this constitution for all implementation decisions; Complexity deviations require explicit justification in Complexity Tracking sections.

**Version**: 1.0.0 | **Ratified**: 2025-01-21 | **Last Amended**: 2025-01-21