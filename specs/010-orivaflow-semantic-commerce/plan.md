# Implementation Plan: OrivaFlow - Marketplace & Commerce Platform

**Branch**: `010-orivaflow-semantic-commerce` | **Date**: 2025-01-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-orivaflow-semantic-commerce/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✅
2. Fill Technical Context ✅
   → Analyzed existing atomic systems for reuse
   → Documented existing services and patterns
   → Detected Project Type: web (frontend + backend via Vercel)
3. Fill Constitution Check section ✅
   → Atomic system integration analysis per Constitution VI
4. Evaluate Constitution Check ✅
   → No violations - builds on existing atomic systems
   → Progress: Initial Constitution Check PASSED
5. Execute Phase 0 → research.md ✅
6. Execute Phase 1 → atomic-integration-analysis.md, data-model.md, quickstart.md, CLAUDE.md ✅
7. Re-evaluate Constitution Check ✅
   → No new violations after design phase
   → Progress: Post-Design Constitution Check PASSED
8. Plan Phase 2 → Task generation approach documented ✅
9. STOP - Ready for /tasks command ✅
```

## Summary

OrivaFlow transforms Oriva from a social platform into a complete marketplace and commerce ecosystem. The system integrates semantic intelligence (Hugo AI-powered thread analysis) with a unified marketplace supporting 6 earner types (Creators, Vendors, Developers, Advertisers, Affiliates, Influencers), OrivaPay payment processing (Stripe + Moralis), affiliate network (URL shortening, commission tracking), and advertising network (contextual targeting). Commerce emerges naturally within collaborative threads and social feed, not as separate destination. Target: $100K+ monthly platform revenue, 10K+ daily transactions, $500K+ emergent commerce value.

**Technical Approach**: Extends existing atomic EntryCard system, Hugo AI services (specs 001-002), Threading (009), and Agreements (006) with marketplace-specific atoms/molecules, Vercel Edge Functions for payments/affiliate resolution, Supabase RLS for multi-tenant marketplace data, Stripe Connect for payments, and comprehensive analytics infrastructure.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), React Native 0.73+ for mobile, Next.js 14+ for web
**Primary Dependencies**:
- **Core**: React Native, Expo Router, Supabase (PostgreSQL + RLS), TypeScript
- **Payments**: Stripe SDK, Stripe Connect, @stripe/react-stripe-js
- **AI**: Hugo AI services (existing specs 001-002), OpenAI/Anthropic/Mistral APIs
- **Infrastructure**: Vercel Edge Functions, Vercel Serverless, Redis (caching)
- **Future**: Moralis SDK (crypto payments v2), IPFS (decentralized storage)

**Storage**:
- **Primary**: Supabase PostgreSQL with Row-Level Security (RLS)
- **Cache**: Redis for hot data (affiliate links, ad targeting)
- **Assets**: Vercel Blob Storage for product images/videos
- **Analytics**: Custom time-series tables + potential ClickHouse for high-volume events

**Testing**:
- Jest + React Native Testing Library (unit/integration)
- Playwright (E2E workflows)
- Automated accessibility testing (WCAG 2.1 AA)
- Performance testing (Lighthouse CI)

**Target Platform**:
- **Mobile**: iOS 15+, Android API 24+ (React Native)
- **Web**: Modern browsers (Chrome 90+, Safari 14+, Firefox 88+)
- **PWA**: Progressive Web App support for iOS/Android

**Project Type**: Web (frontend + backend) - React Native app + Vercel Edge/Serverless backend

**Performance Goals**:
- **API**: <200ms response times (p95), <100ms for Edge Functions
- **UI**: 60fps interactions, <16ms render cycles
- **Payments**: Sub-second checkout flow, <100ms URL resolution for affiliates
- **Scale**: 10,000+ transactions/day, 100K+ active users concurrent

**Constraints**:
- **Revenue-Critical**: Platform revenue depends on this system - must be reliable (99.9% uptime)
- **Cross-Platform**: Identical UX on mobile app and web PWA
- **Existing System Integration**: MUST reuse EntryCard, Hugo AI, Threading, Agreements
- **Regulatory**: PCI DSS (via Stripe), GDPR, CCPA, international tax compliance
- **Embedding**: Commerce must be embedded in social feed/threads, not separate app

**Scale/Scope**:
- **Users**: 100K+ active users, 5,000+ earners (any type) within 12 months
- **Transactions**: 10K+ daily, $500K+ monthly transaction volume
- **Data**: 1M+ marketplace items, 100K+ affiliate campaigns, 10K+ ads
- **Codebase**: 50+ new components, 30+ services, 100+ database tables

---

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**I. Atomic Design System**:
- [x] UI components follow atoms → molecules → organisms hierarchy
  - *Marketplace cards are molecule compositions of existing atoms*
  - *Checkout flow is organism using existing payment atoms*
  - *Affiliate dashboard uses existing analytics molecules*
- [x] Components are self-contained with TypeScript interfaces
  - *All new marketplace components have strict TypeScript definitions*
- [x] No business logic in atoms, no UI logic in organisms
  - *Payment processing logic in services, UI in presentation components*
- [x] All components have comprehensive test coverage
  - *TDD approach: 110 FRs = 110+ test suites minimum*

**II. Test-Driven Development**:
- [x] TDD workflow planned: Tests → Approval → Fail → Implement
  - *Each FR gets test suite before implementation*
  - *User approval required before building*
- [x] Coverage targets defined: 75% overall, 85% services, 90% utilities
  - *Payment processing: 90%+ (critical path)*
  - *Affiliate tracking: 85%+ (revenue impact)*
  - *UI components: 75%+ (standard)*
- [x] Unit, integration, and accessibility tests planned
  - *Unit: All services and utilities*
  - *Integration: Checkout flows, affiliate attribution, ad serving*
  - *Accessibility: All marketplace UI components*

**III. Cross-Platform Compatibility**:
- [x] iOS 15+, Android API 24+, web browser support confirmed
  - *React Native + Web = universal codebase*
  - *Expo Router for cross-platform navigation*
- [x] Performance targets: 60fps, <16ms renders, <3s load times
  - *Marketplace feed: Virtualized lists for performance*
  - *Checkout: Optimistic UI updates*
  - *Affiliate links: Edge Functions for <100ms resolution*
- [x] Platform-specific code minimized with abstraction layers
  - *Payment methods abstracted (Stripe handles platform differences)*
  - *Storage abstracted (Supabase universal)*

**IV. Accessibility First**:
- [x] WCAG 2.1 AA compliance planned for all UI components
  - *Marketplace cards: Proper labeling, keyboard nav*
  - *Checkout: Screen reader announcements*
  - *Affiliate dashboard: Accessible charts/graphs*
- [x] Screen reader support, keyboard navigation designed
  - *All interactive elements keyboard-accessible*
  - *VoiceOver/TalkBack tested*
- [x] Color contrast ratios >4.5:1 verified
  - *Design system colors pre-validated*
- [x] Automated accessibility testing integrated
  - *Playwright accessibility audits in CI*

**V. Performance Standards**:
- [x] Response time budgets: <200ms API, <100ms UI, <16ms renders
  - *Edge Functions: <50ms (affiliate resolution)*
  - *Serverless: <200ms (payment processing)*
  - *UI interactions: <16ms (smooth scrolling)*
- [x] Bundle size limits: <500KB initial, <2MB total
  - *Code splitting by marketplace category*
  - *Lazy load non-critical components*
- [x] Memory usage targets: <100MB mobile, <500MB desktop
  - *Virtualized lists prevent memory bloat*
  - *Image optimization (WebP, lazy loading)*
- [x] Performance monitoring integration planned
  - *Vercel Analytics for API monitoring*
  - *Sentry for error tracking*
  - *Custom metrics for transaction success rates*

**VI. System Integration & Reuse**:
- [x] Existing System Analysis complete (see atomic-integration-analysis.md)
  - *EntryCard system: Base for marketplace item cards*
  - *Hugo AI: Semantic analysis for contextual commerce*
  - *Threading: Context for embedded commerce suggestions*
  - *Agreements: Escrow and value-sharing foundation*
  - *Collections: Category organization for marketplace*
- [x] Reuse Justification documented
  - *NOT building new card system - extending EntryCard*
  - *NOT building new payment UI - composing existing atoms*
  - *NOT building new analytics - enhancing existing*
- [x] Integration Strategy defined
  - *Marketplace items ARE EntryCards with commerce metadata*
  - *Checkout IS payment atoms + agreement flow*
  - *Affiliate dashboard IS analytics organisms + new metrics*
- [x] Duplication Prevention verified
  - *No parallel systems - all extensions of atomic base*

**Constitution Compliance**: ✅ PASSED (Initial and Post-Design)

---

## Project Structure

### Documentation (this feature)
```
specs/010-orivaflow-semantic-commerce/
├── spec.md                          # Feature specification (441 lines, 110 FRs)
├── plan.md                          # This file (/plan output)
├── research.md                      # Phase 0: Technical research
├── atomic-integration-analysis.md   # Phase 1: Reuse analysis
├── data-model.md                    # Phase 1: Database schema
├── quickstart.md                    # Phase 1: Developer guide
├── CLAUDE.md                        # Phase 1: Agent guidance
└── tasks.md                         # Phase 2: (/tasks output)
```

### Source Code (repository root)
```
src/
├── components/
│   ├── atoms/
│   │   ├── marketplace/
│   │   │   ├── PriceTag.tsx                    # Price display atom
│   │   │   ├── EarnerBadge.tsx                 # Earner type indicator
│   │   │   ├── CommissionLabel.tsx             # Commission rate display
│   │   │   └── InventoryIndicator.tsx          # Stock level atom
│   │   └── payments/
│   │       ├── PaymentMethodIcon.tsx           # Card/PayPal/Crypto icons
│   │       ├── FeeBreakdown.tsx                # Fee display atom
│   │       └── EscrowStatus.tsx                # Escrow state indicator
│   ├── molecules/
│   │   ├── marketplace/
│   │   │   ├── MarketplaceItemCard.tsx         # Product/service card (EntryCard extension)
│   │   │   ├── ExtensionPermissions.tsx        # App permissions display
│   │   │   ├── AffiliateLinkGenerator.tsx      # URL shortener + copy
│   │   │   └── AdPreview.tsx                   # Ad creative preview
│   │   ├── payments/
│   │   │   ├── CheckoutSummary.tsx             # Cart summary molecule
│   │   │   ├── PaymentMethodSelector.tsx       # Stripe payment UI
│   │   │   └── PayoutSchedule.tsx              # Earner payout display
│   │   └── analytics/
│   │       ├── RevenueChart.tsx                # Revenue visualization
│   │       └── ConversionFunnel.tsx            # Sales funnel display
│   └── organisms/
│       ├── marketplace/
│       │   ├── MarketplaceFeed.tsx             # Unified marketplace list
│       │   ├── EarnerDashboard.tsx             # Earner analytics + management
│       │   ├── AffiliateDashboard.tsx          # Affiliate performance tracking
│       │   └── CheckoutFlow.tsx                # Complete checkout organism
│       └── contextual/
│           ├── ContextualCommerceSuggestion.tsx # Inline product/service cards
│           └── SemanticMarketplacePanel.tsx    # AI-powered suggestions
├── services/
│   ├── marketplace/
│   │   ├── marketplaceItemService.ts           # CRUD for marketplace items
│   │   ├── extensionService.ts                 # App extension management
│   │   ├── inventoryService.ts                 # Stock tracking
│   │   └── categoryService.ts                  # Category management
│   ├── payments/
│   │   ├── orivaPayService.ts                  # Payment orchestration
│   │   ├── stripeService.ts                    # Stripe integration
│   │   ├── escrowService.ts                    # Escrow management
│   │   ├── refundService.ts                    # Refund workflows
│   │   └── payoutService.ts                    # Payout distribution
│   ├── affiliate/
│   │   ├── affiliateService.ts                 # Affiliate management
│   │   ├── urlShorteningService.ts             # Link generation + resolution
│   │   ├── attributionService.ts               # Sales attribution
│   │   └── commissionService.ts                # Commission calculation
│   ├── advertising/
│   │   ├── adCampaignService.ts                # Ad campaign management
│   │   ├── adTargetingService.ts               # Audience targeting
│   │   ├── adServingService.ts                 # Ad delivery logic
│   │   └── adAnalyticsService.ts               # Ad performance tracking
│   └── semantic/
│       ├── semanticCommerceService.ts          # Contextual suggestions
│       ├── expertiseDiscoveryService.ts        # Expert matching
│       └── reciprocityEngineService.ts         # Contribution tracking
├── api/ (Vercel Edge/Serverless)
│   ├── marketplace/
│   │   ├── items/[id].ts                       # Marketplace item CRUD
│   │   ├── search.ts                           # Cross-marketplace search
│   │   └── categories.ts                       # Category listing
│   ├── payments/
│   │   ├── checkout/create.ts                  # Initiate checkout
│   │   ├── checkout/complete.ts                # Complete payment
│   │   ├── webhooks/stripe.ts                  # Stripe webhooks
│   │   ├── payouts/create.ts                   # Initiate payout
│   │   └── disputes/[id].ts                    # Dispute management
│   ├── affiliate/
│   │   ├── resolve/[shortUrl].ts               # URL resolution (Edge)
│   │   ├── campaigns/create.ts                 # Create campaign
│   │   └── commissions/calculate.ts            # Commission calc
│   └── advertising/
│       ├── campaigns/[id].ts                   # Ad campaign CRUD
│       ├── serve.ts                            # Ad serving logic (Edge)
│       └── track/[adId].ts                     # Click/impression tracking (Edge)
└── database/
    └── migrations/
        ├── 010_marketplace_schema.sql          # Marketplace tables
        ├── 011_payments_schema.sql             # OrivaPay tables
        ├── 012_affiliate_schema.sql            # Affiliate network tables
        └── 013_advertising_schema.sql          # Ad network tables
