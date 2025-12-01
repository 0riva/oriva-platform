import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cbzgvlkizkdfjmbrosav.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0MTAyMCwiZXhwIjoyMDczNjE3MDIwfQ.1fltuMIW9yQpsLBoeAeO3jw1uwBl2bL58VphLTBaAUs';

async function checkSchemas() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  
  // Use exec_sql_rows to get actual rows back
  const { data, error } = await supabase.rpc('exec_sql_rows', {
    sql_query: `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT LIKE 'pg_%' 
      AND schema_name != 'information_schema'
      ORDER BY schema_name;
    `
  });
    
  if (error) {
    console.error('Error:', error);
    
    // Try raw query
    const { data: rawData, error: rawError } = await supabase
      .from('_prisma_migrations')
      .select('*')
      .limit(1);
    console.log('Fallback check:', rawData || rawError);
  } else {
    console.log('Schemas:', data);
  }
}

checkSchemas();
