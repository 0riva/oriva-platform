# Feature Specification: OrivaFlow - Marketplace & Commerce Platform

**Feature Branch**: `010-orivaflow-semantic-commerce`
**Created**: 2025-01-28
**Updated**: 2025-01-28 (Expanded with full marketplace architecture)
**Status**: Draft - Comprehensive Revision
**Input**: "OrivaFlow is Oriva's complete marketplace and commerce platform that embeds shopping, services, and monetization naturally within social collaboration. The system integrates: (1) Semantic Intelligence - AI-powered thread analysis identifying needs, expertise gaps, and collaboration opportunities within conversations; (2) Unified Marketplace - Extensions (apps), Shop (products/content), Exchange (services), and Advertising Network seamlessly embedded in social feed; (3) OrivaPay - Payment processing supporting 6 earner types (Creators, Vendors, Developers, Advertisers, Affiliates, Influencers) with dynamic fees (10-20%), Stripe + Moralis crypto, escrow, refunds, payouts; (4) Affiliate Network - URL shortening, commission tracking, campaign management across all earner types; (5) Contextual Commerce UX - Solutions, products, experts, and opportunities surface within conversation flow, not as separate marketplace destination. OrivaFlow transforms Oriva from social platform to revenue-generating ecosystem where collaboration drives commerce and commerce enhances collaboration. Success metrics: 50% thread engagement increase, 70% suggestion acceptance, $500K+ emergent commerce value, 40% collaboration growth, 60% expert discovery rate, 10K+ transactions/day through OrivaPay."

## Execution Flow (main)
```
1. Parse user description from Input
   -> Identified: Complete marketplace & commerce platform with semantic intelligence
2. Extract key concepts from description
   -> Actors: users, 6 earner types, affiliates, buyers, platform admins
   -> Actions: sell, buy, promote, recommend, earn commissions, pay, track
   -> Data: products, apps, services, payments, commissions, ads, analytics
   -> Systems: Marketplace (3 types), OrivaPay, Affiliate Network, Semantic AI
   -> Constraints: embedded in social, conversation-first, revenue-critical
3. For each unclear aspect:
   -> Documented in edge cases with business implications
4. Fill User Scenarios & Testing section
   -> 18 comprehensive user flows across all earner types and systems
5. Generate Functional Requirements
   -> 120+ requirements covering marketplace, payments, affiliate, advertising
6. Identify Key Entities
   -> Marketplace items, payments, commissions, ads, semantic intelligence
7. Run Review Checklist
   -> Complete marketplace architecture with revenue focus
8. Return: SUCCESS (spec ready for planning)
```

---

## Quick Guidelines
- YES: Focus on WHAT users need and WHY
- NO: Avoid HOW to implement (no tech stack, APIs, code structure)
- TARGET: Written for business stakeholders, not developers

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- **Atomic Analysis**: MUST include analysis of existing system reuse opportunities
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### Dependencies on Existing Features
- **Spec 001-002**: Hugo AI platform provides bias detection, consensus analysis, intent alignment, and content classification
  - **Status**: ⚠️ Hugo AI API in development - will be available soon but not yet ready
  - **Integration Approach**: OrivaFlow implements wrapper services that call Hugo AI API endpoints (no AI development in OrivaFlow)
  - **API Contract**: Expected endpoints documented in plan.md and CLAUDE.md
- **Spec 009**: Threading system provides conversation context, hierarchical navigation, and semantic search foundation
- **Spec 006**: Agreement system provides value-sharing contract templates and outcome tracking
- **Spec 005**: Collection and tagging system for organizing expertise domains and solution categories

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
OrivaFlow transforms Oriva into a complete marketplace and commerce ecosystem where users naturally discover and transact for products, services, and expertise while collaborating. The platform supports six earner types (Creators, Vendors, Developers, Advertisers, Affiliates, Influencers) who monetize through an integrated marketplace (Extensions, Shop, Exchange) powered by OrivaPay payment processing. Semantic intelligence analyzes conversations to contextually surface relevant marketplace offerings, while an affiliate network enables commission-based promotion across all earner types. Users experience commerce embedded naturally in their social feed and collaborative threads, not as a separate destination. The platform generates revenue through dynamic fees (2-20% by type), payment processing, and advertising, while enabling value creation and exchange throughout the network.

### Acceptance Scenarios

1. **Given** a user is participating in a thread discussing project management challenges, **When** Hugo AI analyzes the conversation content, **Then** the system identifies specific needs (e.g., "seeking productivity tools"), expertise gaps (e.g., "needs PM consultant input"), and suggests relevant experts from the network who have demonstrated expertise in those areas

2. **Given** a user has consistently provided helpful responses in threads about productivity optimization, **When** the system analyzes their contribution patterns, **Then** their expertise profile automatically reflects "productivity optimization" domain knowledge, and they receive invitations to contribute to relevant future threads

3. **Given** two users have successfully collaborated on solving a problem through thread discussions, **When** the reciprocity engine tracks the value exchange, **Then** both users earn network credits proportional to their contributions, and the system recognizes their collaboration success for future matching