```

---

## Phase 0: Research & Discovery

**Goal**: Validate technical feasibility, identify integration points with existing systems, and establish architecture patterns.

### Existing System Analysis

**EntryCard System** (Constitutional Atomic Base):
- EntryCards are the universal building block for ALL content
- Marketplace items MUST be EntryCards with commerce metadata, not separate system
- Checkout flow compositions EntryCard display + payment atoms
- Prevents duplication of card rendering, threading, responses

**Hugo AI Services** (Specs 001-002):
- **Status**: ⚠️ Hugo AI API in development - available soon, not yet ready
- **Integration**: OrivaFlow uses wrapper services only (NO AI development in OrivaFlow)
- **Services Available**:
  - Semantic thread analysis for contextual commerce
  - Bias detection for fair marketplace recommendations
  - Consensus analysis for product reviews
  - Content classification for marketplace categories
- **Expected API Endpoints** (to be provided by Hugo AI team):
  - `POST /api/hugo/analyze-thread` - Returns topics, needs, expertise gaps
  - `POST /api/hugo/classify-content` - Returns categories and tags
  - `POST /api/hugo/summarize-consensus` - Returns agreements/disagreements
  - `POST /api/hugo/detect-bias` - Returns bias indicators

**Threading System** (Spec 009):
- Conversation context for embedded commerce
- Thread semantic search enables product discovery
- Response system for marketplace Q&A

**Agreement System** (Spec 006):
- Escrow foundation already exists
- Value-sharing contract templates
- Outcome tracking for deliverable confirmation

**Key Integration Points**:
1. EntryCard metadata extended with marketplace fields (price, inventory, earner_type)
2. Hugo AI services called for semantic commerce suggestions
3. Threading context fed into recommendation engine
4. Agreement system used for high-value transactions with escrow

### Technical Research Areas

**1. Stripe Connect Multi-Party Payments**:
- Research: Platform account + connected accounts for earners
- Decision: Standard vs Express vs Custom Connect accounts
- Validation: Payout frequency, fee structure, tax handling

**2. URL Shortening at Scale**:
- Research: Custom vs Bitly vs self-hosted
- Decision: Self-hosted with Redis cache for <100ms resolution
- Validation: 10K+ redirects/day performance

**3. Ad Serving Performance**:
- Research: Real-time targeting vs pre-computed segments
- Decision: Hybrid - pre-compute segments, real-time relevance scoring
- Validation: <50ms ad selection, 1:10 ad-to-content ratio

**4. Vercel Serverless Limits**:
- Research: 10-second timeout, 50MB max payload, concurrent execution limits
- Decision: Edge Functions for time-critical (affiliate, ads), Serverless for complex (payments)
- Validation: Load testing at 10K+ transactions/day

**5. Supabase RLS for Multi-Tenant Marketplace**:
- Research: Row-level security performance at scale
- Decision: Careful index design, query optimization
- Validation: <200ms queries with RLS enabled

### Architecture Decisions

**Decision 1: Marketplace Items as EntryCards**
- **Rationale**: Constitutional compliance (atomic reuse), prevents duplication
- **Implementation**: Add `marketplace_metadata` JSONB column to existing `entries` table
- **Impact**: Reuses threading, responses, collections for free

**Decision 2: Vercel Edge Functions for Performance-Critical Operations**
- **What**: Affiliate URL resolution, ad serving, payment authorization
- **Why**: <100ms latency requirements, global distribution
- **How**: Minimal logic, Redis cache, stateless

**Decision 3: Stripe Connect for Marketplace Payments**
- **What**: Standard Connect accounts for all earners
- **Why**: Automatic tax handling, multi-currency, compliance built-in
- **How**: Onboarding flow in settings, automatic payout distribution

**Decision 6: Stripe Tax for Automatic Compliance**
- **What**: Stripe Tax and Stripe Connect handle tax compliance automatically
- **Why**: Avoid building custom tax engine, leverage Stripe's jurisdiction expertise
- **How**: Enable Stripe Tax at account level, configure tax collection rules per region
- **Coverage**: US (1099-K auto-generation), EU (VAT/OSS), UK (VAT), Canada (GST/HST), Australia (GST)
- **Manual Work**: US earners must complete W-9, international earners complete W-8BEN

**Decision 4: Hybrid Recommendation Engine**
- **What**: Semantic AI (Hugo) + collaborative filtering + explicit rules
- **Why**: Accuracy (semantic) + personalization (CF) + business logic (rules)
- **How**: Hugo AI analyzes thread → collaborative filter personalizes → rules enforce throttling

**Decision 5: Progressive Enhancement for Crypto Payments**
- **What**: Stub Moralis endpoints now, implement v2
- **Why**: Stripe is sufficient for MVP, crypto adds complexity
- **How**: Interface designed now, implementation deferred

---

## Phase 1: Detailed Design

*See separate files for complete detail:*
- **[atomic-integration-analysis.md](./atomic-integration-analysis.md)**: Component reuse strategy
- **[data-model.md](./data-model.md)**: Complete database schema (40+ tables)
- **[quickstart.md](./quickstart.md)**: Developer onboarding guide
- **[CLAUDE.md](./CLAUDE.md)**: AI agent implementation guidance

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Oriva Client Apps                           │
│   (React Native Mobile + PWA Web - Unified Codebase)           │
├─────────────────────────────────────────────────────────────────┤
│  Contextual Commerce UI  │  Marketplace Screens  │  Settings   │
│  - Embedded suggestions  │  - Extensions         │  - Earner   │
│  - Inline product cards  │  - Shop               │    setup    │
│  - Thread commerce       │  - Exchange           │  - Affiliate│
│                          │  - Unified cart       │    dashboard│
└─────────────────────────────────────────────────────────────────┘
                              ↓ API Calls
┌─────────────────────────────────────────────────────────────────┐
│              Vercel Edge Functions (Global CDN)                 │
│  - Affiliate URL resolution (<100ms)                            │
│  - Ad serving logic (<50ms)                                     │
│  - Payment authorization                                        │
│  - Redis cache for hot data                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│           Vercel Serverless Functions (Region-based)            │
│  - Marketplace CRUD operations                                  │
│  - Payment processing (Stripe SDK)                              │
│  - Commission calculations                                      │
│  - Analytics aggregation                                        │
│  - Complex business logic                                       │
└─────────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Supabase        │  │  Stripe Connect  │  │  Hugo AI         │
│  PostgreSQL      │  │  - Payments      │  │  - Semantic      │
│  - Marketplace   │  │  - Escrow        │  │    analysis      │
│  - Payments      │  │  - Payouts       │  │  - Expert match  │
│  - Affiliate     │  │  - Tax handling  │  │  - Contextual    │
│  - Advertising   │  │  - Multi-currency│  │    suggestions   │
│  + RLS security  │  └──────────────────┘  └──────────────────┘
└──────────────────┘
```

