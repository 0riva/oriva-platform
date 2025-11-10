# Authentication Flow Setup - Complete Guide

## Overview

This document covers the complete password reset and authentication flow implementation for the Oriva Platform API (BFF).

## What Was Implemented

### New API Endpoints

1. **POST /api/v1/auth/forgot-password** (Public)
   - **Request**: `{ email: string }`
   - **Response**: `{ message: string }`
   - **Purpose**: Initiate password reset flow
   - **Security**: Returns same response for existing/non-existing emails (user enumeration protection)

2. **POST /api/v1/auth/reset-password** (Public)
   - **Request**: `{ token: string, password: string }`
   - **Response**: `{ message: string }`
   - **Purpose**: Complete password reset with reset token
   - **Security**: Validates password strength (8+ chars, mixed case, numbers)

### Existing Auth Endpoints (Not Modified)

- `POST /api/v1/auth/register` - Create new account
- `POST /api/v1/auth/login` - Sign in with credentials
- `POST /api/v1/auth/logout` - Sign out
- `POST /api/v1/auth/token/refresh` - Refresh access token
- `GET /api/v1/auth/profile` - Get user profile (protected)
- `PATCH /api/v1/auth/profile` - Update profile (protected)
- `GET /api/v1/auth/account` - Get account info (protected)
- `DELETE /api/v1/auth/account` - Delete account (protected)

## Local Testing

### Prerequisites

```bash
# Terminal 1: Start Supabase
cd o-platform
supabase stop
supabase start

# Terminal 2: Start BFF
npm install
npm run dev
# Should see: Server listening on port 3002

# Terminal 3: Optional - Watch Supabase logs
supabase logs --follow
```

### Quick Test

```bash
# Make the test script executable
chmod +x ./test-password-reset.sh

# Run the automated test
./test-password-reset.sh
```

Or test manually:

```bash
# 1. Create account
curl -X POST http://localhost:3002/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "name": "Test User"
  }'

# 2. Request password reset
curl -X POST http://localhost:3002/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# 3. Check email at http://localhost:54334
# Find the reset link and extract the token

# 4. Reset password with token
curl -X POST http://localhost:3002/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_EXTRACTED_TOKEN",
    "password": "NewPassword123"
  }'

# 5. Login with new password
curl -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "NewPassword123"
  }'
```

### Email Testing

**Inbucket (Local Email Tester)**

- URL: http://localhost:54334
- Default: All outgoing emails are captured here
- No actual emails sent locally
- Check email by searching for recipient address

**Format of Reset Email**

- From: `noreply@oriva.io` (configurable)
- Subject: Determined by Supabase auth templates
- Body: Contains reset link with token: `http://127.0.0.1:3000/reset-password?token=...&type=recovery`

## Password Requirements

All password reset operations enforce:

- **Minimum length**: 8 characters
- **Character types**: Uppercase + Lowercase + Numbers required
- **Examples**:
  - ✅ `TestPassword123`
  - ✅ `MyPass2024`
  - ❌ `password123` (no uppercase)
  - ❌ `PASSWORD123` (no lowercase)
  - ❌ `TestPassword` (no numbers)

## Security Features

### Implemented

- ✅ **User enumeration protection**: Same response for valid/invalid emails
- ✅ **Token validation**: Tokens expire (default 1 hour)
- ✅ **One-time use**: Token invalidated after use
- ✅ **Password strength**: Enforced requirements
- ✅ **Rate limiting**: Auth endpoints rate limited (built-in)
- ✅ **HTTPS ready**: Production-safe design

### Production Recommendations

- 🔒 Use HTTPS in production
- 🔒 Update `site_url` in config for correct redirect URLs
- 🔒 Configure SendGrid (or SMTP) for email delivery
- 🔒 Monitor auth logs for suspicious activity
- 🔒 Set up email sender verification in SendGrid

## Production Setup (SendGrid)

### 1. Get SendGrid API Key

1. Sign up at https://sendgrid.com
2. Go to Settings → API Keys
3. Create new API key with "Mail Send" permission

### 2. Set Environment Variables

```bash
export SENDGRID_API_KEY="your_actual_api_key_here"
```

### 3. Update supabase/config.toml

```toml
[auth.email.smtp]
enabled = true
host = "smtp.sendgrid.net"
port = 587
user = "apikey"
pass = "env(SENDGRID_API_KEY)"
admin_email = "noreply@oriva.io"
sender_name = "Oriva"
```

### 4. Verify Sender Email

1. Log in to SendGrid
2. Go to Settings → Sender Authentication
3. Add `noreply@oriva.io` as sender
4. Complete verification (email/DNS based on method)

### 5. Update Site URLs

In `supabase/config.toml`:

