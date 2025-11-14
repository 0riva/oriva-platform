# API Key Usage Examples

This directory contains examples for generating, managing, and using API keys with the Oriva Platform API.

## Table of Contents

- [Generating API Keys](#generating-api-keys)
- [Using API Keys](#using-api-keys)
- [Validating API Keys](#validating-api-keys)
- [Managing API Keys](#managing-api-keys)
- [Best Practices](#best-practices)

---

## Generating API Keys

### Method 1: Using the Migration Script

The easiest way to generate API keys is using the provided migration script:

```bash
# Generate a key for a specific app
SUPABASE_URL=your-url SUPABASE_SERVICE_ROLE_KEY=your-key \
  ts-node scripts/migrate-api-keys.ts generate platform "My Platform Key" live

# Output:
# ✅ API Key Generated Successfully!
#
# ⚠️  Save this key - it cannot be retrieved later!
#
# API Key: oriva_pk_live_abc123def456...
# Hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
# ID: 550e8400-e29b-41d4-a716-446655440000
```

### Method 2: Programmatic Generation

```typescript
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase with service role key
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Generate a secure API key
 */
function generateApiKey(environment: 'test' | 'live' = 'live'): string {
  const randomBytes = crypto.randomBytes(32);
  const randomString = randomBytes.toString('base64url').substring(0, 43);
  return `oriva_pk_${environment}_${randomString}`;
}

/**
 * Hash an API key using SHA-256
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Create and store an API key
 */
async function createApiKey(
  appId: string,
  name: string,
  environment: 'test' | 'live' = 'live'
) {
  // Generate the key
  const apiKey = generateApiKey(environment);
  const keyHash = hashApiKey(apiKey);
  const keyPrefix = apiKey.substring(0, 20);

  // Store in database
  const { data, error } = await supabase
    .schema('oriva_platform')
    .from('developer_api_keys')
    .insert({
      app_id: appId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      environment,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create API key: ${error.message}`);
  }

  // Return the plaintext key (only time it's available!)
  return {
    id: data.id,
    key: apiKey,
    hash: keyHash,
  };
}

// Usage
const result = await createApiKey('platform', 'Production Platform Key', 'live');
console.log('Save this key securely:', result.key);
```

---

## Using API Keys

### JavaScript/TypeScript (fetch)

```typescript
// Using fetch API
const response = await fetch('https://api.oriva.io/api/v1/platform/apps', {
  headers: {
    'X-API-Key': 'oriva_pk_live_your_key_here',
    'Content-Type': 'application/json',
  },
});

const data = await response.json();
console.log(data);
```

### JavaScript/TypeScript (axios)

```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.oriva.io/api/v1',
  headers: {
    'X-API-Key': process.env.ORIVA_API_KEY,
  },
});

// Make requests
const { data } = await client.get('/platform/apps');
console.log(data);
```

### Python (requests)

```python
import requests
import os

API_KEY = os.getenv('ORIVA_API_KEY')
BASE_URL = 'https://api.oriva.io/api/v1'

headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
}

response = requests.get(f'{BASE_URL}/platform/apps', headers=headers)
data = response.json()
print(data)
```

### cURL

```bash
curl https://api.oriva.io/api/v1/platform/apps \
  -H "X-API-Key: oriva_pk_live_your_key_here" \
  -H "Content-Type: application/json"
```

### Ruby

```ruby
require 'net/http'
require 'json'

uri = URI('https://api.oriva.io/api/v1/platform/apps')
request = Net::HTTP::Get.new(uri)
request['X-API-Key'] = ENV['ORIVA_API_KEY']
request['Content-Type'] = 'application/json'

response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
  http.request(request)
end

data = JSON.parse(response.body)
puts data
```

### Go

```go
package main

import (
    "fmt"
    "io"
    "net/http"
    "os"
)

func main() {
    apiKey := os.Getenv("ORIVA_API_KEY")
    url := "https://api.oriva.io/api/v1/platform/apps"

    req, _ := http.NewRequest("GET", url, nil)
    req.Header.Set("X-API-Key", apiKey)
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)
    fmt.Println(string(body))
}
```

---

## Validating API Keys

### Check if a Key is Valid

```typescript
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

async function validateApiKey(apiKey: string): Promise<boolean> {
  // Hash the provided key
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Query database
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY! // Use anon key
  );

  const { data, error } = await supabase
    .schema('oriva_platform')
    .from('developer_api_keys')
    .select('id, is_active, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  if (!data.is_active) {
    return false;
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return false;
  }

  return true;
}

// Usage
const isValid = await validateApiKey('oriva_pk_live_abc123...');
console.log('Key is valid:', isValid);
```

### Test a Key Against the API

```bash
# Simple validation test
curl -s -o /dev/null -w "%{http_code}" \
  https://api.oriva.io/api/v1/platform/apps \
  -H "X-API-Key: oriva_pk_live_your_key_here"

