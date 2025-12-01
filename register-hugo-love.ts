import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cbzgvlkizkdfjmbrosav.supabase.co';
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0MTAyMCwiZXhwIjoyMDczNjE3MDIwfQ.1fltuMIW9yQpsLBoeAeO3jw1uwBl2bL58VphLTBaAUs';

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log('=== Checking oriva_platform.apps table ===');

  // Check existing apps in oriva_platform schema
  const { data: existingApps, error: checkError } = await supabase
    .schema('oriva_platform')
    .from('apps')
    .select('*');

  if (checkError) {
    console.error('Error checking apps:', checkError);
    return;
  }

  console.log('Existing apps:', JSON.stringify(existingApps, null, 2));

  // Check if hugo_love already exists
  const hugoExists = existingApps?.some((app) => app.app_id === 'hugo_love');
  if (hugoExists) {
    console.log('\nhugo_love app already registered!');
    return;
  }

  // Register hugo_love app
  console.log('\n=== Registering hugo_love app ===');
  const { data: inserted, error: insertError } = await supabase
    .schema('oriva_platform')
    .from('apps')
    .insert({
      app_id: 'hugo_love',
      name: 'Hugo Love',
      description: 'Dating and relationship app for finding meaningful connections',
      schema_name: 'hugo_love',
      status: 'active',
      settings: {
        features: ['profiles', 'matching', 'messaging', 'photos'],
        photo_upload_enabled: true,
      },
    })
    .select();

  if (insertError) {
    console.error('Insert error:', insertError);
    return;
  }

  console.log('App registered successfully:', JSON.stringify(inserted, null, 2));
}

main().catch(console.error);