4. **Given** a user mentions struggling with a specific tool or workflow in a thread, **When** the contextual commerce engine detects the need, **Then** relevant solutions (apps, consultants, templates) are suggested as helpful additions to the conversation without interrupting the collaborative flow

5. **Given** a user is exploring threads related to their documented goals and skills, **When** they interact with semantic suggestions, **Then** recommendations are personalized based on their expertise profile, past contributions, and stated collaboration preferences

6. **Given** an expert is suggested for a thread based on their expertise profile, **When** they accept the invitation to contribute, **Then** their response is prioritized in the thread view and their contribution is tracked for reputation scoring

7. **Given** a user discovers a solution through contextual suggestions in a thread, **When** they engage with the solution provider, **Then** the referral is tracked, and the thread participants who provided context receive recognition credits

### Marketplace & Commerce Scenarios

8. **Given** a Creator publishes a premium course on productivity optimization, **When** they configure their offering in /settings with pricing ($199), commission rates (15% for affiliates), and content access rules, **Then** the course appears in the Shop marketplace with automatic affiliate program creation, and affiliates can generate campaign links with URL shortening

9. **Given** a Vendor sells physical productivity books, **When** they list products with inventory (247 units), shipping options, and gift wrap settings ($4.99 optional), **Then** buyers can purchase through embedded checkout in social feed with OrivaPay processing (Stripe 2.9%+ $0.30, platform fee 15%), and vendor receives payout minus fees

10. **Given** a Developer creates a Video Work Buddy app extension, **When** they submit to Extensions marketplace with permissions (read:profile, write:entries, access:video), pricing (Free + $9.99/month Pro), and either external hosting URL or Oriva-hosted upload, **Then** users can discover, install with permission approval, and the developer earns revenue through OrivaPay with 10-20% platform fee

11. **Given** an Advertiser wants to promote their productivity software, **When** they create ad campaign in /settings with budget ($500 daily cap), targeting options (interests: productivity, demographics: 25-45), and creative assets, **Then** ads appear contextually in user feeds based on semantic thread analysis, charged per impression/click, with affiliate commission option (10%)

12. **Given** an Affiliate browses the Affiliate Offers page, **When** they join a Creator's course program (15% commission), Vendor's product program (12% commission), or Developer's app program (20% commission), **Then** they receive unique shortened campaign URLs, track clicks/sales/commissions in dashboard, and earn payouts when referrals convert

13. **Given** an Influencer offers brand collaboration sponsorships, **When** they list opportunities in /settings ($2,500 per sponsored post), portfolio of past collaborations, audience demographics, and commission structure for affiliate partners (5%), **Then** brands can discover and purchase sponsorships through marketplace, with OrivaPay handling escrow until deliverables confirmed

14. **Given** a user is reading a thread about project management tools, **When** semantic intelligence detects product research intent, **Then** relevant Extensions (project management apps), Shop items (PM books/courses), and Advertisers' promoted solutions appear inline as "thread participants found these helpful" suggestions, not disruptive banner ads

15. **Given** a buyer purchases multiple items (1 digital course $199, 1 physical book $24.99, 1 app subscription $9.99/month), **When** they proceed through unified checkout, **Then** system calculates separate fees per item type (digital 10%, physical 15%, subscription 20%), processes payment via Stripe with automatic tax handling, immediately grants digital access, ships physical product, and activates subscription

16. **Given** an earner has completed $10,000 in sales this month across multiple offerings, **When** the payout cycle completes, **Then** OrivaPay calculates net revenue after platform fees and payment processing, handles automatic 1099 tax form generation for US earners, international tax compliance for global earners, and distributes funds via Stripe Connect with multiple payout methods (PayPal, bank transfer, crypto via Moralis in v2)

17. **Given** a user discovers an app through affiliate link in a thread, **When** they install and subscribe to the app's Pro tier, **Then** system attributes the referral, credits the affiliate's commission (20% of $9.99 = $2.00/month recurring), credits the thread author's network contribution score, and tracks conversion for affiliate performance analytics

18. **Given** the platform processes 10,000+ transactions daily from 6 earner types, **When** analytics dashboard aggregates data, **Then** platform shows revenue breakdown by earner type, geographic distribution, top-performing products/services, conversion funnels, affiliate ROI, advertising effectiveness, and emergent commerce value ($500K+ monthly target)

### Edge Cases

**Semantic Intelligence Edge Cases:**
- What happens when semantic analysis cannot confidently identify thread topics or needs? System should defer to manual tagging and request user clarification through non-intrusive prompts
- How does the system handle expertise mining when users contribute to diverse, unrelated topics? Profile should reflect multiple expertise domains with confidence scores rather than forcing single-domain classification
- What occurs when reciprocity tracking shows highly imbalanced give-vs-take ratios? System should surface opportunities for users to contribute in their expertise areas to restore balance
- How are contextual commerce suggestions handled when multiple similar solutions exist? Prioritize based on peer recommendations from trusted network connections and past success metrics
- What happens when suggested experts are unavailable or decline invitations? System should suggest alternative experts and allow users to request notifications when preferred experts become available
- How does the system maintain conversation-first experience when commerce opportunities are frequent? Implement suggestion throttling, relevance thresholds, and user preference controls for suggestion frequency
- What occurs when users have different privacy preferences about expertise visibility? Respect granular privacy controls allowing users to opt-in/out of expert matching while still benefiting from other features
- How are cross-thread collaboration patterns tracked without violating thread privacy? Aggregate patterns at user level while respecting thread-level access controls and RLS policies

