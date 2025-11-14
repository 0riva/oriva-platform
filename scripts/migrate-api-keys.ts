/**
 * API Key Migration Script
 *
 * Migrates old environment-based API keys to the new hashed database storage system.
 * This script generates new API keys with proper formatting and stores them as SHA-256 hashes.
 *
 * Usage:
 *   ts-node scripts/migrate-api-keys.ts
 *
 * Prerequisites:
 *   1. Ensure developer_api_keys table exists in oriva_platform schema
 *   2. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Generate a secure random API key
 * Format: oriva_pk_{environment}_{random}
 */
function generateApiKey(environment: 'test' | 'live' = 'live'): string {
  const randomBytes = crypto.randomBytes(32);
  const randomString = randomBytes.toString('base64url').substring(0, 43); // 43 chars = ~256 bits
  return `oriva_pk_${environment}_${randomString}`;
}

/**
 * Hash API key using SHA-256
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Create a new API key in the database
 */
async function createApiKey(
  appId: string,
  name: string,
  environment: 'test' | 'live' = 'live',
  expiresInDays?: number
): Promise<{ key: string; hash: string; id: string }> {
  const apiKey = generateApiKey(environment);
  const keyHash = hashApiKey(apiKey);

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .schema('oriva_platform')
    .from('developer_api_keys')
    .insert({
      app_id: appId,
      name,
      key_hash: keyHash,
      key_prefix: apiKey.substring(0, 20), // Store prefix for identification
      is_active: true,
      environment,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create API key: ${error.message}`);
  }

  return {
    key: apiKey,
    hash: keyHash,
    id: data.id,
  };
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🔐 API Key Migration Script\n');
  console.log('This script will generate new API keys and store them in the database.');
  console.log('Make sure to save the generated keys - they cannot be retrieved later!\n');

  // Define apps to create keys for
  const apps = [
    { appId: 'platform', name: 'Platform API Key', environment: 'live' as const },
    { appId: 'hugo-love', name: 'Hugo Love API Key', environment: 'live' as const },
    { appId: 'hugo-career', name: 'Hugo Career API Key', environment: 'live' as const },
  ];

  const generatedKeys: Array<{
    app: string;
    name: string;
    key: string;
    hash: string;
    environment: string;
  }> = [];

  for (const app of apps) {
    try {
      console.log(`\n📝 Creating API key for ${app.name}...`);

      const result = await createApiKey(app.appId, app.name, app.environment);

      generatedKeys.push({
        app: app.appId,
        name: app.name,
        key: result.key,
        hash: result.hash,
        environment: app.environment,
      });

      console.log(`✅ Created API key for ${app.name}`);
      console.log(`   ID: ${result.id}`);
      console.log(`   Prefix: ${result.key.substring(0, 20)}...`);
    } catch (error) {
      console.error(`❌ Failed to create key for ${app.name}:`, error);
    }
  }

  // Display results
  console.log('\n' + '='.repeat(80));
  console.log('🎉 Migration Complete!\n');
  console.log('⚠️  IMPORTANT: Save these keys in a secure location (e.g., 1Password, Vault)');
  console.log('⚠️  These keys will NOT be shown again!\n');

  console.log('Generated API Keys:');
  console.log('='.repeat(80));

  for (const keyInfo of generatedKeys) {
    console.log(`\n${keyInfo.name}:`);
    console.log(`  App ID: ${keyInfo.app}`);
    console.log(`  Environment: ${keyInfo.environment}`);
    console.log(`  API Key: ${keyInfo.key}`);
    console.log(`  Hash (for verification): ${keyInfo.hash.substring(0, 16)}...`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📋 Next Steps:\n');
  console.log('1. Save the API keys above in your password manager');
  console.log('2. Update your application configs to use the new keys');
  console.log('3. Set the keys in your environment variables or config:');
  console.log('   - For platform apps, use the X-API-Key header');
  console.log('   - Keys should be prefixed with "oriva_pk_"');
  console.log('4. Remove old API_KEY_* environment variables');
  console.log('5. Test API key authentication with the new keys');
  console.log('6. Monitor logs for any authentication failures\n');

  console.log('📖 Documentation:');
  console.log('   See SECURITY_FIXES.md for detailed implementation notes\n');
}

/**
 * Verify a key can be authenticated
 */
async function verifyKey(apiKey: string): Promise<boolean> {
  const keyHash = hashApiKey(apiKey);

  const { data, error } = await supabase
    .schema('oriva_platform')
    .from('developer_api_keys')
    .select('id, is_active, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (error || !data) {
    console.log('❌ Key not found or error:', error?.message);
    return false;
  }

  if (!data.is_active) {
    console.log('⚠️  Key found but is inactive');
    return false;
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    console.log('⚠️  Key found but has expired');
    return false;
  }

  console.log('✅ Key is valid and active');
  return true;
}

// Command line interface
const command = process.argv[2];

if (command === 'verify' && process.argv[3]) {
  // Verify a specific key
  const keyToVerify = process.argv[3];
  console.log(`🔍 Verifying API key: ${keyToVerify.substring(0, 20)}...\n`);
  verifyKey(keyToVerify)
    .then((isValid) => {
      process.exit(isValid ? 0 : 1);
    })
    .catch((error) => {
      console.error('Error verifying key:', error);
      process.exit(1);
    });
} else if (command === 'generate' && process.argv[3]) {
  // Generate a single key
  const appId = process.argv[3];
  const name = process.argv[4] || `${appId} API Key`;
  const environment = (process.argv[5] as 'test' | 'live') || 'live';

  console.log(`🔑 Generating API key for app: ${appId}\n`);

  createApiKey(appId, name, environment)
    .then((result) => {
      console.log('✅ API Key Generated Successfully!\n');
      console.log('⚠️  Save this key - it cannot be retrieved later!\n');
      console.log(`API Key: ${result.key}`);
      console.log(`Hash: ${result.hash}`);
      console.log(`ID: ${result.id}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error generating key:', error);
      process.exit(1);
    });
} else {
  // Run full migration
  migrate()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}
