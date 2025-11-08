/**
 * Create dev user for Work Buddy testing
 *
 * This script creates a test user in the local Supabase instance:
 * - Email: dev@oriva.io
 * - Password: DevPassword123
 *
 * The user will be available for dev login in Work Buddy app.
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment from o-platform
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54341';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const DEV_USER_EMAIL = 'dev@oriva.io';
const DEV_USER_PASSWORD = 'DevPassword123';

async function createDevUser() {
  console.log('🔧 Creating dev user in local Supabase...\n');
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log(`   Email: ${DEV_USER_EMAIL}`);
  console.log(`   Password: ${DEV_USER_PASSWORD}\n`);

  // Create Supabase admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error checking existing users:', listError.message);
      process.exit(1);
    }

    const existingUser = existingUsers?.users?.find((u) => u.email === DEV_USER_EMAIL);

    if (existingUser) {
      console.log(`ℹ️  User ${DEV_USER_EMAIL} already exists (ID: ${existingUser.id})`);
      console.log('   Updating password to DevPassword123...\n');

      // Update existing user's password
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: DEV_USER_PASSWORD }
      );

      if (updateError) {
        console.error('❌ Error updating user password:', updateError.message);
        process.exit(1);
      }

      console.log('✅ Password updated successfully!');
      console.log('\n📋 User Details:');
      console.log(`   User ID: ${updatedUser.user.id}`);
      console.log(`   Email: ${updatedUser.user.email}`);
      console.log(`   Email Confirmed: ${updatedUser.user.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log(`   Created At: ${updatedUser.user.created_at}`);
    } else {
      // Create new user
      console.log('Creating new user...\n');

      const { data, error } = await supabase.auth.admin.createUser({
        email: DEV_USER_EMAIL,
        password: DEV_USER_PASSWORD,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          display_name: 'Dev User',
          created_by: 'dev-script',
        },
      });

      if (error) {
        console.error('❌ Error creating user:', error.message);
        process.exit(1);
      }

      console.log('✅ User created successfully!');
      console.log('\n📋 User Details:');
      console.log(`   User ID: ${data.user.id}`);
      console.log(`   Email: ${data.user.email}`);
      console.log(`   Email Confirmed: ${data.user.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log(`   Created At: ${data.user.created_at}`);
    }

    console.log('\n🎉 Dev user is ready for use!');
    console.log('\n📝 You can now login with:');
    console.log(`   Email: ${DEV_USER_EMAIL}`);
    console.log(`   Password: ${DEV_USER_PASSWORD}`);
    console.log('\n🚀 Test it at: http://localhost:8084 (Work Buddy app)');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
createDevUser();
