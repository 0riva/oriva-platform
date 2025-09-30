# Repository Coordination: Hugo Platform Integration

## Overview

This feature spans **TWO repositories** that must be coordinated:

1. **oriva-platform** (Backend API) - TypeScript/Vercel - **Primary implementation repo**
2. **oo-ios** (iOS Client) - Swift/SwiftUI - **Integration repo**

## Repository Assignments

### Backend Repository: `oriva-platform/`

**Location**: Oriva Platform API repository (TypeScript/Vercel backend)

**Tasks**: T001-T054 (87% of feature work)

**Structure**:
```
oriva-platform/
├── api/
│   ├── auth/               # T035-T040
│   ├── hugo/               # T044-T054
│   ├── lib/                # T012
│   ├── middleware/         # T013-T015
│   └── services/           # T041-T043
├── supabase/
│   └── migrations/         # T001-T011
└── tests/
    └── contract/           # T017-T034
```

**Branch**: `003-hugo-platform-integration`

**Dependencies**: Oriva 101 Supabase project, Vercel account

### iOS Repository: `oo-ios/`

**Location**: Current repository (`oo-ios/`)

**Tasks**: T055-T062, T069-T072 (iOS integration + data retention)

**Structure**:
```
oo-ios/
└── Platform/
    ├── NetworkingKit/
    │   ├── Sources/NetworkingKit/
    │   │   ├── Models/             # T055-T058
    │   │   ├── Services/           # T059, T071
    │   │   └── OrivaPlatformClient.swift  # T060
    │   └── Tests/NetworkingKitTests/      # T061-T062, T072
    └── OrivaCore/
        └── Sources/OrivaCore/
            └── Models/             # T069
```

**Branch**: `003-hugo-platform-integration`

**Dependencies**: Backend API must be deployed to staging

## Coordination Points

### Integration Contract: API Endpoints

**Source of Truth**: `oriva-platform/specs/003-hugo-platform-integration/contracts/*.yaml`

**Process**:
1. Backend team implements endpoint (oriva-platform)
2. Backend deploys to staging environment
3. iOS team updates NetworkingKit types (oo-ios)
4. iOS team tests against staging API
5. Both teams coordinate production deployment

### Phase Synchronization

| Phase | Backend (oriva-platform) | iOS (oo-ios) | Sync Point |
|-------|-------------------------|--------------|------------|
| 3.1 | T001-T016 (Foundation) | - | Backend completes migrations |
| 3.2 | T017-T034 (Contract Tests) | - | Contracts published to shared location |
| 3.3 | T035-T054 (Implementation) | T055-T058 (Types) | Backend staging deployment |
| 3.4 | - | T059-T062, T069-T072 (Integration) | iOS tests against staging |

**CRITICAL DEPENDENCY**: iOS work (T055-T062, T069-T072) **CANNOT START** until:
- Backend auth endpoints deployed (T035-T040)
- Backend staging environment accessible
- Contract specs finalized

**Timeline Impact**: iOS team blocked ~2-3 weeks during backend implementation

### Testing Strategy

**Backend Testing** (oriva-platform):
- Contract tests (T017-T034) run in isolation
- Integration tests against Oriva 101 Supabase test database
- Staging deployment for iOS integration testing

**iOS Testing** (oo-ios):
- Unit tests against mock responses
- Integration tests against backend staging API
- Cannot run integration tests until backend staging ready

**End-to-End Testing**:
- Requires both repositories at compatible versions
- iOS app → Backend staging → Oriva 101 Supabase database
- Performance testing (<3s response time)

### Communication Protocol

**Daily Standups**: Coordinate progress, especially during Phase 3.3 → 3.4 transition

**Shared Artifacts**:
- Contract specs: `oriva-platform/specs/003-hugo-platform-integration/contracts/`
- This spec.md: Lives in `oo-ios/` but copied to `oriva-platform/specs/` for reference
- Staging API URL: Document in both repositories' `.env.example`

**Version Compatibility**:
- Backend version: Track in `oriva-platform/package.json` version field
- iOS expects: Document minimum backend version in `oo-ios/Platform/NetworkingKit/Package.swift`

### Deployment Coordination

**Backend First**:
1. Deploy oriva-platform to staging
2. Run smoke tests
3. Notify iOS team staging is ready

**Then iOS**:
4. iOS team integrates against staging
5. iOS team completes integration tests
6. Both teams coordinate production deployment window

**Rollback Plan**:
- Backend can rollback independently if iOS not yet deployed
- If iOS deployed, both must rollback together

## Decision: Where Does This Spec Live?

**Current Location**: `oo-ios/specs/003-hugo-platform-integration/`

**Recommendation**:
- Keep spec in oo-ios (iOS-centric view)
- **Copy** spec to `oriva-platform/specs/003-hugo-platform-integration/` for backend team reference
- Both copies reference this REPOSITORIES.md for coordination

**Alternative**: Create mono-repo or shared specs repository (more overhead)

## Database Naming Clarification

- **Oriva 101**: Supabase database name (used in connection strings, migrations)
- **Oriva Platform**: The Oriva API/backend infrastructure (TypeScript/Vercel)

When referring to database operations, use "Oriva 101". When referring to API/backend, use "Oriva Platform".

## Task Execution Order

**Week 1-2** (Backend only):
- T001-T016 (oriva-platform) - Foundation
- T017-T034 (oriva-platform) - Contract tests

**Week 3-4** (Backend + iOS types in parallel):
- T035-T054 (oriva-platform) - Backend implementation
- T055-T058 (oo-ios) - iOS types (can start after contracts finalized)

**Week 5** (iOS integration):
- T059-T062, T069-T072 (oo-ios) - iOS services and tests (requires backend staging)

**Week 6** (Validation & deployment):
- End-to-end testing
- Performance validation
- Production deployment coordination