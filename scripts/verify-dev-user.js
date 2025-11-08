/**
 * Verify dev user can authenticate
 */
/* global fetch */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54341';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEV_USER_EMAIL = 'dev@oriva.io';
const DEV_USER_PASSWORD = 'DevPassword123';

async function verifyDevUser() {
  console.log('🔍 Verifying dev user authentication...\n');

  // Test 1: Check user exists in admin API
  console.log('Test 1: Check user exists via admin API');
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: users, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error('❌ Error listing users:', listError.message);
    return;
  }

  const devUser = users?.users?.find((u) => u.email === DEV_USER_EMAIL);
  if (!devUser) {
    console.error('❌ Dev user not found in auth.users table');
    return;
  }

  console.log(`✅ User found: ${devUser.id}`);
  console.log(`   Email: ${devUser.email}`);
  console.log(`   Confirmed: ${devUser.email_confirmed_at ? 'Yes' : 'No'}`);

  // Test 2: Authenticate with credentials
  console.log('\nTest 2: Authenticate with credentials');
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: DEV_USER_EMAIL,
    password: DEV_USER_PASSWORD,
  });

  if (authError) {
    console.error('❌ Authentication failed:', authError.message);
    return;
  }

  console.log('✅ Authentication successful!');
  console.log(`   Access Token: ${authData.session.access_token.substring(0, 20)}...`);
  console.log(`   User ID: ${authData.user.id}`);

  // Test 3: Verify BFF proxy endpoint
  console.log('\nTest 3: Test BFF proxy login endpoint');
  try {
    const response = await fetch('http://localhost:3001/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: DEV_USER_EMAIL,
        password: DEV_USER_PASSWORD,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ BFF proxy login failed: ${response.status} ${errorText}`);
      return;
    }

    const bffData = await response.json();
    console.log('✅ BFF proxy authentication successful!');
    console.log(`   Session exists: ${!!bffData.session}`);
    console.log(`   User ID: ${bffData.user?.id}`);
  } catch (error) {
    console.error('❌ BFF proxy connection error:', error.message);
    console.log('   (Make sure BFF proxy is running on port 3001)');
  }

  console.log('\n🎉 All verifications passed! Dev login should work.');
}

verifyDevUser();
