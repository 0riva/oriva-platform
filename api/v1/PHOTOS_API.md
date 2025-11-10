# Photos API Documentation

## Overview

BFF endpoints for pre-signed URL photo uploads with AWS S3 and AWS Rekognition content moderation.

## Endpoints

### 1. Generate Pre-signed Upload URL

**Endpoint:** `POST /api/v1/apps/photos/upload-url`

**Description:** Generates a pre-signed S3 URL for direct client-side photo uploads.

**Headers:**

```
X-API-Key: <your-api-key>
Authorization: Bearer <jwt-token>
X-App-ID: <app-id>
```

**Request Body:**

```json
{
  "fileName": "profile-photo.jpg",
  "contentType": "image/jpeg",
  "photoType": "profile"
}
```

**Request Fields:**

- `fileName` (string, required): Original file name
- `contentType` (string, required): MIME type (image/jpeg, image/png, image/webp, image/heic)
- `photoType` (string, required): Either "profile" or "gallery"

**Response (200 OK):**

```json
{
  "uploadUrl": "https://oriva-user-photos.s3.us-east-1.amazonaws.com/...",
  "key": "user-id-123/1699876543210-abc123-def456.jpg",
  "expiresIn": 300
}
```

**Response Fields:**

- `uploadUrl` (string): Pre-signed S3 URL for PUT request (expires in 5 minutes)
- `key` (string): S3 object key (needed for confirmation step)
- `expiresIn` (number): URL expiration time in seconds (300 = 5 minutes)

**Client Upload Example:**

```typescript
// 1. Get pre-signed URL
const response = await fetch(
  'http://localhost:3001/api/v1/apps/photos/upload-url',
  {
    method: 'POST',
    headers: {
      'X-API-Key': 'your-api-key',
      Authorization: 'Bearer your-jwt-token',
      'X-App-ID': 'hugo-love',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      photoType: 'profile',
    }),
  }
);

const { uploadUrl, key } = await response.json();

// 2. Upload file directly to S3
await fetch(uploadUrl, {
  method: 'PUT',
  body: photoBlob,
  headers: {
    'Content-Type': 'image/jpeg',
  },
});

// 3. Confirm upload (see next endpoint)
```

**Error Responses:**

401 Unauthorized:

```json
{
  "code": "UNAUTHORIZED",
  "message": "User not authenticated"
}
```

400 Validation Error:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid content type. Supported: image/jpeg, image/png, image/webp, image/heic"
}
```

500 S3 Error:

```json
{
  "code": "S3_ERROR",
  "message": "Failed to generate upload URL"
}
```

---

### 2. Confirm Upload and Validate Photo

**Endpoint:** `POST /api/v1/apps/photos/confirm`

**Description:** Confirms the upload was successful and triggers AWS Rekognition content moderation.

**Headers:**

```
X-API-Key: <your-api-key>
Authorization: Bearer <jwt-token>
X-App-ID: <app-id>
```

**Request Body:**

```json
{
  "key": "user-id-123/1699876543210-abc123-def456.jpg",
  "photoType": "profile"
}
```

**Request Fields:**

- `key` (string, required): S3 object key from upload-url response
- `photoType` (string, required): Either "profile" or "gallery"

**Response (200 OK - Approved):**

```json
{
  "photoId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "approved",
  "publicUrl": "https://oriva-user-photos.s3.us-east-1.amazonaws.com/user-id-123/1699876543210-abc123-def456.jpg",
  "moderationLabels": undefined
}
```

**Response (200 OK - Rejected):**

```json
{
  "photoId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "rejected",
  "publicUrl": "",
  "moderationLabels": ["Explicit Nudity", "Violence"]
}
```

**Response Fields:**

- `photoId` (string): Unique identifier for this photo
- `status` (string): "validating", "approved", or "rejected"
- `publicUrl` (string): Public URL to access the photo (empty if rejected)
- `moderationLabels` (string[], optional): List of detected inappropriate content labels (only if rejected)

**Error Responses:**

401 Unauthorized:

```json
{
  "code": "UNAUTHORIZED",
  "message": "User not authenticated"
}
```

403 Forbidden:

```json
{
  "code": "FORBIDDEN",
  "message": "Cannot confirm upload for another user"
}
```

404 Not Found:

```json
{
  "code": "NOT_FOUND",
  "message": "Photo not found in storage"
}
```

400 Invalid Image:

```json
{
  "code": "INVALID_IMAGE",
  "message": "Invalid image format"
}
```

500 Upload Confirmation Error:

```json
{
  "code": "UPLOAD_CONFIRMATION_ERROR",
  "message": "Failed to confirm upload"
}
```

---

## Environment Variables

Required environment variables in `.env`:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<from ~/.aws/credentials>
AWS_SECRET_ACCESS_KEY=<from ~/.aws/credentials>
AWS_S3_BUCKET=oriva-user-photos

# API Configuration (already set)
API_KEY_HUGO_LOVE=<your-api-key>
# ... other existing env vars
```