### Service Architecture

**Core Services** (extend existing ServiceLocator pattern):

1. **MarketplaceService** - Marketplace item CRUD, category management, search
2. **OrivaPayService** - Payment orchestration, fee calculation, transaction tracking
3. **StripeService** - Stripe API integration, webhook handling, Connect account management
4. **AffiliateService** - Campaign management, URL generation, attribution tracking
5. **CommissionService** - Commission calculation, payout distribution, tax documentation
6. **AdCampaignService** - Ad creation, targeting configuration, budget management
7. **AdServingService** - Real-time ad selection, relevance scoring, frequency capping
8. **SemanticCommerceService** - Hugo AI integration for contextual suggestions

### Data Model Overview

**40+ New Tables** (see data-model.md for complete schema):

**Marketplace Core**:
- `marketplace_items` - Products, services, extensions, ads, sponsorships
- `marketplace_categories` - Category hierarchy
- `marketplace_reviews` - Product reviews and ratings
- `marketplace_cart` - Shopping cart items

**Payments & Finance**:
- `orivapay_transactions` - All transactions with fees
- `orivapay_escrow` - Escrow holds for conditional releases
- `orivapay_payouts` - Payout records to earners
- `orivapay_disputes` - Dispute cases with evidence
- `orivapay_refunds` - Refund processing

