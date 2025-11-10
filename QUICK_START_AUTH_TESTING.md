# Quick Start: Testing Password Reset Flow

## 60-Second Setup

```bash
# Terminal 1: Start Supabase
cd o-platform
supabase start

# Terminal 2: Start BFF
npm run dev
# Should print: Server listening on port 3002
```

## Test It Now

```bash
# Terminal 3: Run the automated test
./test-password-reset.sh
```

**Expected output**:

```
✓ Account created
✓ Password reset email requested
✓ Found reset token
✓ Password reset successful
✓ Login with new password successful

=== All Tests Passed ===
```

## Manual Testing (If Script Doesn't Work)

### 1. Create Account

```bash
curl -X POST http://localhost:3002/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "name": "Test User"
  }'
```

### 2. Request Password Reset

```bash
curl -X POST http://localhost:3002/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### 3. Find Reset Email

1. Open http://localhost:54334 in browser
2. Find email from "noreply@oriva.io"
3. Copy the reset link
4. Extract the `token` parameter from the URL

### 4. Reset Password

```bash
curl -X POST http://localhost:3002/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "PASTE_TOKEN_HERE",
    "password": "NewPassword456"
  }'
```

### 5. Login with New Password

```bash
curl -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "NewPassword456"
  }'
```

**Expected response**:

```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "...",
  "expires_at": 1699999999,
  "user": { ... }
}
```

✅ **Success!** Password reset works!

## Password Requirements

- ✅ At least 8 characters
- ✅ Contains uppercase letter (A-Z)
- ✅ Contains lowercase letter (a-z)
- ✅ Contains number (0-9)

Example valid passwords:

- `TestPassword123`
- `MySecurePass2024`
- `Start2Login`

## Common Issues

### "Token not found" error

- Check that Supabase is running: `supabase status`
- Wait 2 seconds after requesting password reset
- Check http://localhost:54334 for the email manually

### "Invalid or expired reset token"

- Token expires after 1 hour
- Each token can only be used once
- Make sure you copied the full token from the email

### "Password must be at least 8 characters..."

- Password needs: 8+ chars, uppercase, lowercase, numbers
- Example: `Password123` works, `password123` doesn't (missing uppercase)

## Frontend Integration

**Forgot Password Page**:

```javascript
const response = await fetch('/api/v1/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: userEmail }),
});
// Show: "Check your email for reset link"
```

**Reset Password Page** (after user clicks email link):

```javascript
const token = new URLSearchParams(window.location.search).get('token');

const response = await fetch('/api/v1/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token, password: newPassword }),
});

if (response.ok) {
  // Redirect to login page
  window.location.href = '/login';
}
```

## See Also

- **Full documentation**: `AUTH_FLOW_SETUP.md`
- **Production setup**: See "Production Setup (SendGrid)" section in `AUTH_FLOW_SETUP.md`
- **API endpoints**: See `api/v1/auth.ts`