---

## S3 Bucket Setup

### Bucket Name

`oriva-user-photos` (configurable via `AWS_S3_BUCKET`)

### Bucket Policy (Public Read Access)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::oriva-user-photos/*"
    }
  ]
}
```

### CORS Configuration

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:HeadObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::oriva-user-photos/*"
    },
    {
      "Effect": "Allow",
      "Action": ["rekognition:DetectModerationLabels"],
      "Resource": "*"
    }
  ]
}
```

---

## File Organization

### S3 Key Pattern

```
{userId}/{timestamp}-{uuid}.{extension}
```

**Example:**

```
abc123-def456/1699876543210-550e8400-e29b-41d4-a716-446655440000.jpg
```

**Benefits:**

- User isolation (each user has their own prefix)
- Unique filenames (timestamp + UUID prevents collisions)
- Time-based sorting
- Easy to find/delete user's photos

---

## Content Moderation

### AWS Rekognition Detection

- **Minimum Confidence:** 60% (configurable)
- **Blocked Categories:**
  - Explicit Nudity
  - Nudity
  - Sexual Activity
  - Graphic Violence
  - Violence
  - Visually Disturbing

### Behavior

- **Approved photos:** Remain in S3, public URL returned
- **Rejected photos:** Automatically deleted from S3, moderation labels returned

---

## Security Features

1. **User Isolation:** Users can only upload photos to their own prefix
2. **Key Validation:** Confirm endpoint verifies the key belongs to the authenticated user
3. **Time-Limited URLs:** Pre-signed URLs expire after 5 minutes
4. **Content Moderation:** All photos scanned with AWS Rekognition
5. **Auto-deletion:** Rejected photos automatically removed from S3
6. **Type Validation:** Only supported image formats allowed

---

## Integration Example

### Complete Upload Flow

```typescript
import { Camera } from 'expo-camera';

async function uploadPhoto(photoUri: string) {
  try {
    // 1. Get pre-signed URL
    const urlResponse = await fetch(
      'http://localhost:3001/api/v1/apps/photos/upload-url',
      {
        method: 'POST',
        headers: {
          'X-API-Key': process.env.EXPO_PUBLIC_API_KEY!,
          Authorization: `Bearer ${userToken}`,
          'X-App-ID': 'hugo-love',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: 'photo.jpg',
          contentType: 'image/jpeg',
          photoType: 'profile',
        }),
      }
    );

    if (!urlResponse.ok) throw new Error('Failed to get upload URL');

    const { uploadUrl, key } = await urlResponse.json();

    // 2. Upload to S3
    const photoBlob = await fetch(photoUri).then((r) => r.blob());
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: photoBlob,
      headers: { 'Content-Type': 'image/jpeg' },
    });

    if (!uploadResponse.ok) throw new Error('Failed to upload to S3');

    // 3. Confirm and validate
    const confirmResponse = await fetch(
      'http://localhost:3001/api/v1/apps/photos/confirm',
      {
        method: 'POST',
        headers: {
          'X-API-Key': process.env.EXPO_PUBLIC_API_KEY!,
          Authorization: `Bearer ${userToken}`,
          'X-App-ID': 'hugo-love',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, photoType: 'profile' }),
      }
    );

    if (!confirmResponse.ok) throw new Error('Failed to confirm upload');

    const result = await confirmResponse.json();

    if (result.status === 'rejected') {
      alert(`Photo rejected: ${result.moderationLabels?.join(', ')}`);
      return null;
    }

    console.log('Photo approved:', result.publicUrl);
    return result;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}
```

---

## Testing

### Manual Test with cURL

```bash
# 1. Generate pre-signed URL
curl -X POST http://localhost:3001/api/v1/apps/photos/upload-url \
  -H "X-API-Key: your-api-key" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "X-App-ID: hugo-love" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test.jpg",
    "contentType": "image/jpeg",
    "photoType": "profile"
  }'

# 2. Upload file to S3 (use uploadUrl from response)
curl -X PUT "https://oriva-user-photos.s3.amazonaws.com/..." \
  -H "Content-Type: image/jpeg" \
  --data-binary "@test.jpg"

# 3. Confirm upload
curl -X POST http://localhost:3001/api/v1/apps/photos/confirm \
  -H "X-API-Key: your-api-key" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "X-App-ID: hugo-love" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "user-id/timestamp-uuid.jpg",
    "photoType": "profile"
  }'
```

---

## Notes

1. **Pre-signed URLs expire in 5 minutes** - Upload must complete within this window
2. **Rejected photos are auto-deleted** - No manual cleanup needed
3. **Public URLs are CDN-ready** - Can be used directly in `<Image>` components
4. **User authentication required** - Both endpoints require valid JWT token
5. **Schema-aware** - Uses `schemaRouter` middleware for multi-tenant support
6. **Rate limiting** - Consider adding rate limits for production use