# Output:
# 200 = Valid key
# 401 = Invalid or inactive key
# 429 = Rate limited (but key is valid)
```

---

## Managing API Keys

### List All Keys for an App

```typescript
async function listApiKeys(appId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Admin only
  );

  const { data, error } = await supabase
    .schema('oriva_platform')
    .from('developer_api_keys')
    .select('id, name, key_prefix, is_active, usage_count, last_used_at, created_at, expires_at')
    .eq('app_id', appId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list keys: ${error.message}`);
  }

  return data;
}

// Usage
const keys = await listApiKeys('platform');
console.log('Active keys:', keys.filter(k => k.is_active));
```

### Deactivate a Key

```typescript
async function deactivateApiKey(keyId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Admin only
  );

  const { error } = await supabase
    .schema('oriva_platform')
    .from('developer_api_keys')
    .update({ is_active: false })
    .eq('id', keyId);

  if (error) {
    throw new Error(`Failed to deactivate key: ${error.message}`);
  }

  console.log('Key deactivated successfully');
}
```

### Delete a Key (Soft Delete)

```typescript
async function deleteApiKey(keyId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Admin only
  );

  const { error } = await supabase
    .schema('oriva_platform')
    .from('developer_api_keys')
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', keyId);

  if (error) {
    throw new Error(`Failed to delete key: ${error.message}`);
  }

  console.log('Key deleted successfully');
}
```

### Set Key Expiration

```typescript
async function setKeyExpiration(keyId: string, daysUntilExpiry: number) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + daysUntilExpiry);

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Admin only
  );

  const { error } = await supabase
    .schema('oriva_platform')
    .from('developer_api_keys')
    .update({ expires_at: expiresAt.toISOString() })
    .eq('id', keyId);

  if (error) {
    throw new Error(`Failed to set expiration: ${error.message}`);
  }

  console.log(`Key will expire on ${expiresAt.toISOString()}`);
}

// Set key to expire in 90 days
await setKeyExpiration('key-id-here', 90);
```

---

## Best Practices

### 1. Key Storage

✅ **DO:**
- Store keys in environment variables
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- Use different keys for different environments (test vs. live)
- Rotate keys regularly (every 90 days recommended)

❌ **DON'T:**
- Commit keys to version control
- Share keys via email or chat
- Use the same key across multiple applications
- Store keys in plaintext files

### 2. Key Naming

Use descriptive names that indicate:
- Application/service using the key
- Environment (test/live)
- Purpose
- Creation date (optional)

```typescript
// Good examples:
"Hugo Love Production API - 2025-11"
"Platform Test Environment Key"
"Analytics Service - Live - Nov 2025"

// Bad examples:
"Key 1"
"test"
"my-key"
```

### 3. Key Rotation

```typescript
// Example key rotation workflow
async function rotateApiKey(oldKeyId: string, appId: string, name: string) {
  // 1. Create new key
  const newKey = await createApiKey(appId, `${name} (Rotated)`, 'live');
  console.log('New key created:', newKey.key);
  console.log('⚠️  Save this key now!');

  // 2. Keep old key active for grace period (7 days)
  await setKeyExpiration(oldKeyId, 7);
  console.log('Old key will expire in 7 days');

  // 3. Update applications to use new key
  console.log('Update your applications to use the new key within 7 days');

  return newKey;
}
```

### 4. Monitoring

Track key usage to detect:
- Unused keys (can be deactivated)
- Suspicious activity
- Keys approaching expiration

```typescript
// Example: Find unused keys
async function findUnusedKeys(daysInactive: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .schema('oriva_platform')
    .from('developer_api_keys')
    .select('id, name, last_used_at, created_at')
    .is('deleted_at', null)
    .eq('is_active', true)
    .or(`last_used_at.lt.${cutoffDate.toISOString()},last_used_at.is.null`);

  return data;
}

// Find keys not used in 30 days
const unusedKeys = await findUnusedKeys(30);
console.log('Inactive keys:', unusedKeys);
```

### 5. Error Handling

```typescript
// Example: Robust API client with key validation
class OrivaApiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.oriva.io/api/v1') {
    if (!apiKey || !apiKey.startsWith('oriva_pk_')) {
      throw new Error('Invalid API key format');
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 401) {
      throw new Error('Invalid or expired API key');
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API error: ${error.message}`);
    }

    return response.json();
  }
}

// Usage
const client = new OrivaApiClient(process.env.ORIVA_API_KEY!);
try {
  const apps = await client.request('/platform/apps');
  console.log(apps);
} catch (error) {
  console.error('API request failed:', error.message);
}
```

---

## Security Checklist

Before deploying with API keys:

- [ ] Keys are stored securely (not in code)
- [ ] Different keys for test and production
- [ ] Keys have appropriate expiration dates
- [ ] Monitoring is set up for key usage
- [ ] Rotation schedule is defined
- [ ] Error handling includes rate limit retry logic
- [ ] Old/unused keys are deactivated
- [ ] Team knows how to generate new keys
- [ ] Emergency key rotation procedure documented

---

## Support

For questions or issues:
- Review `SECURITY_FIXES.md` for implementation details
- Check application logs for authentication errors
- Contact platform team for key management questions
