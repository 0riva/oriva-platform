# Photos API - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Add AWS Credentials

```bash
cd /Users/cosmic/o-platform
cat >> .env << 'EOF'

# AWS Configuration for Photo Uploads
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_S3_BUCKET=oriva-user-photos
EOF
```

### Step 2: Create S3 Bucket

```bash
# Using AWS CLI
aws s3 mb s3://oriva-user-photos --region us-east-1

# Configure CORS
aws s3api put-bucket-cors --bucket oriva-user-photos --cors-configuration file://cors.json
```

**cors.json:**

```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

### Step 3: Restart BFF

```bash
# Kill existing Vercel dev server
ps aux | grep "vercel dev" | grep -v grep | awk '{print $2}' | xargs kill

# Restart
cd /Users/cosmic/o-platform
vercel dev --listen 3001
```

### Step 4: Test

```bash
# Get upload URL (replace YOUR_JWT and YOUR_API_KEY)
curl -X POST http://localhost:3001/api/v1/apps/photos/upload-url \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "X-App-ID: hugo-love" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.jpg","contentType":"image/jpeg","photoType":"profile"}'
```

---

## 📱 React Native Integration

```typescript
// photoUploadService.ts
export async function uploadPhoto(
  photoUri: string,
  photoType: 'profile' | 'gallery'
) {
  const token = await getAuthToken();

  // 1. Get pre-signed URL
  const urlRes = await fetch(
    'http://localhost:3001/api/v1/apps/photos/upload-url',
    {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.EXPO_PUBLIC_API_KEY!,
        Authorization: `Bearer ${token}`,
        'X-App-ID': 'hugo-love',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: 'photo.jpg',
        contentType: 'image/jpeg',
        photoType,
      }),
    }
  );

  const { uploadUrl, key } = await urlRes.json();

  // 2. Upload to S3
  const photoBlob = await fetch(photoUri).then((r) => r.blob());
  await fetch(uploadUrl, {
    method: 'PUT',
    body: photoBlob,
    headers: { 'Content-Type': 'image/jpeg' },
  });

  // 3. Confirm upload
  const confirmRes = await fetch(
    'http://localhost:3001/api/v1/apps/photos/confirm',
    {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.EXPO_PUBLIC_API_KEY!,
        Authorization: `Bearer ${token}`,
        'X-App-ID': 'hugo-love',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key, photoType }),
    }
  );

  const result = await confirmRes.json();

  if (result.status === 'rejected') {
    throw new Error(`Photo rejected: ${result.moderationLabels?.join(', ')}`);
  }

  return result.publicUrl;
}
```

---

## 🔑 Environment Variables Reference

Required in `/Users/cosmic/o-platform/.env`:

```bash
# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<get from ~/.aws/credentials>
AWS_SECRET_ACCESS_KEY=<get from ~/.aws/credentials>
AWS_S3_BUCKET=oriva-user-photos

# Existing vars (already set)
API_KEY_HUGO_LOVE=<existing>
SUPABASE_URL=<existing>
SUPABASE_SERVICE_ROLE_KEY=<existing>
```

---

## 📂 File Locations

| Purpose               | File Path                                                   |
| --------------------- | ----------------------------------------------------------- |
| **Implementation**    | `/Users/cosmic/o-platform/api/routes/photos.ts`             |
| **Complete API Docs** | `/Users/cosmic/o-platform/api/routes/PHOTOS_API.md`         |
| **Quick Start**       | `/Users/cosmic/o-platform/api/routes/PHOTOS_QUICK_START.md` |
| **Summary**           | `/Users/cosmic/o-platform/PHOTOS_IMPLEMENTATION_SUMMARY.md` |
| **Env Template**      | `/Users/cosmic/o-platform/.env.aws-example`                 |

---

## ✅ Quick Checklist

- [ ] AWS credentials in `.env`
- [ ] S3 bucket created
- [ ] S3 CORS configured
- [ ] S3 bucket policy set (public read)
- [ ] IAM permissions (S3 + Rekognition)
- [ ] BFF server restarted
- [ ] Test with cURL
- [ ] Integrate in React Native app

---

## 🆘 Troubleshooting

**"Invalid API path"**
→ Restart Vercel dev server after adding env vars

**"Access Denied" from S3**
→ Check IAM permissions (need S3 + Rekognition)

**"SignatureDoesNotMatch"**
→ Verify AWS credentials in `.env` are correct

**"The bucket does not allow ACLs"**
→ S3 bucket needs public read policy (not ACLs)

**"Photo rejected" with no labels**
→ Check Rekognition is enabled in your AWS region

---

## 📞 Support Files

- **Full API docs**: See `PHOTOS_API.md` for complete reference
- **Implementation summary**: See `PHOTOS_IMPLEMENTATION_SUMMARY.md`
- **Code**: See `api/routes/photos.ts`
