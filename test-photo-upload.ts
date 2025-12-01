import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cbzgvlkizkdfjmbrosav.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDEwMjAsImV4cCI6MjA3MzYxNzAyMH0.GAqII3HLS7OKoKOWZxhfXhKEd55G1XpMPrM-MOJEdeg';
const BFF_URL = 'http://localhost:3002';

async function main() {
  // Sign in to get JWT token
  const supabase = createClient(SUPABASE_URL, ANON_KEY);

  console.log('=== Signing in ===');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'think@gavrielshaw.com',
    password: 'umn0xuh_CBP@jqc_exe',
  });

  if (authError) {
    console.error('Sign in error:', authError);
    return;
  }

  const token = authData.session?.access_token;
  console.log('Got token for user:', authData.user?.id);

  // Test userMedia endpoint
  console.log('\n=== Testing userMedia avatar upload ===');
  const uploadResponse = await fetch(`${BFF_URL}/api/v1/user/media/avatar/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileName: 'test-avatar.jpg',
      contentType: 'image/jpeg',
    }),
  });

  console.log('Status:', uploadResponse.status);
  const uploadResult = await uploadResponse.json();
  console.log('Response:', JSON.stringify(uploadResult, null, 2));

  if (uploadResult.uploadUrl) {
    console.log('\n✅ SUCCESS! Got pre-signed upload URL');
    console.log('Upload URL prefix:', uploadResult.uploadUrl.substring(0, 100) + '...');
    console.log('File Key:', uploadResult.key);
  }
}

main().catch(console.error);
