# Photo Upload Issue Analysis

**Date**: 2025-12-12
**Issue**: Photos upload successfully but don't display - shows placeholder instead

---

## Root Cause

The `publicUrl` returned by `/api/v1/apps/photos/confirm` uses the wrong CloudFront domain, which points to the wrong S3 bucket.

### Current Configuration

**S3 Bucket**: `love-puzl-media`

- Region: `us-east-1`
- Public Access: ✅ **ENABLED** (bucket policy allows public read)
- Files: ✅ **Publicly accessible** via direct S3 URLs

**CloudFront Configuration** (from code):

```typescript
// src/express/routes/photos.ts:36
const CLOUDFRONT_DOMAIN =
  process.env.AWS_CLOUDFRONT_DOMAIN || 'dj9em15b7x04y.cloudfront.net';
```

**CloudFront Distribution** (`dj9em15b7x04y.cloudfront.net`):

- Distribution ID: `E2YYCXBNKRP3R5`
- Origin: `oriva-media-storage.s3.us-east-2.amazonaws.com` ❌ **WRONG BUCKET**
- Region: `us-east-2` ❌ **WRONG REGION**

**Environment Variable**:

```bash
# .env
AWS_S3_BUCKET=love-puzl-media
AWS_CLOUDFRONT_DOMAIN=undefined  # ❌ NOT SET
```

---

## URL Comparison

### Current (WRONG) - Returns 403

```
https://dj9em15b7x04y.cloudfront.net/profiles/205bcd51-a0a4-41c8-9ef6-ef971d9706f5/1764547381266-0b2f0f76-a4a1-4f5c-bb1b-db667dea006e.jpg
```

- CloudFront distribution points to `oriva-media-storage` in `us-east-2`
- File doesn't exist in that bucket → 403 error

### Correct (WORKS) - Returns 200

```
https://love-puzl-media.s3.us-east-1.amazonaws.com/profiles/205bcd51-a0a4-41c8-9ef6-ef971d9706f5/1764547381266-0b2f0f76-a4a1-4f5c-bb1b-db667dea006e.jpg
```

- Direct S3 URL to actual bucket
- Public read policy allows access → 200 OK

---

## Solution Options

### Option 1: Use Direct S3 URLs (RECOMMENDED - Simplest)

Since the bucket already has public read access, we can use direct S3 URLs:

**Change in** `src/express/routes/photos.ts:385`:

```typescript
// OLD (wrong CloudFront URL)
const publicUrl = isApproved ? `https://${CLOUDFRONT_DOMAIN}/${key}` : '';

// NEW (direct S3 URL)
const publicUrl = isApproved
  ? `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`
  : '';
```

**Pros**:

- ✅ Works immediately - no infrastructure changes needed
- ✅ Bucket already configured for public read
- ✅ Simpler - one less service to manage

**Cons**:

- ❌ No CDN caching (slower for global users)
- ❌ Higher S3 bandwidth costs at scale

---

### Option 2: Create New CloudFront Distribution (Production-Ready)

Create a CloudFront distribution for `love-puzl-media` bucket:

1. **Create CloudFront distribution**:
   - Origin: `love-puzl-media.s3.us-east-1.amazonaws.com`
   - Origin Access Identity: Configure OAI
   - Cache policy: CachingOptimized
   - Allowed HTTP Methods: GET, HEAD

2. **Update bucket policy** (if using OAI):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "CloudFrontAccess",
         "Effect": "Allow",
         "Principal": {
           "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity <OAI_ID>"
         },
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::love-puzl-media/*"
       }
     ]
   }
   ```

3. **Set environment variable**:
   ```bash
   AWS_CLOUDFRONT_DOMAIN=<new-distribution-id>.cloudfront.net
   ```

**Pros**:

- ✅ CDN caching - faster global delivery
- ✅ Lower S3 bandwidth costs at scale
- ✅ SSL/TLS termination at edge
- ✅ DDoS protection via AWS Shield

**Cons**:

- ❌ Requires AWS infrastructure setup
- ❌ Small additional CloudFront costs
- ❌ Cache invalidation needed for updates

---

## Immediate Fix (Development)

For immediate testing in development, use **Option 1** (direct S3 URLs):

**File**: `src/express/routes/photos.ts`

**Line 385** - Change from:

```typescript
const publicUrl = isApproved ? `https://${CLOUDFRONT_DOMAIN}/${key}` : '';
```

**To**:

```typescript
const publicUrl = isApproved
  ? `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`
  : '';
```

**Also update comment on line 384**:

```typescript
// OLD
// Note: Direct S3 URLs are blocked by bucket policy - must use CloudFront

// NEW
// Using direct S3 URLs since love-puzl-media bucket has public read access
```

---

## Verification

After applying the fix, verify with:

```bash
# 1. Upload a photo via Hugo Love edit profile
# 2. Check the publicUrl returned in the response
# 3. Verify the URL format matches:
#    https://love-puzl-media.s3.us-east-1.amazonaws.com/profiles/{userId}/{timestamp}-{uuid}.jpg

# 4. Test the URL directly
curl -I "https://love-puzl-media.s3.us-east-1.amazonaws.com/profiles/..."
# Should return: HTTP/1.1 200 OK
```

---

## Production Recommendation

For production deployment:

1. **Use Option 1 initially** to unblock development
2. **Plan to migrate to Option 2** before production launch for:
   - Better performance (CDN caching)
   - Lower costs at scale
   - Enhanced security (OAI instead of public bucket)

---

## Files Involved

- **Backend**: `src/express/routes/photos.ts` (lines 36, 385)
- **Environment**: `.env` (missing `AWS_CLOUDFRONT_DOMAIN`)
- **Infrastructure**: CloudFront distribution `E2YYCXBNKRP3R5` points to wrong bucket
