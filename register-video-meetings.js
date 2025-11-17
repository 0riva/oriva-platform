const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cbzgvlkizkdfjmbrosav.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0MTAyMCwiZXhwIjoyMDczNjE3MDIwfQ.1fltuMIW9yQpsLBoeAeO3jw1uwBl2bL58VphLTBaAUs';

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'oriva_platform' },
});

async function registerApp() {
  console.log('🔄 Registering video-meetings app...');

  // Use raw SQL query
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      INSERT INTO oriva_platform.apps (id, app_id, name, description, schema_name, status, settings, created_at, updated_at)
      VALUES (
        '00000000-0000-0000-0000-000000000013',
        'video-meetings',
        'Video Meetings',
        'Whereby-powered video conferencing and scheduling',
        'video_meetings',
        'active',
        '{"quotas": {"max_users": 100000, "max_storage_gb": 200}, "features": ["video_conferencing", "scheduling", "whereby_integration"]}'::jsonb,
        NOW() - INTERVAL '1 day',
        NOW()
      )
      ON CONFLICT (app_id) DO UPDATE SET updated_at = NOW()
      RETURNING *;
    `,
  });

  if (error) {
    // Try direct table insert as fallback
    console.log('⚠️  RPC method failed, trying direct insert...');
    const { data: insertData, error: insertError } = await supabase
      .from('apps')
      .insert({
        id: '00000000-0000-0000-0000-000000000013',
        app_id: 'video-meetings',
        name: 'Video Meetings',
        description: 'Whereby-powered video conferencing and scheduling',
        schema_name: 'video_meetings',
        status: 'active',
        settings: {
          quotas: { max_users: 100000, max_storage_gb: 200 },
          features: ['video_conferencing', 'scheduling', 'whereby_integration'],
        },
      })
      .select();

    if (insertError) {
      console.error('❌ Error registering app:', insertError);
      process.exit(1);
    }

    console.log('✅ Video Meetings app registered successfully!');
    console.log(JSON.stringify(insertData, null, 2));
    return;
  }

  console.log('✅ Video Meetings app registered successfully!');
  console.log(JSON.stringify(data, null, 2));
}

registerApp();
