# Limohawk Revolut Migration - January 21, 2026

## Summary

Migrated the Limohawk VIP subscription system from Stripe to Revolut Merchant API, then created comprehensive pattern documentation.

## Migration Changes

### Services (o-sites/src/lib/limohawk/)

- **DELETED**: `stripeService.ts`
- **CREATED**: `revolutService.ts` - Full Revolut Merchant API integration
- **MODIFIED**: `vipService.ts` - Updated to use revolutService
- **MODIFIED**: `index.ts` - Updated exports

### API Routes (o-sites/src/app/api/limohawk/)

- **CREATED**: `webhooks/revolut/route.ts` - Revolut webhook handler
- **CREATED**: `customer/vip-subscribe/route.ts` - Create subscription
- **CREATED**: `customer/vip-cancel/route.ts` - Cancel subscription

### Database (o-platform)

- **CREATED**: `20260121000000_limohawk_stripe_to_revolut.sql`
  - Added: revolut_customer_id, revolut_subscription_id, revolut_plan_id
  - Dropped: stripe_customer_id, stripe_subscription_id, stripe_price_id

### Dependencies

- **REMOVED**: `stripe` from package.json

## Pattern Documentation Created

All in `o-sites/src/lib/limohawk/patterns/`:

1. **CLAUDE.md** - Navigation hub and system overview
2. **loyalty-system.md** - Points, credit, tiers, expiry (100 pts = £5)
3. **vip-membership.md** - VIP subscriptions with Revolut (£19.99/mo, £149/yr)
4. **customer-portal.md** - Magic code auth, JWT tokens
5. **api-routes.md** - Complete API endpoint reference
6. **database-schema.md** - Tables, functions, stored procedures

## Key Business Rules

- 1 point per £1 net fare (1.5x for VIP)
- 100 points = £5 credit
- Max 20% of booking can be paid with credit
- 12 months inactivity = expiry

## Environment Variables Needed

```
LIMOHAWK_REVOLUT_SECRET_KEY=
LIMOHAWK_REVOLUT_SANDBOX=true
LIMOHAWK_REVOLUT_PLAN_MONTHLY=
LIMOHAWK_REVOLUT_PLAN_ANNUAL=
LIMOHAWK_REVOLUT_WEBHOOK_SECRET=
```

## Revolut vs Stripe Differences

- No hosted checkout - frontend widget saves payment method first
- No customer portal - we manage in our UI
- Webhook header: `Revolut-Signature` (HMAC-SHA256)
- API version header: `Revolut-Api-Version: 2025-12-04`