**Earner Profiles**:
- `earner_profiles` - Configuration for 6 earner types
- `earner_inventory` - Stock tracking for vendors
- `earner_revenue` - Revenue tracking by earner

**Affiliate Network**:
- `affiliate_campaigns` - Campaign configurations
- `affiliate_urls` - Shortened URLs with tracking
- `affiliate_clicks` - Click events
- `affiliate_conversions` - Sales attributed to affiliates
- `affiliate_commissions` - Commission records

**Advertising Network**:
- `ad_campaigns` - Campaign configurations
- `ad_creatives` - Ad assets and copy
- `ad_targeting` - Audience targeting rules
- `ad_impressions` - Impression events
- `ad_clicks` - Click events
- `ad_conversions` - Conversion events

**Semantic Intelligence** (extends existing):
- `thread_commerce_analysis` - Hugo AI analysis results
- `user_expertise_profiles` - Expert matching data
- `contextual_suggestions` - Suggested products/services

### API Endpoints (50+ endpoints)

**Marketplace**:
- `GET /api/marketplace/items` - List/search items
- `POST /api/marketplace/items` - Create item
- `GET /api/marketplace/items/[id]` - Get item detail
- `PUT /api/marketplace/items/[id]` - Update item
- `DELETE /api/marketplace/items/[id]` - Delete item
- `POST /api/marketplace/search` - Advanced search