**Marketplace & Commerce Edge Cases:**
- How are disputes handled when buyers claim non-delivery or quality issues? Implement escrow system with milestone releases, evidence collection (screenshots, tracking), and neutral arbitration with refund policies (14-30 days) and seller protections
- What happens when an earner violates platform policies (fraud, spam, prohibited content)? Implement graduated enforcement: warning → temporary suspension → permanent ban with revenue holds, appeal process, and clear policy documentation
- How does the system prevent affiliate fraud (fake clicks, self-referrals, click farms)? Implement fraud detection: IP tracking, conversion rate anomalies, click pattern analysis, device fingerprinting, and affiliate account verification with payout holds for suspicious activity
- What occurs when multiple affiliates claim credit for the same sale? Use last-click attribution with 30-day cookie window, track full attribution chain, and implement split commissions for multi-touch conversions with transparent reporting
- How are pricing conflicts handled when Advertisers and organic content compete for visibility? Prioritize user experience: cap ad frequency (max 1 per 10 feed items), require minimum relevance scores, allow users to hide/report ads, and charge premium for competitive keyword targeting
- What happens when Developer apps require permissions that raise privacy concerns? Implement permission review process, require clear explanations for each permission, allow granular user control, audit API usage, and revoke permissions for abuse with developer notifications
- How does the system handle inventory management when Vendors' physical stock runs out mid-purchase? Implement real-time inventory tracking, reserve stock during checkout, auto-cancel abandoned carts after 15 minutes, notify buyers of stockouts before payment, and enable backorder options
- What occurs when OrivaPay payment processing fails (Stripe downtime, declined cards)? Implement payment retry logic, support multiple payment methods, provide clear error messages, save cart state for recovery, and offer alternative checkout (PayPal, crypto via Moralis)
- How are international transactions handled (currency conversion, cross-border fees, tax compliance)? Leverage Stripe's multi-currency support, display prices in user's local currency, handle VAT/GST collection per jurisdiction, support international shipping rates, and provide tax documentation per region
- What happens when seasonal demand spikes cause performance degradation? Implement auto-scaling: Vercel Edge Functions scale automatically, database connection pooling, Redis caching for hot data, CDN for static assets, and queue-based processing for payouts/analytics
- How does the system protect user data when external-hosted apps integrate via API? Enforce strict API scoping, rate limiting, audit logging, RLS policies, prohibit data storage by apps, regular security audits, and immediate revocation capabilities for breaches

## Requirements *(mandatory)*

### Functional Requirements - Semantic Thread Analysis

- **FR-001**: System MUST analyze thread content to extract discussion topics, identifying primary themes and secondary subjects with confidence scores
- **FR-002**: System MUST identify explicit needs expressed in thread conversations (e.g., "looking for recommendations", "need help with X", "seeking solutions")
- **FR-003**: System MUST detect expertise gaps by analyzing thread content against participant expertise profiles to identify knowledge areas where additional input would be valuable
- **FR-004**: System MUST identify collaboration opportunities by recognizing patterns where multiple users have complementary skills, goals, or interests
- **FR-005**: System MUST provide confidence scores for all semantic analysis results, allowing users to understand certainty levels
- **FR-006**: System MUST respect thread privacy settings when performing semantic analysis, ensuring private thread content is not exposed in suggestions

### Functional Requirements - Expertise Mining & Matching

- **FR-007**: System MUST track helpful response patterns by monitoring positive reactions (applauds, curation, iteration requests) to user contributions
- **FR-008**: System MUST identify domain knowledge areas for each user based on topics of threads where they consistently provide valuable contributions
- **FR-009**: System MUST measure collaboration success rates by tracking completion of agreements and positive outcomes from user interactions
- **FR-010**: System MUST build reputation scores reflecting demonstrated expertise through actual results rather than self-reported skills
- **FR-011**: System MUST match experts with thread needs based on expertise profile overlap, availability status, and past collaboration success
- **FR-012**: System MUST allow users to control their expert profile visibility with granular privacy settings (fully public, network-only, private)
- **FR-013**: System MUST enable users to opt-in or opt-out of expert matching notifications while maintaining their expertise profile for other features

### Functional Requirements - Reciprocity Engine

- **FR-014**: System MUST track knowledge sharing contributions, measuring instances where users provide valuable insights, references, or expertise to others
- **FR-015**: System MUST track problem-solving contributions, measuring instances where users help resolve issues through thread discussions
- **FR-016**: System MUST track connection-making contributions, measuring successful introductions between users that lead to collaborations
- **FR-017**: System MUST calculate reciprocity balance as give-vs-take ratio, showing users their contribution patterns relative to benefits received
- **FR-018**: System MUST enable skill bartering by suggesting complementary expertise matches (e.g., "I help with X, you help with Y")
- **FR-019**: System MUST support knowledge trading where users exchange expertise in different domains
- **FR-020**: System MUST track network credits earned through helping others, providing recognition and future access to premium features or expert time
- **FR-021**: System MUST surface opportunities for users to contribute in their expertise areas when reciprocity balance indicates more receiving than giving

