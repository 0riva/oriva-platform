# Oriva Platform Constitution

This document outlines architectural principles, constraints, and learned lessons for the Oriva Platform.

## Core Architectural Principles

### Platform Architecture

- **Three-tier structure**: Platform (foundation) → Packages (domain logic) → Apps (specific implementations)
- **Service Locator Pattern**: Centralized dependency injection and service resolution
- **Repository Pattern**: Data access abstraction with caching layer for performance
- **MVVM Architecture**: Model-View-ViewModel separation with SwiftUI

### Backend Architecture

- **Supabase**: PostgreSQL database with REST API and real-time subscriptions
- **Edge Functions**: Deno Deploy runtime for serverless functions
- **Schema Organization**: Namespaced schemas (e.g., `hugo_love`) for multi-app support

## Technology Stack Compatibility

### CRITICAL: Runtime Environment Constraints

**Supabase Edge Functions (Deno Deploy) Limitations**

Edge Functions run in a secure, isolated Deno Deploy environment with specific constraints:

- **NO Filesystem Access**: No file system operations (read/write/stat) available by design
- **NO Native Modules**: Cannot use Node.js modules requiring filesystem or native bindings
- **Affects All Environments**: These constraints apply to local dev, staging, AND production

### Dependency Evaluation Checklist

Before integrating any new library, service, or SDK, verify:

1. **Runtime Compatibility**: Does it work in Deno Deploy / serverless edge environments?
2. **Filesystem Dependencies**: Does it require reading config files or credentials from disk?
3. **Native Module Requirements**: Does it use Node.js native bindings or C++ extensions?
4. **Initialization Behavior**: Does it attempt to load configuration during import/initialization?
5. **Alternative Options**: Are there edge-compatible alternatives available?

### Learned Lessons

#### Case Study: AWS Bedrock SDK Incompatibility (October 2025)

**Problem**:
AWS Bedrock SDK (`@aws-sdk/client-bedrock-runtime`) was integrated for Claude AI access but proved fundamentally incompatible with Supabase Edge Functions.

**Root Cause**:

- AWS SDK attempts to read `~/.aws/credentials` file during initialization
- Uses `@smithy/shared-ini-file-loader` which requires filesystem access
- This happens even when explicit credentials are provided in code
- Edge Functions block all filesystem access by security design
- Error: `[unenv] fs.readFile is not implemented yet!`

**Impact**:

- Multiple hours of debugging
- Production deployment blocked
- Complete SDK replacement required

**Resolution**:

- Migrated to Anthropic's direct API (`@anthropic-ai/sdk`)
- Anthropic SDK has no filesystem dependencies
- Designed specifically for edge/serverless environments
- Using Claude 3.5 Sonnet model: `claude-3-5-sonnet-20241022`

**Prevention Strategy**:
When selecting AI/ML services or any external SDK:

1. **Research Phase**: Check documentation explicitly for Deno/Edge compatibility
2. **Proof of Concept**: Test in local Edge Function BEFORE full integration
3. **Fallback Planning**: Identify alternative services before committing
4. **Documentation**: Document compatibility verification in design docs

**Compatible AI/ML Services**:

- ✅ **Anthropic SDK** - Edge-friendly, no filesystem dependencies
- ✅ **OpenAI SDK** - Edge-compatible (Deno-specific package available)
- ✅ **Replicate SDK** - Designed for serverless environments
- ❌ **AWS Bedrock SDK** - Requires filesystem for credential loading
- ⚠️ **Google Vertex AI** - Verify edge compatibility before use

## Development Workflow Principles

### Service Registration

Services must be registered in dependency order:

1. Configuration managers (SecureConfigurationManager, etc.)
2. HTTP clients (HTTPClient, SupabaseClient)
3. Authentication services
4. Repositories (using CoreDataManager)
5. App-specific services

### Error Handling

- Use `errorBoundary` modifier from OrivaCore for SwiftUI views
- Implement proper error propagation through repository layer
- Log errors appropriately for debugging and monitoring

### Performance

- Repository caching layer provides 80% performance improvement
- Cache TTL and count limits must be configured per repository
- Maintain cache invalidation logic to prevent stale data

### Security

- API keys stored in Keychain via SecureConfigurationManager
- Never commit credentials to version control
- Use environment variables for Edge Function configuration
- Validate all user inputs before processing

## Edge Function Development Guidelines

### Configuration Management

- Use `.env.local` for local development configuration
- Environment variables automatically available via `Deno.env.get()`
- Never hardcode API keys or sensitive configuration

### Authentication Strategy

- **Production**: JWT token validation required
- **Development**: Dev mode bypass checking for `kong` URL or `x-dev-user-id` header
- Edge Runtime middleware validates Authorization header before function execution

### Request/Response Patterns

- Accept both snake_case and camelCase in request bodies for iOS/Android compatibility
- Use Server-Sent Events (SSE) for streaming responses
- Implement proper CORS headers for browser/mobile app access

### Testing Edge Functions Locally

```bash
# Start Edge Functions locally
supabase functions serve chat-stream --no-verify-jwt --env-file supabase/.env.local

# Test with curl
curl -X POST "http://127.0.0.1:54321/functions/v1/chat-stream" \
  -H "apikey: {SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer {SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"test-id","message":"hello"}'
```

## Documentation Requirements

When encountering significant technical decisions or compatibility issues:

1. **Document in CLAUDE.md**: Update project guidance for future development
2. **Create Memory File**: Add detailed analysis to `.serena/memories/`
3. **Update Constitution**: Add principles and lessons learned (this file)
4. **Code Comments**: Document non-obvious technical decisions inline

## Review and Evolution

This constitution should be reviewed and updated:

- After discovering new technical constraints
- When making significant architectural decisions
- After resolving complex technical issues
- Quarterly as part of technical debt review

Last Updated: October 9, 2025
