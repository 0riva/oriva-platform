import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cbzgvlkizkdfjmbrosav.supabase.co';
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0MTAyMCwiZXhwIjoyMDczNjE3MDIwfQ.1fltuMIW9yQpsLBoeAeO3jw1uwBl2bL58VphLTBaAUs';

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Try to get table info via information_schema
  console.log('=== Checking information_schema for oriva_platform tables ===');
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name, table_type')
    .eq('table_schema', 'oriva_platform')
    .limit(20);

  if (tablesError) {
    console.log('Cannot access information_schema, trying RPC...');
    // Try an RPC to get schema info
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_schema_tables', {
      schema_name: 'oriva_platform',
    });
    if (rpcError) {
      console.error('RPC error:', rpcError);
    } else {
      console.log('Tables via RPC:', rpcData);
    }
  } else {
    console.log('Tables in oriva_platform:', tables);
  }

  // Try public schema tables
  console.log('\n=== Checking public schema tables ===');
  const { data: publicTables, error: publicError } = await supabase
    .from('profiles')
    .select('id, profile_name')
    .limit(5);

  if (publicError) {
    console.error('Error fetching profiles:', publicError);
  } else {
    console.log('Profiles:', JSON.stringify(publicTables, null, 2));
  }
}

main().catch(console.error);