```toml
[auth]
site_url = "https://app.oriva.io"
additional_redirect_urls = ["https://app.oriva.io"]
```

### 6. Deploy to Production

```bash
# Ensure SENDGRID_API_KEY is set in your deployment platform
# (Vercel, AWS Lambda, etc.)

# For Vercel:
vercel env add SENDGRID_API_KEY
```

## Troubleshooting

### Email not arriving in Inbucket

**Problem**: No emails in Inbucket despite password reset request

**Solutions**:

1. Check Supabase is running: `supabase status`
2. Verify Inbucket is enabled: Check `[inbucket] enabled = true` in config.toml
3. Check auth is enabled: `[auth] enabled = true`
4. Review Supabase logs: `supabase logs --follow`

### Invalid or expired reset token

**Problem**: `/reset-password` returns "Invalid or expired reset token"

**Solutions**:

1. **Token expired**: Tokens expire after 1 hour (configurable in `[auth.email] otp_expiry`)
2. **Token format wrong**: Copy full token from email URL, not just part of it
3. **Token used twice**: Each token is single-use, request a new one
4. **Email changed**: Password reset is for the original email only

### Password doesn't meet requirements

**Problem**: 400 error about password strength

**Solution**: Ensure password has:

- ✅ At least 8 characters
- ✅ Uppercase letter (A-Z)
- ✅ Lowercase letter (a-z)
- ✅ Number (0-9)

### CORS errors in frontend

**Problem**: Browser blocks password reset requests

**Solution**: Add to `supabase/config.toml`:

```toml
[api]
cors_allowed_origins = ["https://frontend.oriva.io"]
```

## Configuration Reference

### supabase/config.toml - Auth Section

```toml
[auth]
enabled = true
site_url = "http://127.0.0.1:3000"  # Frontend URL for reset links
additional_redirect_urls = ["https://127.0.0.1:3000"]
jwt_expiry = 3600  # 1 hour
enable_signup = true
enable_anonymous_sign_ins = false
minimum_password_length = 6  # BFF enforces stricter (8 chars + requirements)
password_requirements = ""

[auth.email]
enable_signup = true
enable_confirmations = false  # Don't require email verification on signup
double_confirm_changes = true  # Confirm email changes on both old+new
secure_password_change = false  # Don't require recent auth for password change
max_frequency = "1s"  # Rate limit: 1 second between emails
otp_length = 6  # Token length
otp_expiry = 3600  # Token expiry: 1 hour

[auth.rate_limit]
email_sent = 2  # Max 2 emails per hour per IP
sign_in_sign_ups = 30  # Max 30 login/signup per 5 min per IP
token_verifications = 30  # Max 30 token verifications per 5 min per IP

[inbucket]
enabled = true  # Email testing (local only)
port = 54334
```

## Testing Checklist

Before deploying to production:

- [ ] Local password reset flow works end-to-end
- [ ] Emails arrive in Inbucket with correct reset links
- [ ] Reset token extracts correctly from email
- [ ] Password reset succeeds with valid token
- [ ] New password works for login
- [ ] Old password no longer works for login
- [ ] Invalid tokens return proper error
- [ ] Expired tokens (after 1 hour) fail correctly
- [ ] Weak passwords are rejected
- [ ] Password requirements are clearly communicated in UI
- [ ] SendGrid SMTP configured correctly
- [ ] noreply@oriva.io is verified in SendGrid
- [ ] Production site_url is updated in config
- [ ] Rate limiting doesn't interfere with legitimate use

## API Error Codes

```
400 Bad Request
├── VALIDATION_FAILED
│   ├── "Email and password are required"
│   ├── "Invalid email format"
│   └── "Password must be at least 8 characters..."
├── INVALID_RESET_TOKEN
│   └── "Invalid or expired reset token"
└── INVALID_CREDENTIALS
    └── "Invalid email or password"

401 Unauthorized
└── INVALID_REFRESH_TOKEN
    └── "Invalid or expired refresh token"

429 Too Many Requests
└── Rate limited (auth endpoints)

500 Internal Server Error
└── Server/database issues
```

## Next Steps

1. **Test locally** with the provided test script
2. **Review email templates** - customize if needed
3. **Set up SendGrid** - for production email delivery
4. **Update frontend** - to call new endpoints
5. **Deploy** - push changes to production
6. **Monitor** - watch logs for auth issues

## Support & References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Email Authentication](https://supabase.com/docs/guides/auth/passwords)
- [SendGrid Setup Guide](https://docs.sendgrid.com/for-developers/sending-email/quickstart-nodejs)
- [OAuth 2.0 Password Reset Flow](https://tools.ietf.org/html/draft-williams-password-reset-00)
