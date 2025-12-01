import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cbzgvlkizkdfjmbrosav.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0MTAyMCwiZXhwIjoyMDczNjE3MDIwfQ.1fltuMIW9yQpsLBoeAeO3jw1uwBl2bL58VphLTBaAUs';

async function checkSchema() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  
  // Check if travel_hub schema exists
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'travel_hub';
    `
  });
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Schema check result:', data);
  }
}

checkSchema();