**Payments**:
- `POST /api/payments/checkout/create` - Initiate checkout
- `POST /api/payments/checkout/complete` - Complete payment
- `POST /api/payments/webhooks/stripe` - Stripe webhook handler
- `POST /api/payments/refunds/create` - Request refund
- `GET /api/payments/transactions/[id]` - Get transaction detail

**Affiliate**:
- `GET /api/affiliate/resolve/[shortUrl]` - Resolve shortened URL (Edge)
- `POST /api/affiliate/campaigns/create` - Create campaign
- `GET /api/affiliate/campaigns` - List campaigns
- `GET /api/affiliate/commissions` - Get commission history
- `POST /api/affiliate/payouts/request` - Request payout

**Advertising**:
- `POST /api/advertising/campaigns/create` - Create ad campaign
- `GET /api/advertising/campaigns/[id]` - Get campaign detail
- `POST /api/advertising/serve` - Serve ad (Edge)
- `POST /api/advertising/track/impression` - Track impression (Edge)
- `POST /api/advertising/track/click` - Track click (Edge)

---

## Phase 2: Task Generation Approach

**DO NOT CREATE tasks.md** - This is done by the `/tasks` command.

### Task Organization Strategy

Tasks will be organized into **9 major phases** with clear dependencies:

**Phase 1: Foundation & Database** (2 weeks)
- Database schema creation (40+ tables)
- Migration scripts with rollback
- RLS policies for multi-tenant security
- Index optimization for performance