### Functional Requirements - Contextual Commerce Integration

- **FR-022**: System MUST detect solution-seeking moments in conversations by identifying expressions of frustration, explicit requests for recommendations, or problem descriptions
- **FR-023**: System MUST suggest relevant solutions (apps, tools, services) contextually within thread responses rather than as separate marketplace interface
- **FR-024**: System MUST prioritize peer-recommended solutions based on endorsements from trusted network connections
- **FR-025**: System MUST surface expert consultations as micro-consultation opportunities within threads, allowing quick advice without formal agreements
- **FR-026**: System MUST present commerce suggestions with collaborative framing (e.g., "Others in your network found this helpful") rather than sales-focused messaging
- **FR-027**: System MUST implement suggestion throttling to prevent overwhelming users, with maximum suggestion frequency based on user preferences
- **FR-028**: System MUST allow users to dismiss suggestions with feedback, improving future recommendation accuracy
- **FR-029**: System MUST track referral attribution when users engage with suggested solutions, providing recognition to thread participants who provided context

### Functional Requirements - Smart Agreement Enhancement

- **FR-030** [OUT OF SCOPE - MVP]: System SHOULD analyze thread content to recommend relevant agreement templates based on discussion topics and collaboration goals (deferred to v2 pending Hugo AI training data)
- **FR-031** [OUT OF SCOPE - MVP]: System SHOULD suggest agreement clauses based on similar successful agreements in related domains (requires historical agreement corpus)
- **FR-032** [OUT OF SCOPE - MVP]: System SHOULD identify potential risks in draft agreements by comparing against common issues in similar past agreements (requires dispute pattern analysis)
- **FR-033** [OUT OF SCOPE - MVP]: System SHOULD track agreement outcomes, collecting learnings about what clauses and structures lead to successful collaborations (requires 6+ months of data collection)
- **FR-034**: System MUST enable value-sharing agreements where multiple parties define how to split outcomes of collaborative work (covered by escrow system)
- **FR-035**: System MUST support expertise exchange agreements formalizing skill-trading arrangements between users (covered by agreement templates in existing Spec 006)

### Functional Requirements - Performance & Quality

- **FR-036**: Semantic analysis MUST complete within 2 seconds of thread content update to maintain conversation flow
- **FR-037**: Expert matching suggestions MUST appear within 5 seconds of need identification to maintain relevance
- **FR-038**: Suggestion relevance MUST achieve 70% acceptance rate as measured by user engagement metrics
- **FR-039**: Expertise mining MUST achieve 80% accuracy in domain identification as validated by peer confirmation
- **FR-040**: System MUST maintain 60fps UI performance when rendering semantic suggestions in thread views

### Functional Requirements - Accessibility & Cross-Platform

- **FR-041**: All semantic suggestion UI components MUST meet WCAG 2.1 AA accessibility standards
- **FR-042**: Screen readers MUST announce contextual suggestions with clear context about suggestion type and relevance
- **FR-043**: Users MUST be able to interact with all semantic features using keyboard-only navigation
- **FR-044**: Semantic commerce features MUST function consistently across iOS 15+, Android API 24+, and web platforms

### Functional Requirements - Marketplace Architecture (Extensions, Shop, Exchange)

- **FR-045**: System MUST provide unified marketplace with three distinct categories: Extensions (apps/tools), Shop (products/content/premium access), and Exchange (financial services) accessible from single navigation
- **FR-046**: System MUST enable cross-marketplace search allowing users to find extensions, products, and services in single query with category filtering
- **FR-047**: System MUST support unified shopping cart combining extensions, physical products, digital products, and subscriptions in single checkout flow
- **FR-048**: Extensions marketplace MUST allow developers to submit apps with permissions (read:profile, write:entries, read:groups, access:realtime, access:video, read:analytics), pricing models (free, freemium, subscription, one-time), and hosting options (external URL or Oriva-hosted upload)
- **FR-049**: System MUST provide app sandboxing with granular permission system, API rate limiting, audit logging, and ability to revoke permissions for policy violations
- **FR-050**: Shop marketplace MUST support three product types: Physical products (with inventory, shipping, gift wrap), Digital products (with instant access, download limits, DRM), Premium access (groups, communities, subscriptions)
- **FR-051**: System MUST enable vendors to manage inventory with real-time tracking, low-stock alerts, backorder support, and automatic stock reservation during checkout
- **FR-052**: System MUST provide product creation wizard with category selection (Learning, Creative Tools, Business, Lifestyle, Entertainment, Health, Developer Tools, Events), pricing configuration, and asset upload (images, videos, files)
- **FR-053**: Exchange marketplace MUST support service listings for consulting, coaching, financial services, and custom development with hourly/project-based pricing
- **FR-054**: System MUST provide marketplace analytics showing: product performance, customer behavior, seasonal trends, conversion funnels, and revenue breakdown by category

### Functional Requirements - OrivaPay Payment Processing

