# Limohawk Rewards System - Implementation Complete

**Date**: January 21, 2026
**Repository**: o-sites (Next.js) + o-platform (migrations only)

## Summary

Built a complete customer loyalty program for Limohawk luxury chauffeur service. Points-based rewards with VIP membership tier.

## Business Rules

- 1 point per £1 net fare
- VIP multiplier: 1.5x points
- 100 points = £5 credit
- Max 20% credit per booking
- 12 month inactivity expiry
- VIP: £19.99/month or £149/year

## What Was Built

### Database (OrivaDB - limohawk schema)

Migrations applied to production:

- `20260120180000_limohawk_loyalty_system.sql` - Core schema
- `20260121000000_limohawk_stripe_to_revolut.sql` - Payment provider migration

Tables: loyalty_accounts, points_ledger, vip_memberships, vip_membership_history, credit_redemptions, verification_codes, notification_log

### Services (o-sites/src/lib/limohawk/)

- `loyaltyService.ts` - Points earning, credit conversion, awardPointsFromBooking()
- `vipService.ts` - VIP membership lifecycle
- `revolutService.ts` - Revolut Merchant API integration
- `customerService.ts` - Magic code auth, JWT tokens
- `brevoService.ts` - Email notifications

### API Routes (o-sites/src/app/api/limohawk/)

- `/customer/send-code` - Send verification code
- `/customer/verify-code` - Verify and get JWT
- `/customer/account` - Get account details
- `/customer/portal` - Customer management URL
- `/customer/update-email` - Initiate email change
- `/customer/confirm-email-update` - Confirm with code
- `/customer/vip-subscribe` - Start VIP subscription
- `/customer/vip-cancel` - Cancel subscription
- `/webhooks/revolut` - Revolut subscription events
- `/webhooks/booking` - AWS booking completions (points trigger)

### Frontend (o-sites)

- `/limohawk/rewards` - Customer portal entry
- `EmailCodeForm` component - Verification flow
- `RewardsDashboard` component - Points display
- `UpdateEmailModal` component - Email change
- URL rewrites in next.config.ts for clean URLs

### Brevo Templates (IDs 5-14)

Created 10 branded templates in dedicated Limohawk Brevo account:

- Verification Code (5), Points Earned (6), Credit Ready (7)
- Expiry Warnings 30/7/1 day (8-10)
- VIP Welcome (11), VIP Renewal (12), VIP Cancelled (13)
- Monthly Statement (14)

### Environment Variables (Vercel Production)

- `LIMOHAWK_JWT_SECRET` - 64-char hex for customer JWT
- `LIMOHAWK_BREVO_TEMPLATE_*` - All 10 template IDs
- Supabase connection (existing)

## Pattern Documentation

Location: `o-sites/src/lib/limohawk/patterns/`

- CLAUDE.md - Navigation hub
- EXECUTIVE_SUMMARY.md - Business overview
- loyalty-system.md - Points logic
- vip-membership.md - Subscription management
- customer-portal.md - Authentication
- api-routes.md - API reference
- database-schema.md - Schema details
- integration-setup.md - External platforms, env vars

## Remaining Work

### 1. Revolut Setup (Manual)

Need in Revolut Business Dashboard:

- Create subscription product "Limohawk VIP"
- Create monthly (£19.99) and annual (£149) plans
- Configure webhook to `https://limohawk.vip/api/limohawk/webhooks/revolut`
- Add to Vercel: LIMOHAWK_REVOLUT_SECRET_KEY, LIMOHAWK_REVOLUT_PLAN_MONTHLY, LIMOHAWK_REVOLUT_PLAN_ANNUAL, LIMOHAWK_REVOLUT_WEBHOOK_SECRET

### 2. AWS Integration (Blocked)

- Webhook ready at `/api/limohawk/webhooks/booking`
- Blocked: AWS booking database not yet established
- AWS needs: LIMOHAWK_BOOKING_API_KEY shared secret

### 3. Optional

- VIP checkout UI with Revolut widget
- Points-to-credit conversion UI
- Scheduled jobs for expiry warnings

## Key Files

- `o-sites/src/lib/limohawk/loyaltyService.ts` - Core points logic
- `o-sites/src/app/api/limohawk/webhooks/booking/route.ts` - AWS webhook
- `o-sites/src/app/limohawk/rewards/page.tsx` - Customer portal
- `o-platform/supabase/migrations/20260120180000_limohawk_loyalty_system.sql` - Schema

## Notes

- Limohawk uses dedicated Brevo account (separate from Oriva)
- All LIMOHAWK\_\* env vars are isolated from other services
- Schema isolation via `limohawk` Postgres schema
- Magic code auth (6-digit, 15 min expiry) instead of magic links