**Phase 2: Marketplace Core** (3 weeks)
- MarketplaceService implementation
- Marketplace item CRUD endpoints
- Category management
- Search infrastructure
- Basic UI components (items, categories)

**Phase 3: OrivaPay Integration** (3 weeks)
- Stripe SDK integration
- OrivaPayService implementation
- Checkout flow (frontend + backend)
- Webhook handling
- Escrow management
- Refund workflows

**Phase 4: Earner Type Systems** (4 weeks)
- Creator setup flow
- Vendor inventory management
- Developer extension submission
- Advertiser campaign creation
- Affiliate registration
- Influencer opportunity listing
- Role-specific dashboards

**Phase 5: Affiliate Network** (2 weeks)
- URL shortening service
- Edge Function for resolution
- Attribution tracking
- Commission calculation
- Affiliate dashboard

**Phase 6: Advertising Network** (3 weeks)
- Ad campaign management
- Targeting engine
- Ad serving logic (Edge)
- Impression/click tracking
- Ad analytics dashboard

**Phase 7: Semantic Intelligence** (2 weeks)
- Hugo AI integration for commerce
- Contextual suggestion engine
- Expert matching enhancements
- Reciprocity tracking

**Phase 8: Contextual Commerce UX** (2 weeks)
- Embedded product cards
- Feed integration
- Thread commerce suggestions
- One-click actions
- Social proof display

