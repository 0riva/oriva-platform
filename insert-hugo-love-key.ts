import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const SUPABASE_URL = 'https://cbzgvlkizkdfjmbrosav.supabase.co';
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0MTAyMCwiZXhwIjoyMDczNjE3MDIwfQ.1fltuMIW9yQpsLBoeAeO3jw1uwBl2bL58VphLTBaAUs';

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // The API key that's already in the Vercel bundle
  const apiKey = 'oriva_pk_live_67361d6a1ec065c848635d0ad1a48ffb622cbbf349dd86c2d00f33e35bea9ce3';
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const keyPrefix = apiKey.substring(0, 20);

  // User ID for tools@gavrielshaw.com
  const userId = 'b5e9e6c9-e319-425a-b370-98bbd997bbf9';

  console.log('=== Inserting Hugo Love Production API Key ===');
  console.log('Key Prefix:', keyPrefix);
  console.log('Key Hash:', keyHash);

  const { data, error } = await supabase
    .from('developer_api_keys')
    .insert({
      user_id: userId,
      name: 'Hugo Love Production Key',
      key_hash: keyHash,
      key_prefix: keyPrefix,
      permissions: [
        'read:profiles',
        'read:user',
        'write:sessions',
        'read:sessions',
        'write:photos',
        'read:photos',
      ],
      is_active: true,
      usage_count: 0,
    })
    .select();

  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Insert successful!', JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
