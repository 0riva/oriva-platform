import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cbzgvlkizkdfjmbrosav.supabase.co';
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0MTAyMCwiZXhwIjoyMDczNjE3MDIwfQ.1fltuMIW9yQpsLBoeAeO3jw1uwBl2bL58VphLTBaAUs';

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log('=== Listing all RPC functions ===');

  // Try to find available RPC functions
  const { data: rpcList, error: rpcError } = await supabase.rpc('list_available_rpcs');

  if (rpcError) {
    console.log('No list_available_rpcs function. Trying direct SQL approach...');

    // Try postgres_extensions for sql execution
    const { data: sqlResult, error: sqlError } = await supabase.rpc('query', {
      query_text: 'SELECT * FROM oriva_platform.apps LIMIT 10',
    });

    if (sqlError) {
      console.log('No query RPC either:', sqlError.message);
    } else {
      console.log('SQL result:', sqlResult);
    }
  } else {
    console.log('Available RPCs:', rpcList);
  }

  // Check if there's a register_app function
  console.log('\n=== Trying register_app RPC ===');
  const { data: regResult, error: regError } = await supabase.rpc('register_app', {
    p_app_id: 'hugo_love',
    p_name: 'Hugo Love',
    p_schema_name: 'hugo_love',
  });

  if (regError) {
    console.log('No register_app function:', regError.message);
  } else {
    console.log('Register result:', regResult);
  }

  // Try the schema rpc
  console.log('\n=== Trying get_app_info RPC ===');
  const { data: appInfo, error: infoError } = await supabase
    .schema('oriva_platform')
    .rpc('get_app_info', { p_app_id: 'hugo_love' });

  if (infoError) {
    console.log('No get_app_info function:', infoError.message);
  } else {
    console.log('App info:', appInfo);
  }
}

main().catch(console.error);