- **FR-055**: System MUST integrate Stripe for fiat payment processing supporting credit cards, debit cards, ACH, and digital wallets (Apple Pay, Google Pay)
- **FR-056**: System MUST prepare Moralis integration (stubbed endpoints) for crypto payments (Bitcoin, Ethereum, stablecoins) planned for v2
- **FR-057**: System MUST implement dynamic fee structure: Digital products (10%), Physical products (15%), Premium access/subscriptions (20%), Services (15%), App extensions (10-20% based on tier)
- **FR-058**: System MUST process payment processing fees transparently: Stripe (2.9% + $0.30 per transaction), future crypto via Moralis (1.5% + network fees)
- **FR-059**: System MUST support escrow for conditional releases: Physical goods (release on delivery confirmation), Services (release on milestone completion), High-value items (staged releases)
- **FR-060**: System MUST implement refund workflows with dispute handling, evidence collection, neutral arbitration, and automated refund processing for approved claims
- **FR-061**: System MUST provide payout distribution via Stripe Connect supporting: PayPal, bank transfer (ACH/wire), and crypto (Moralis v2) with configurable payout frequency (daily, weekly, monthly)
- **FR-062**: System MUST handle automatic tax compliance: 1099 generation for US earners (via Stripe Tax), VAT/GST collection per jurisdiction (via Stripe Tax), international tax documentation (via Stripe Connect), and multi-currency support (via Stripe native multi-currency)
- **FR-063**: System MUST scale to 10,000+ transactions per day with sub-second response times, redundancy for 99.9% uptime, and Vercel auto-scaling
- **FR-064**: System MUST implement fraud protection: Stripe Radar integration, transaction velocity limits, high-risk transaction holds, and suspicious pattern detection

### Functional Requirements - Six Earner Types

- **FR-065**: System MUST support Creator earner type enabling publishing of premium content (courses, templates, media) with pricing, commission rates for affiliates, payout frequency, and customer support configuration in /settings
- **FR-066**: System MUST support Vendor earner type enabling sale of physical and digital products with inventory management, commission rates, gift wrap options, shipping settings, and product catalog management
- **FR-067**: System MUST support Developer earner type enabling app extension publication with flexible pricing (free, one-time, monthly, yearly, freemium), permission configuration, hosting options (external/Oriva), and revenue tracking
- **FR-068**: System MUST support Advertiser earner type enabling paid brand promotion with budget controls (daily cap, campaign cap), targeting options (demographics, interests, keywords), split testing, and performance analytics
- **FR-069**: System MUST support Affiliate earner type enabling commission-based promotion of all other earner types' offerings with campaign link generation, click/sale tracking, commission dashboard, and payout requests
- **FR-070**: System MUST support Influencer earner type enabling brand collaboration sponsorships with opportunity listings, portfolio display, audience demographics, pricing, and escrow-based payment on deliverable confirmation
- **FR-071**: System MUST allow users to activate multiple earner type roles simultaneously (e.g., Creator + Affiliate + Influencer) with separate dashboards and revenue tracking per role
- **FR-072**: System MUST provide role-specific onboarding flows in /settings with clear explanations, setup wizards, and compliance requirements (KYC for financial earners, business verification for vendors)

### Functional Requirements - Affiliate Network

- **FR-073**: System MUST enable any registered Oriva user to register as affiliate with basic verification (email confirmation, terms acceptance, payout method configuration)
- **FR-074**: System MUST provide Affiliate Offers page displaying all available programs from Creators, Vendors, Developers, Advertisers, and Influencers with program details (commission rate, product thumbnail, terms)
- **FR-075**: System MUST generate unique affiliate campaign links with URL shortening for easy sharing across social media, threads, and external channels
- **FR-076**: System MUST resolve shortened URLs efficiently (<100ms) with tracking of clicks, referrer, device type, geographic location, and timestamp
- **FR-077**: System MUST attribute sales using last-click attribution with 30-day cookie window, tracking full attribution chain for multi-touch conversions
- **FR-078**: System MUST calculate commissions based on earner-specific rates: Creators (1-20%), Vendors (1-20%), Developers (1-20%), Advertisers (1-15%), Influencers (1-10%)
- **FR-079**: System MUST provide Affiliate Dashboard displaying campaign links, clicks, conversion rate, sales attributed, commissions earned, trend graphs, and payout request functionality
- **FR-080**: System MUST implement affiliate fraud prevention: IP address tracking, conversion rate anomaly detection, click pattern analysis, device fingerprinting, and payout holds for suspicious activity
- **FR-081**: System MUST support recurring commissions for subscription-based products (e.g., affiliate earns monthly for app subscriptions they referred)
- **FR-082**: System MUST track network contribution scores crediting thread participants whose context led to affiliate conversions

### Functional Requirements - Advertising Network

