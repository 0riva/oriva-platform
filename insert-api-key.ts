import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const SUPABASE_URL = 'https://cbzgvlkizkdfjmbrosav.supabase.co';
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0MTAyMCwiZXhwIjoyMDczNjE3MDIwfQ.1fltuMIW9yQpsLBoeAeO3jw1uwBl2bL58VphLTBaAUs';

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Generate a test API key
  const keyPrefix = 'oriva_pk_test_';
  const keySuffix = crypto.randomBytes(24).toString('hex');
  const apiKey = keyPrefix + keySuffix;
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // User ID from DEV_USER_ID (tools@gavrielshaw.com)
  const userId = 'b5e9e6c9-e319-425a-b370-98bbd997bbf9';

  console.log('=== Creating API Key ===');
  console.log('API Key (SAVE THIS!):', apiKey);
  console.log('Key Prefix:', keyPrefix);
  console.log('Key Hash:', keyHash);
  console.log('User ID:', userId);

  // First, check if the table exists by trying to select
  console.log('\n=== Checking table existence ===');
  const { data: existing, error: checkError } = await supabase
    .from('developer_api_keys')
    .select('*')
    .limit(5);

  if (checkError) {
    console.error('Table check error:', checkError);
    return;
  }
  console.log('Table exists! Current rows:', existing?.length || 0);
  console.log('Existing keys:', JSON.stringify(existing, null, 2));

  // Insert the new API key
  console.log('\n=== Inserting API Key ===');
  const { data: inserted, error: insertError } = await supabase
    .from('developer_api_keys')
    .insert({
      user_id: userId,
      name: 'Hugo Love Development Key',
      key_hash: keyHash,
      key_prefix: keyPrefix,
      permissions: [
        'read:profiles',
        'write:sessions',
        'read:sessions',
        'write:photos',
        'read:photos',
      ],
      is_active: true,
      usage_count: 0,
    })
    .select();

  if (insertError) {
    console.error('Insert error:', insertError);
    return;
  }

  console.log('Insert successful!', JSON.stringify(inserted, null, 2));
  console.log('\n=== IMPORTANT: SAVE THIS API KEY ===');
  console.log(apiKey);
}

main().catch(console.error);
