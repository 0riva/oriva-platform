# Background Workers - Cron Job Setup

## Overview

Since you're using https://console.cron-job.org/jobs instead of Vercel Cron Jobs, here's how to set up the three background workers for the Platform Events & Notifications System.

## Workers Overview

### 1. Webhook Retry Worker

**Purpose**: Retries failed webhook deliveries with exponential backoff
**Frequency**: Every 5 minutes
**Max Duration**: ~10 seconds per run
**Task Count**: Processes up to 100 failed webhooks per run

### 2. Notification Expiry Worker

**Purpose**: Automatically dismisses notifications past their expiry date
**Frequency**: Every 5 minutes
**Max Duration**: ~5 seconds per run
**Task Count**: Processes up to 1000 notifications per run

### 3. Data Archival Worker

**Purpose**: Archives/deletes old events and notifications
**Frequency**: Daily at midnight (00:00 UTC)
**Max Duration**: ~30 seconds per run
**Retention**: 90 days (configurable via RETENTION_DAYS env var)

## Cron-Job.org Configuration

### Step 1: Create Jobs

Go to https://console.cron-job.org/jobs and create three new jobs:

### Job 1: Webhook Retry Worker

```
Title: Oriva - Webhook Retry Worker
URL: https://api.oriva.com/api/workers/webhookRetry
Method: POST
Schedule: */5 * * * * (Every 5 minutes)
Timeout: 30 seconds
```

**Headers:**

```
Authorization: Bearer YOUR_ADMIN_API_KEY
Content-Type: application/json
```

**Body:** (empty)

**Response Validation:**

- Expected status: 200
- Check for: "retried" in response body

---

### Job 2: Notification Expiry Worker

```
Title: Oriva - Notification Expiry Worker
URL: https://api.oriva.com/api/workers/notificationExpiry
Method: POST
Schedule: */5 * * * * (Every 5 minutes)
Timeout: 30 seconds
```

**Headers:**

```
Authorization: Bearer YOUR_ADMIN_API_KEY
Content-Type: application/json
```

**Body:** (empty)

**Response Validation:**

- Expected status: 200
- Check for: "expired" in response body

---

### Job 3: Data Archival Worker

```
Title: Oriva - Data Archival Worker
URL: https://api.oriva.com/api/workers/dataArchival
Method: POST
Schedule: 0 0 * * * (Daily at midnight UTC)
Timeout: 30 seconds
```

**Headers:**

```
Authorization: Bearer YOUR_ADMIN_API_KEY
Content-Type: application/json
```

**Body:** (empty)

**Response Validation:**

- Expected status: 200
- Check for: "archived" in response body

---

## Authentication

### Option A: Admin API Key (Recommended)

Create a dedicated admin API key for cron jobs:

1. Add to your `.env`:

```bash
CRON_JOB_API_KEY=your_secure_random_key_here
```

2. Update worker files to check for this key:

```javascript
// At the top of each worker file
if (req.headers.authorization !== `Bearer ${process.env.CRON_JOB_API_KEY}`) {
  res.status(401).json({ error: 'Unauthorized' });
  return;
}
```

### Option B: IP Whitelist

Alternatively, whitelist cron-job.org IPs in your Vercel configuration.

## Monitoring & Alerts

### Cron-Job.org Monitoring

- Enable email alerts for failed jobs
- Set up Slack/Discord webhooks for notifications
- Monitor execution history in dashboard

### Recommended Alert Configuration

```
Alert on:
- Job fails 3 consecutive times
- Job execution time > 45 seconds
- Job returns non-200 status code
- Job timeout
```

### Response Format

All workers return JSON:

```json
{
  "retried": 12, // webhookRetry only
  "expired": 5, // notificationExpiry only
  "archived_events": 1000, // dataArchival only
  "archived_notifications": 500, // dataArchival only
  "retention_days": 90, // dataArchival only
  "message": "Success message"
}
```

## Testing Workers Locally

Before deploying to cron-job.org, test locally:

```bash
# Test webhook retry
curl -X POST http://localhost:3000/api/workers/webhookRetry \
  -H "Authorization: Bearer YOUR_KEY"

# Test notification expiry
curl -X POST http://localhost:3000/api/workers/notificationExpiry \
  -H "Authorization: Bearer YOUR_KEY"

# Test data archival
curl -X POST http://localhost:3000/api/workers/dataArchival \
  -H "Authorization: Bearer YOUR_KEY"
```

## Environment Variables

Add these to your Vercel/production environment:

```bash
# Retention period for data archival (days)
RETENTION_DAYS=90

# Cron job authentication
CRON_JOB_API_KEY=your_secure_key_here

# Webhook retry configuration
MAX_WEBHOOK_RETRIES=5
WEBHOOK_RETRY_BACKOFF_BASE=2  # 2^n seconds between retries

# Notification expiry batch size
NOTIFICATION_EXPIRY_BATCH_SIZE=1000

# Data archival batch size
DATA_ARCHIVAL_BATCH_SIZE=10000
```

## Troubleshooting

### Job Fails with 401 Unauthorized

- Check Authorization header is correct
- Verify CRON_JOB_API_KEY environment variable is set
- Ensure bearer token format: `Bearer YOUR_KEY` (not just `YOUR_KEY`)

### Job Timeouts

- Check timeout in cron-job.org settings (max 30 seconds on free plan)
- Consider reducing batch sizes via environment variables
- Check Supabase connection latency
- Optimize queries if workers consistently timeout

### Job Succeeds but No Work Done

- Check database migration is applied
- Verify tables exist: `platform_events`, `platform_notifications`, `app_webhooks`
- Check Supabase logs for errors
- Verify RLS policies allow service role access

### High Error Rate

- Monitor Supabase database performance
- Check for database connection pool exhaustion
- Verify webhook URLs are accessible
- Review webhook delivery logs

## Next Steps

1. ✅ Create three cron jobs at https://console.cron-job.org/jobs
2. ✅ Add CRON_JOB_API_KEY to Vercel environment variables
3. ✅ Update worker files to authenticate cron requests
4. ✅ Deploy workers to Vercel
5. ✅ Test each worker manually first
6. ✅ Enable jobs in cron-job.org
7. ✅ Monitor first 24 hours of execution
8. ✅ Set up alerts for failures

## Security Considerations

- **Never commit API keys** to version control
- Use **strong random keys** for CRON_JOB_API_KEY
- Enable **IP whitelisting** in Vercel if possible
- **Rotate keys** every 90 days
- Monitor for **unauthorized access attempts**
- Set up **rate limiting** on worker endpoints
