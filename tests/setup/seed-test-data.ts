// Idempotent test fixtures for the tests/api/*.test.js suite.
//
// The suite authenticates with testData.validApiKey ('oriva_pk_test_valid_key',
// see tests/utils/testHelpers.js). validateApiKey in api/index.ts hashes the
// key (SHA-256 hex) and looks it up in public.developer_api_keys — so the
// suite needs that row to exist. This seeds it against the existing local
// test profile (gav_test / tools@gavrielshaw.com).
//
// Runs from tests/setup/global-setup.ts before the suite. Safe to run
// repeatedly — it deletes the test key by hash first, then re-inserts.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

// 'oriva_pk_test_valid_key' → SHA-256 hex. Matches hashAPIKey() in api/index.ts.
const TEST_API_KEY = 'oriva_pk_test_valid_key';
const TEST_API_KEY_HASH = crypto.createHash('sha256').update(TEST_API_KEY).digest('hex');

// The local OrivaLocalDB ships with this profile (username gav_test). Its
// account_id is what validateApiKey exposes as keyInfo.userId.
const TEST_ACCOUNT_ID = '718f8c69-4601-46ba-a351-54afcddd1634';

export async function seedTestData(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.warn('[SEED] SUPABASE_URL / SERVICE_ROLE_KEY not set — skipping test seed');
    return;
  }

  const supabase: SupabaseClient = createClient(url, serviceKey);

  // Confirm the local test profile exists before seeding a key that points at it.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, account_id')
    .eq('account_id', TEST_ACCOUNT_ID)
    .maybeSingle();

  if (profileError) {
    console.warn('[SEED] Could not query profiles — skipping test seed:', profileError.message);
    return;
  }
  if (!profile) {
    console.warn(
      `[SEED] Test profile (account_id ${TEST_ACCOUNT_ID}) not found — skipping test seed. ` +
        'Run against an OrivaLocalDB that has the gav_test profile.'
    );
    return;
  }

  // Idempotent: drop any prior test key, then insert a fresh one.
  await supabase.from('developer_api_keys').delete().eq('key_hash', TEST_API_KEY_HASH);

  const { error: insertError } = await supabase.from('developer_api_keys').insert({
    user_id: TEST_ACCOUNT_ID,
    name: 'Test Suite Key',
    key_hash: TEST_API_KEY_HASH,
    key_prefix: 'oriva_pk_test_',
    permissions: [
      'read:profile',
      'read:entries',
      'read:marketplace',
      'write:marketplace',
      'read:groups',
      'admin',
    ],
    is_active: true,
  });

  if (insertError) {
    console.warn('[SEED] Failed to insert test API key:', insertError.message);
    return;
  }

  console.log('[SEED] Test API key seeded for account', TEST_ACCOUNT_ID);
}
