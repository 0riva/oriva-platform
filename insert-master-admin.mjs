import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cbzgvlkizkdfjmbrosav.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0MTAyMCwiZXhwIjoyMDczNjE3MDIwfQ.1fltuMIW9yQpsLBoeAeO3jw1uwBl2bL58VphLTBaAUs';

const USER_ID = '205bcd51-a0a4-41c8-9ef6-ef971d9706f5'; // think@gavrielshaw.com

async function insertMasterAdmin() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  
  // Use exec_sql RPC function
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      INSERT INTO travel_hub.system_users (user_id, is_master_admin, is_active)
      VALUES ('${USER_ID}', true, true)
      ON CONFLICT (user_id) 
      DO UPDATE SET is_master_admin = true, is_active = true
      RETURNING *;
    `
  });
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}

insertMasterAdmin();
