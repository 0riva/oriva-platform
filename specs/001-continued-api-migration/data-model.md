# Data Model: TypeScript Migration

**Phase 1 Output** | **Date**: 2025-01-21

## Entity Definitions

### API Request/Response Types
**Purpose**: Type-safe interfaces for all API endpoints
**Fields**:
- `ApiRequest<T>`: Generic request interface with typed body
- `ApiResponse<T>`: Standard response wrapper with success/error states
- `PaginatedResponse<T>`: Paginated data responses
- `ErrorResponse`: Structured error information

**Validation Rules**:
- All requests must conform to request type interfaces
- Responses must include success boolean and appropriate data/error fields
- Error responses must include error message and optional details array

### Database Model Types
**Purpose**: TypeScript interfaces matching Supabase database schema
**Fields**:
- `Profile`: User profile data structure
- `Group`: Group information and metadata
- `GroupMember`: Group membership relationship
- `Entry`: Content entry structure
- `ApiKey`: Developer API key information
- `MarketplaceApp`: Plugin marketplace application data

**Relationships**:
- Profile → Groups (many-to-many through GroupMember)
- Profile → Entries (one-to-many)
- ApiKey → Profile (many-to-one)
- MarketplaceApp → Profile (many-to-one as developer)

**Validation Rules**:
- All ID fields must be UUID format or external ID format (ext_*)
- Created/updated timestamps in ISO 8601 format
- Foreign key relationships properly typed

### Middleware Function Types
**Purpose**: Type-safe Express middleware with proper request/response typing
**Fields**:
- `AuthenticatedRequest`: Request interface with user authentication context
- `ValidatedRequest<T>`: Request with validated body of type T
- `ApiKeyContext`: API key validation context information
- `MiddlewareFunction<T>`: Generic middleware function signature

**State Transitions**:
- Unauthenticated → Authenticated (via validateAuth middleware)
- Unvalidated → Validated (via request validation middleware)
- Raw Request → Typed Request (via middleware chain)

### Error Handling Types
**Purpose**: Consistent error response structure across API
**Fields**:
- `ApiError`: Base error interface with code, message, details
- `ValidationError`: Input validation failure information
- `AuthenticationError`: Authentication/authorization failures
- `DatabaseError`: Database operation failures

**Validation Rules**:
- Error codes must be HTTP status codes
- Error messages must be user-friendly
- Details array optional for additional context

### Authentication Types
**Purpose**: Type-safe authentication and authorization interfaces
**Fields**:
- `ApiKeyInfo`: API key metadata and permissions
- `UserAuthContext`: User authentication context
- `PermissionScope`: Available permission definitions
- `AuthTokenPayload`: Token validation payload structure

**State Transitions**:
- Anonymous → API Key Authenticated
- Anonymous → User Token Authenticated
- Authenticated → Permission Validated