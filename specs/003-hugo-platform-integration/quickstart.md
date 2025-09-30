# Hugo Platform Integration - Quickstart Guide

**Feature**: 003-hugo-platform-integration
**Branch**: `003-hugo-platform-integration`
**Created**: 2025-01-14

## Overview

Quick reference for setting up and testing the Hugo Platform Integration. This guide walks you through the essential steps to get the platform running locally and validates the core functionality.

## Prerequisites

### Required Tools
```bash
# Node.js 20+ (Vercel Edge Functions)
node --version  # Should be 20.x or higher

# TypeScript 5.x
npm install -g typescript
tsc --version   # Should be 5.x

# Supabase CLI
npm install -g supabase
supabase --version

# Swift 5.9+ (iOS client)
swift --version  # Should be 5.9 or higher
xcodebuild -version

# Git
git --version
```

### Required Accounts
- **Supabase Project**: https://supabase.com (create free tier project)
- **Vercel Account**: https://vercel.com (for edge function deployment)
- **OpenAI API Key**: https://platform.openai.com (for AI integration)
- **Oriva Platform Access**: Contact platform team for API credentials

## Environment Setup

### 1. Backend Setup (Vercel + Supabase)

```bash
# Clone repository
git clone <repository-url>
cd oriva-platform

# Create .env.local file
cat > .env.local <<EOF
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key

# Anthropic Configuration (optional)
ANTHROPIC_API_KEY=sk-ant-your-api-key

# Oriva Platform
ORIVA_API_URL=https://api.oriva.com/v1
ORIVA_CLIENT_ID=your-client-id
ORIVA_CLIENT_SECRET=your-client-secret

# JWT Configuration
JWT_SECRET=your-secure-random-secret
JWT_EXPIRY=3600

# Feature Flags
ENABLE_VECTOR_SEARCH=false
ENABLE_AB_TESTING=false
EOF

# Install dependencies
npm install

# Run database migrations
supabase db reset
supabase migration up

# Start local development server
npm run dev
```

### 2. Database Setup (Supabase)

```bash
# Initialize Supabase project
supabase init

# Link to your Supabase project
supabase link --project-ref your-project-ref

# Run migrations from data-model.md
supabase migration new hugo_platform_schema
# Copy SQL from data-model.md to migration file
supabase db push

# Verify tables created
supabase db diff
```

Expected output:
```
✓ users
✓ apps
✓ conversations
✓ messages
✓ knowledge_bases
✓ knowledge_entries
✓ personality_schemas
✓ user_progress
✓ user_memories
```

### 3. iOS Client Setup

```bash
# Navigate to iOS project
cd ../oo-ios

# Open in Xcode
open HugoApp.xcodeproj

# Update NetworkingKit configuration
# Edit: Platform/NetworkingKit/Sources/NetworkingKit/Configuration.swift
```

**NetworkingKit Configuration**:
```swift
public struct OrivaPlatformConfiguration {
    public static let shared = OrivaPlatformConfiguration()

    public let baseURL = URL(string: "http://localhost:3000")!  // Local dev
    // public let baseURL = URL(string: "https://api.oriva.com/v1")!  // Production

    public let timeout: TimeInterval = 10.0
}
```

## Validation Tests

### Test 1: Database Schema Validation

```bash
# Run schema validation
npm run test:db:schema

# Expected: All 9 tables with correct indexes
# Expected: Row-Level Security policies enabled
# Expected: Full-text search indexes created
```

**Success Criteria**:
- ✅ All tables created with correct columns
- ✅ Foreign key constraints enforced
- ✅ GIN indexes on search_vector columns
- ✅ RLS policies active on sensitive tables

### Test 2: Knowledge Base Search

```bash
# Seed test knowledge base
npm run db:seed:knowledge

# Test full-text search
curl -X POST http://localhost:3000/api/hugo/knowledge/search \
  -H "Content-Type: application/json" \
  -H "X-App-ID: hugo_matchmaker" \
  -H "Authorization: Bearer <test-token>" \
  -d '{
    "query": "vulnerability authentic connection",
    "max_results": 5
  }'
```

**Expected Response** (<1s):
```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Principle 1: Authentic Vulnerability",
      "content": "...",
      "relevance_score": 0.87,
      "category": "intimacy_code"
    }
  ],
  "total_count": 5,
  "query_time_ms": 234
}
```

**Success Criteria**:
- ✅ Query completes in <1000ms
- ✅ Relevance scores between 0.0 and 1.0
- ✅ Results filtered to app's knowledge base
- ✅ No exact keyword match required (fuzzy search works)

### Test 3: Multi-Layered Chat Composition

```bash
# Test chat endpoint with streaming
curl -X POST http://localhost:3000/api/hugo/chat \
  -H "Content-Type: application/json" \
  -H "X-App-ID: hugo_matchmaker" \
  -H "Authorization: Bearer <test-token>" \
  -d '{
    "conversation_id": "test-conv-uuid",
    "message": "How do I show vulnerability without seeming weak?"
  }'
```

**Expected Response** (<3s total, streaming):
```
data: {"type":"token","content":"Showing"}
data: {"type":"token","content":" vulnerability"}
...
data: {"type":"done","message_id":"uuid","confidence":0.85,"knowledge_sources":[{"entry_id":"uuid","title":"Authentic Vulnerability"}]}
```