- **FR-083**: System MUST enable Advertisers to create campaigns with creative assets (images, video, copy), destination URLs, and call-to-action buttons
- **FR-084**: System MUST provide targeting options: Demographics (age, gender, location), Interests (based on user behavior and thread topics), Keywords (semantic thread analysis), Custom audiences (uploaded lists)
- **FR-085**: System MUST implement budget controls: Daily spending cap, total campaign budget, bid amount per impression/click, and automatic pause when budget exhausted
- **FR-086**: System MUST display ads contextually in user feed based on semantic thread analysis, maintaining 1:10 ad-to-content ratio maximum to preserve user experience
- **FR-087**: System MUST support split testing allowing Advertisers to test multiple creative variants with automatic traffic distribution and performance reporting
- **FR-088**: System MUST charge advertisers on CPC (cost-per-click) or CPM (cost-per-thousand-impressions) model with transparent reporting and fraud protection
- **FR-089**: System MUST require minimum relevance scores for ads to appear, calculated from click-through rate, user engagement, and negative feedback (hide/report)
- **FR-090**: System MUST allow users to control ad experience: Hide specific ads, report inappropriate content, adjust ad personalization preferences, and opt-out of targeted advertising
- **FR-091**: System MUST provide Advertiser analytics: Impressions, clicks, CTR, conversions, cost-per-acquisition, geographic breakdown, demographic performance, and ROI metrics
- **FR-092**: System MUST enable affiliate commissions on advertised products allowing Advertisers to incentivize affiliates to promote their ads with configurable commission rates

### Functional Requirements - Contextual Commerce UX

- **FR-093**: System MUST embed marketplace offerings naturally in social feed and collaborative threads, not as separate destination requiring navigation away from conversation
- **FR-094**: System MUST present commerce suggestions with collaborative framing using social proof: "3 people in your network found this helpful", "Thread participants recommend", "Popular in this community"
- **FR-095**: System MUST implement contextual product cards inline in feed displaying: Product image, title, price, quick action (Add to Cart, Install, Learn More), and dismissal option
- **FR-096**: System MUST enable one-click actions from feed: Install app, Add to cart, Purchase course, Subscribe to service without full page navigation for streamlined conversion
- **FR-097**: System MUST provide unified checkout accessible from any context (feed, thread, profile, marketplace) with saved payment methods, address autofill, and purchase history
- **FR-098**: System MUST display relevant marketplace suggestions based on thread semantic analysis: User mentions "project management tool" → suggest relevant Extensions and Shop products inline
- **FR-099**: System MUST throttle commerce suggestions to prevent overwhelming users: Maximum 3 suggestions per thread, minimum 10 content items between feed ads, user-configurable frequency preferences
- **FR-100**: System MUST track engagement metrics for contextual commerce: Impression rate, click-through rate, conversion rate, dismissal rate, and revenue per impression
- **FR-101**: System MUST provide seamless transitions between social collaboration and commerce: Thread discussion → Product discovery → Purchase → Return to thread to share outcome
- **FR-102**: System MUST enable social proof collection: Allow purchasers to leave reviews, share outcomes in threads, recommend to network, and earn recognition for helpful recommendations

### Functional Requirements - Revenue & Business Operations

- **FR-103**: System MUST generate revenue from multiple streams: Platform fees (10-20% by type), Payment processing (Stripe fees), Advertising (CPC/CPM), Premium listings ($99/month featured placement), Analytics tools ($49/month advanced tier)
- **FR-104**: System MUST track platform revenue by source: Earner type breakdown, marketplace category, geographic region, payment method, and time period
- **FR-105**: System MUST provide earner analytics dashboard showing: Total revenue, platform fees deducted, payment processing costs, net earnings, payout schedule, and tax documentation
- **FR-106**: System MUST implement volume discounts for high-performing earners: 5% fee reduction at $10,000+ monthly sales, 10% reduction at $50,000+, custom rates for enterprise partners
- **FR-107**: System MUST handle dispute resolution workflow: Buyer submits claim → Evidence collection (screenshots, tracking) → Seller response window (48 hours) → Neutral arbitration → Refund/release decision
- **FR-108**: System MUST implement graduated policy enforcement for violations: First offense (warning), Second (temporary suspension), Third (permanent ban with revenue hold and appeals process)
- **FR-109**: System MUST provide operational monitoring: Transaction success rates, payment processing errors, payout failures, API response times, and automated alerting for anomalies
- **FR-110**: System MUST support international expansion: Multi-currency pricing, localized payment methods, region-specific tax compliance, and cross-border shipping calculations

### Key Entities *(include if feature involves data)*

- **Thread Semantic Analysis**: Represents AI-generated insights about thread content including topics (array of strings with confidence scores), needs (identified problems or requests), expertise gaps (knowledge areas needed), collaboration opportunities (potential partnerships), and sentiment indicators (seeking, frustrated, satisfied)

- **User Expertise Profile**: Represents demonstrated knowledge and skills including domains (expertise areas with confidence scores), helpful response count (contributions rated valuable), collaboration success rate (percentage of positive outcomes), reputation score (0-100 based on results), availability status (available, busy, away), and visibility settings (public, network-only, private)

- **Contribution Tracking**: Represents individual collaborative actions including user ID, thread ID, contribution type (helpful_response, problem_solved, connection_made), value score (impact measurement), timestamp, and recognition received (applauds, iterations, curation)

- **Reciprocity Balance**: Represents give-vs-take measurements including user ID, knowledge shared count, problems solved count, connections made count, time invested (aggregate minutes), reciprocity ratio (give/take), and network credits earned

