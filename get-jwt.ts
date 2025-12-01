import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cbzgvlkizkdfjmbrosav.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDEwMjAsImV4cCI6MjA3MzYxNzAyMH0.GAqII3HLS7OKoKOWZxhfXhKEd55G1XpMPrM-MOJEdeg';

async function main() {
  const supabase = createClient(SUPABASE_URL, ANON_KEY);

  console.log('=== Signing in to get JWT token ===');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'think@gavrielshaw.com',
    password: 'umn0xuh_CBP@jqc_exe',
  });

  if (error) {
    console.error('Sign in error:', error);
    return;
  }

  console.log('User ID:', data.user?.id);
  console.log('\n=== JWT Token (SAVE THIS!) ===');
  console.log(data.session?.access_token);
}

main().catch(console.error);