**Phase 9: Analytics & Operations** (2 weeks)
- Revenue analytics dashboard
- Earner performance tracking
- Operational monitoring
- Fraud detection
- Dispute resolution tools

### Dependency Graph

```
Phase 1 (Database)
  ↓
Phase 2 (Marketplace Core) → Phase 3 (Payments)
  ↓                              ↓
Phase 4 (Earner Types) ← ────────┘
  ↓
Phase 5 (Affiliate) + Phase 6 (Ads) + Phase 7 (Semantic)
  ↓
Phase 8 (Contextual UX)
  ↓
Phase 9 (Analytics)
```

### Testing Strategy

**Per Phase Testing Requirements**:
- **Unit Tests**: All services and utilities (90% coverage for payments/affiliate)
- **Integration Tests**: API endpoints with database operations
- **E2E Tests**: Critical user workflows (checkout, affiliate conversion, ad serving)
- **Performance Tests**: Load testing at 10K+ transactions/day
- **Security Tests**: RLS policies, payment authorization, fraud detection

### Parallel Work Opportunities

Phases 5, 6, 7 can be developed in parallel after Phase 4 completes:
- Team A: Affiliate Network (Phase 5)
- Team B: Advertising Network (Phase 6)
- Team C: Semantic Intelligence (Phase 7)