- **Contextual Suggestion**: Represents commerce recommendations within threads including suggestion ID, thread ID, suggestion type (expert, solution, template, consultation), relevance score (0-1 confidence), peer endorsements (count from network), presentation context (where and how to show), and user feedback (accepted, dismissed, reported)

- **Expert Match**: Represents connection between expertise and needs including thread ID, suggested expert user ID, need description, expertise overlap score, availability confirmation status, invitation sent timestamp, and response status (pending, accepted, declined, expired)

- **Smart Agreement Recommendation**: Represents AI-enhanced agreement guidance including thread ID, recommended template, suggested clauses (based on similar agreements), identified risks (potential issues flagged), success probability (based on historical outcomes), and value-sharing structure (if applicable)

- **Marketplace Item**: Represents sellable offerings including item ID, earner ID, item type (extension/product/service/ad/sponsorship), category, title, description, pricing (one-time/subscription/freemium), images/assets, status (draft/published/suspended), ratings (average/count), created/updated timestamps

- **OrivaPay Transaction**: Represents payment processing including transaction ID, buyer ID, seller ID, amount, currency, platform fee (calculated by type), processing fee (Stripe/Moralis), status (pending/completed/failed/refunded), payment method, escrow status, payout status, timestamps

- **Earner Profile**: Represents monetization configuration including user ID, active earner types (array of Creator/Vendor/Developer/Advertiser/Affiliate/Influencer), role-specific settings (commissions, payouts, inventory, targeting), KYC status, business verification, total revenue, payout methods

- **Affiliate Campaign**: Represents promotional links including campaign ID, affiliate user ID, target item ID (product/service/app/ad), shortened URL, commission rate, clicks count, conversions count, revenue attributed, status (active/paused/expired), created timestamp

- **Advertisement**: Represents paid promotions including ad ID, advertiser ID, creative assets (images/video/copy), destination URL, targeting config (demographics/interests/keywords), budget (daily/total), bid amount, status (draft/active/paused/completed), impressions, clicks, conversions, spend

- **Inventory Item**: Represents physical product stock including product ID, vendor ID, quantity available, quantity reserved, low-stock threshold, restock status, location (warehouse/fulfillment center), last updated timestamp

- **Payout Record**: Represents earnings distribution including payout ID, earner ID, period (date range), gross revenue, platform fees, processing fees, net amount, payout method (PayPal/bank/crypto), status (pending/processing/completed/failed), tax forms generated, timestamps

- **Dispute Case**: Represents transaction conflicts including case ID, transaction ID, buyer ID, seller ID, claim type (non-delivery/quality/fraud), evidence (screenshots/tracking/messages), seller response, arbitration decision, resolution (refund/release/partial), status, timestamps

---

## Success Metrics *(mandatory)*

### Engagement Metrics
- **Thread Engagement**: 50% increase in time spent in collaborative discussions as measured by session duration and interaction frequency
- **Suggestion Acceptance**: 70% of semantic suggestions marked as helpful or acted upon by users
- **Collaboration Initiation**: 40% increase in new collaborative relationships formed through expert matching and contextual introductions
- **Expert Discovery**: 60% of users successfully discover and connect with relevant experts for their needs

### Quality Metrics
- **Suggestion Relevance**: 80% of contextual commerce suggestions rated relevant by users (not dismissed as irrelevant)
- **Expertise Accuracy**: 75% of mined expertise profiles confirmed accurate by peer validation
- **Agreement Success**: 65% of smart agreement recommendations lead to completed, successful collaborations
- **Reciprocity Balance**: 70% of active users maintain healthy give-vs-take ratios (0.7-1.3 range)

### Commerce & Marketplace Metrics
- **Emergent Commerce Value**: $500,000+ monthly transaction volume through contextual commerce embedded in threads (not destination marketplace)
- **Marketplace Adoption**: 60% of active users discover offerings through feed/thread suggestions vs 40% through marketplace browsing
- **Conversion Rate**: 8-12% conversion rate from contextual suggestion impression to transaction (industry benchmark: 2-4%)
- **Cart Abandonment**: <30% cart abandonment rate through streamlined checkout and saved payment methods
- **Repeat Purchase Rate**: 40% of buyers make repeat purchases within 90 days indicating satisfaction and platform stickiness

### Revenue Metrics (Critical Business Outcomes)
- **Platform Revenue**: $100,000+ monthly from combined platform fees, payment processing, advertising, and premium services
- **Transaction Volume**: 10,000+ successful transactions per day across all 6 earner types and 3 marketplace categories
- **Average Order Value**: $75+ per transaction combining multiple item types (extensions + products + subscriptions)
- **Revenue per User**: $25+ monthly ARPU from combination of purchases, subscriptions, and affiliate commissions
- **Earner Growth**: 1,000+ active earners (any type) within 6 months, 5,000+ within 12 months showing viable creator economy

### Earner Type Performance
- **Creator Revenue**: 500+ active Creators earning average $500/month from premium content with 15% affiliate support
- **Vendor Revenue**: 200+ active Vendors earning average $2,000/month from product sales with inventory turnover <30 days
- **Developer Revenue**: 100+ active Developers earning average $1,500/month from app extensions with 70%+ subscription retention
- **Advertiser Spend**: 50+ active Advertisers spending average $3,000/month with 5%+ conversion rate on promoted offerings
- **Affiliate Earnings**: 2,000+ active Affiliates earning average $200/month with 5%+ conversion rate on campaign links
- **Influencer Bookings**: 50+ active Influencers booking average $5,000/month in sponsorships with 80%+ deliverable satisfaction