**Success Criteria**:
- ✅ Response starts streaming within 500ms
- ✅ Total response time <3000ms
- ✅ Core HugoAI cognitive enhancement applied
- ✅ Intimacy Code principles referenced
- ✅ Confidence score provided

### Test 4: Multi-Modal Authentication

```bash
# Test 1: Native account creation
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-App-ID: hugo_matchmaker_ios" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'

# Expected: 201 Created with tokens and oriva_user_id

# Test 2: Oriva SSO flow
curl http://localhost:3000/api/auth/sso?redirect_uri=hugomatchmaker://auth&state=random-state

# Expected: 302 Redirect to Oriva authentication

# Test 3: OAuth social login
curl http://localhost:3000/api/auth/oauth/authorize?client_id=hugo_matchmaker&redirect_uri=hugomatchmaker://oauth&scope=profile+apps

# Expected: 302 Redirect to Oriva OAuth consent
```

**Success Criteria**:
- ✅ Native registration creates Oriva 101 account
- ✅ SSO flow works for marketplace users
- ✅ OAuth tokens granted for social login
- ✅ All flows return same JWT structure

### Test 5: iOS Client Integration

**Swift Test Code**:
```swift
import XCTest
@testable import NetworkingKit

class HugoPlatformIntegrationTests: XCTestCase {

    func testKnowledgeSearch() async throws {
        let client = OrivaPlatformClient()
        let searchRequest = KnowledgeSearchRequest(
            query: "authentic vulnerability",
            maxResults: 5
        )

        let results = try await client.searchKnowledge(searchRequest)

        XCTAssertGreaterThan(results.results.count, 0)
        XCTAssertLessThan(results.queryTimeMs, 1000)
        XCTAssertTrue(results.results.allSatisfy { $0.relevanceScore >= 0.0 && $0.relevanceScore <= 1.0 })
    }

    func testChatStreaming() async throws {
        let client = OrivaPlatformClient()
        let chatRequest = ChatRequest(
            conversationId: UUID(),
            message: "How do I start a conversation?"
        )

        var tokens: [String] = []

        for try await token in client.sendChatMessage(chatRequest) {
            tokens.append(token)
        }

        XCTAssertGreaterThan(tokens.count, 0)
        XCTAssertTrue(tokens.joined().contains("conversation"))
    }
}
```

**Run Tests**:
```bash
cd oo-ios
swift test --filter HugoPlatformIntegrationTests
```

**Success Criteria**:
- ✅ All tests pass
- ✅ Network requests complete successfully
- ✅ Streaming responses received
- ✅ Type safety maintained throughout

### Test 6: Performance Validation

```bash
# Run performance benchmark
npm run test:performance

# Load test with k6
k6 run tests/performance/chat-load-test.js
```

**Expected Metrics**:
```
✓ API response time (p95): <3000ms
✓ Knowledge search (p95): <1000ms
✓ Concurrent users: >100 without degradation
✓ Error rate: <0.1%
```

**Success Criteria**:
- ✅ p95 response time <3s for chat
- ✅ p95 response time <1s for knowledge search
- ✅ 100+ concurrent users handled
- ✅ Error rate <0.1%

## Troubleshooting

### Common Issues

**1. Supabase Connection Failed**
```bash
# Verify Supabase credentials
supabase status

# Check .env.local has correct SUPABASE_URL and keys
# Ensure database is running
```

**2. Knowledge Search Returns Empty Results**
```bash
# Verify knowledge base seeded
psql $SUPABASE_DB_URL -c "SELECT COUNT(*) FROM knowledge_entries;"

# Check full-text search indexes
psql $SUPABASE_DB_URL -c "SELECT indexname FROM pg_indexes WHERE tablename='knowledge_entries';"

# Should see: ke_search_idx
```

**3. Streaming Response Not Working**
```bash
# Check Edge Function configuration
cat api/hugo/chat.ts | grep "runtime: 'edge'"

# Verify OpenAI API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**4. iOS Client Timeout**
```bash
# Verify local server running
curl http://localhost:3000/health

# Check NetworkingKit timeout configuration
# Default: 10s (may need to increase for development)
```

**5. Authentication Fails**
```bash
# Verify JWT secret configured
echo $JWT_SECRET

# Check Oriva API credentials
curl https://api.oriva.com/v1/health \
  -H "X-Client-ID: $ORIVA_CLIENT_ID"
```

## Next Steps

After quickstart validation:

1. **Read the Implementation Plan**: `plan.md` for architecture details
2. **Review Data Model**: `data-model.md` for complete schema
3. **Check API Contracts**: `contracts/` directory for endpoint specifications
4. **Run Full Test Suite**: `npm test` for comprehensive validation
5. **Deploy to Staging**: Follow deployment guide in `plan.md`

## Support

- **Documentation**: See `docs/active/` directory for detailed guides
- **Issues**: Create GitHub issue with `003-hugo-platform-integration` tag
- **Questions**: Contact platform team or use project Slack channel

---

**Validation Checklist**:
- [ ] All 6 test suites pass
- [ ] Performance metrics within targets
- [ ] iOS client successfully integrates
- [ ] Authentication flows working
- [ ] Knowledge search returns relevant results
- [ ] Chat responses feel instant and native

**Estimated Setup Time**: 30-45 minutes