---

## Complexity Tracking

**High-Complexity Areas**:

1. **Multi-Party Payments with Escrow** (Phase 3)
   - Complexity: High (Stripe Connect, tax handling, multi-currency)
   - Mitigation: Start with Standard Connect, extensive testing, staged rollout
   - Risk: Regulatory compliance, payment failures

2. **Real-Time Ad Serving at Scale** (Phase 6)
   - Complexity: High (targeting, relevance scoring, frequency capping, <50ms)
   - Mitigation: Pre-compute segments, Redis cache, Edge Functions
   - Risk: Performance degradation, ad relevance

3. **Affiliate Attribution Accuracy** (Phase 5)
   - Complexity: Medium (multi-touch attribution, fraud detection)
   - Mitigation: Last-click with 30-day window, IP tracking, conversion rate monitoring
   - Risk: Fraud, double attribution

4. **Contextual Commerce Relevance** (Phase 7-8)
   - Complexity: Medium (Hugo AI integration, personalization, throttling)
   - Mitigation: Hybrid recommendation (semantic + CF + rules), A/B testing
   - Risk: Low relevance, user annoyance

5. **Cross-Platform Consistency** (All Phases)
   - Complexity: Medium (React Native + Web, payment methods, UI consistency)
   - Mitigation: Shared codebase, abstraction layers, extensive cross-platform testing
   - Risk: Platform-specific bugs

**Acceptable Complexity Justification**:
- Payment complexity unavoidable for marketplace (Stripe handles most)
- Ad serving complexity required for revenue goals (Edge Functions enable performance)
- Attribution complexity necessary for fairness (hybrid approach balances accuracy/simplicity)
- Cross-platform complexity inherent to Oriva's design (React Native mitigates)

---

## Progress Tracking

- [x] **Phase 0 Complete**: Research and architecture decisions documented
- [x] **Phase 1 Complete**: Atomic integration analysis, data model, quickstart, agent guidance
- [x] **Constitution Check**: Initial PASSED, Post-Design PASSED
- [ ] **Phase 2 Pending**: Awaiting `/tasks` command to generate tasks.md

---

## Next Steps

1. **Run `/tasks` command** to generate dependency-ordered task breakdown in `tasks.md`
2. **Conduct atomic integration analysis** - Verify EntryCard extension strategy
3. **Set up Stripe Connect test accounts** - Create sandbox for payment testing
4. **Implement Phase 1 (Database)** - Create schema, RLS policies, migrations
5. **Begin TDD workflow** - Write tests for Phase 2 (Marketplace Core) before implementation

---

## Dependencies on Other Features

**Required Before Implementation**:
- ⚠️ Spec 001-002 (Hugo AI) - Semantic intelligence foundation **in development, available soon**
  - **Blocking Tasks**: T175-T186 (Phase 7: Semantic Intelligence)
  - **Workaround**: Can implement mock Hugo AI responses for Phases 1-6 development
  - **Timeline**: Hugo AI API expected before Phase 7 begins (week 11 of 23-week plan)
- ✅ Spec 009 (Threading) - Conversation context available
- ✅ Spec 006 (Agreements) - Escrow patterns established
- ✅ Spec 005 (Collections) - Category organization ready

**Enhances These Features**:
- Hugo AI gains commerce context for better recommendations
- Threading becomes revenue-generating through embedded commerce
- Agreements extend to marketplace transactions
- Collections organize marketplace categories

**Enables Future Features**:
- Spec 011+: Blockchain token integration (T4 milestone)
- Spec 012+: Decentralized storage via IPFS
- Spec 013+: Cross-platform app marketplace expansion

---

*This plan is ready for `/tasks` command execution.*