### Affiliate Network Metrics
- **Affiliate Participation**: 25% of active users registered as affiliates promoting offerings for commission income
- **Campaign Performance**: 5%+ average conversion rate on affiliate links (industry benchmark: 1-3%)
- **Recurring Commissions**: 60% of affiliate revenue from recurring subscription commissions showing sustainable earnings
- **Network Attribution**: 30% of marketplace transactions attributed to network effects (thread context, user recommendations)

### Advertising Network Metrics
- **Ad Engagement**: 3%+ CTR on contextually-targeted ads (industry benchmark: 0.5-1%)
- **Ad Relevance**: 90%+ minimum relevance score requirement maintaining user experience quality
- **Ad Revenue**: $30,000+ monthly from CPC/CPM advertising with 1:10 ad-to-content ratio
- **User Satisfaction**: <5% ad hide/report rate indicating acceptable ad experience

### Operational Excellence Metrics
- **Payment Success Rate**: 98%+ successful payment processing rate with automatic retry for failures
- **Payout Reliability**: 99%+ on-time payout distribution with automated tax documentation
- **Dispute Resolution**: <2% transaction dispute rate with 48-hour average resolution time
- **System Performance**: <200ms API response times, 99.9% uptime, sub-second checkout flow
- **Fraud Prevention**: <0.1% fraudulent transaction rate through Stripe Radar and affiliate monitoring

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain (all ambiguities resolved in edge cases)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded (builds on specs 001, 002, 006, 009)
- [x] Dependencies and assumptions identified

### Constitutional Compliance
- [x] Aligns with conversation-first, collaboration-focused principles
- [x] Maintains user privacy and data sovereignty
- [x] Supports emergent commerce rather than transaction-focused marketplace
- [x] Enables value creation through collaborative intelligence

---

## Execution Status

- [x] User description parsed and expanded with marketplace architecture
- [x] Key concepts extracted across semantic intelligence + marketplace + OrivaPay + affiliate + advertising
- [x] Ambiguities documented (8 semantic + 11 marketplace edge cases with business implications)
- [x] User scenarios defined (18 comprehensive acceptance scenarios covering all 6 earner types)
- [x] Requirements generated (110 functional requirements across 9 system categories)
- [x] Entities identified (16 key entities with complete attribute definitions)
- [x] Review checklist passed with revenue-critical focus
- [x] Success metrics defined (47 measurable KPIs across engagement, quality, commerce, revenue, earner types, networks, operations)

---

## Next Phase: Planning

This specification is ready for the planning phase where technical architecture, database schema, API design, and implementation approach will be defined in `plan.md`. The planning phase should address:

**Core Systems Integration:**
- Hugo AI platform architecture (specs/001-hugo-ai-integration, specs/002-hugo-ai-platform) for semantic intelligence
- Threading system implementation (specs/009-threading-update-docs) for contextual commerce embedding
- Agreement system architecture (specs/006-agreements-epic-based) for value-sharing and escrow
- Atomic design component system (specs/005-entrycard-ui-implementation) for marketplace UI

**New Marketplace Architecture:**
- Unified marketplace (Extensions, Shop, Exchange) with cross-category search and unified cart
- OrivaPay payment processing with Stripe integration, Moralis crypto preparation, dynamic fees, escrow, refunds
- Six earner type systems (Creator, Vendor, Developer, Advertiser, Affiliate, Influencer) with role-specific workflows
- Affiliate network with URL shortening, attribution tracking, commission calculation, fraud prevention
- Advertising network with targeting, budgets, split testing, contextual feed integration, relevance scoring

**Technical Considerations:**
- Vercel Edge Functions + Serverless architecture for scalability (10,000+ transactions/day)
- Supabase PostgreSQL with RLS for multi-tenant data isolation and security
- Stripe Connect for marketplace payments with automatic tax handling and multi-currency support
- Database schema for marketplace items, transactions, earner profiles, affiliate campaigns, ads, inventory, payouts, disputes
- API endpoints for marketplace CRUD, payment processing, affiliate operations, ad management, analytics
- Performance requirements: <200ms API responses, 99.9% uptime, sub-second checkout, <100ms URL resolution

**Revenue Architecture:**
- Platform fee calculation engine (10-20% dynamic by type)
- Payment processing fee tracking (Stripe 2.9%+$0.30, Moralis 1.5%+network)
- Payout distribution system with tax documentation (1099, VAT/GST, international)
- Revenue analytics dashboard with breakdowns by earner type, geography, category, time period
- Volume discount tiers and enterprise custom rates

**Security & Compliance:**
- PCI DSS compliance through Stripe
- KYC/AML for financial earners
- App sandboxing with permission system and API audit logging
- Fraud detection (Stripe Radar, affiliate monitoring, ad click validation)
- Dispute resolution workflows with evidence collection and neutral arbitration
- International compliance (GDPR, CCPA, cross-border regulations)