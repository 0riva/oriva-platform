// Bootstrap script to insert first master admin into travel_hub.system_users
// Run with: node /tmp/bootstrap_master_admin.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://cbzgvlkizkdfjmbrosav.supabase.co';
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0MTAyMCwiZXhwIjoyMDczNjE3MDIwfQ.1fltuMIW9yQpsLBoeAeO3jw1uwBl2bL58VphLTBaAUs';

// tools@gavrielshaw.com
const USER_ID = 'b5e9e6c9-e319-425a-b370-98bbd997bbf9';

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    db: { schema: 'travel_hub' },
  });

  console.log('=== Bootstrapping Master Admin ===');
  console.log('User ID:', USER_ID);

  // Check if already exists
  const { data: existing, error: checkError } = await supabase
    .from('system_users')
    .select('*')
    .eq('user_id', USER_ID)
    .maybeSingle();

  if (checkError) {
    console.error('Error checking existing:', checkError);
    process.exit(1);
  }

  if (existing) {
    console.log('User already exists:', existing);
    if (!existing.is_master_admin || !existing.is_active) {
      // Update to make master admin
      const { data: updated, error: updateError } = await supabase
        .from('system_users')
        .update({ is_master_admin: true, is_active: true })
        .eq('user_id', USER_ID)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating:', updateError);
        process.exit(1);
      }
      console.log('Updated to master admin:', updated);
    }
    return;
  }

  // Insert new system user
  const { data, error } = await supabase
    .from('system_users')
    .insert({
      user_id: USER_ID,
      is_master_admin: true,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting:', error);
    process.exit(1);
  }

  console.log('Successfully created master admin:', data);
}

main().catch(console.error);
