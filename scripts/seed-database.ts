import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment
dotenv.config({ path: '/Users/cosmic/Documents/oriva-platform/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('Connecting to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'oriva_platform' },
});

async function seed() {
  console.log('\n=== Seeding Test Data ===\n');

  // 1. Seed users
  console.log('1. Seeding users...');
  const users = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test1@example.com',
      full_name: 'Alice Johnson',
      auth_provider: 'oriva_sso',
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'test2@example.com',
      full_name: 'Bob Smith',
      auth_provider: 'oriva_sso',
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'test3@example.com',
      full_name: 'Carol Davis',
      auth_provider: 'oriva_sso',
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      email: 'admin@example.com',
      full_name: 'Admin User',
      auth_provider: 'oriva_sso',
    },
  ];

  for (const user of users) {
    const { error } = await supabase.from('users').upsert(user, { onConflict: 'id' });
    if (error) console.error(`Error inserting user ${user.email}:`, error.message);
  }
  console.log('✓ Users seeded\n');

  // 2. Seed apps
  console.log('2. Seeding apps...');
  const apps = [
    {
      id: '00000000-0000-0000-0000-000000000011',
      app_id: 'hugo_love',
      name: 'Hugo Love',
      description: 'Dating and relationship coaching',
      is_active: true,
      schema_name: 'hugo_love',
    },
    {
      id: '00000000-0000-0000-0000-000000000012',
      app_id: 'hugo_career',
      name: 'Hugo Career',
      description: 'Career coaching and development',
      is_active: true,
      schema_name: 'hugo_career',
    },
    {
      id: '00000000-0000-0000-0000-000000000013',
      app_id: 'hugo_test',
      name: 'Hugo Test',
      description: 'Test app for development',
      is_active: true,
      schema_name: 'hugo_test',
    },
  ];

  for (const app of apps) {
    const { error } = await supabase.from('apps').upsert(app, { onConflict: 'id' });
    if (error) console.error(`Error inserting app ${app.app_id}:`, error.message);
  }
  console.log('✓ Apps seeded\n');

  // 3. Seed user_app_access
  console.log('3. Seeding user-app access...');
  const userAppAccess = [
    {
      user_id: '00000000-0000-0000-0000-000000000001',
      app_id: '00000000-0000-0000-0000-000000000011',
      role: 'user',
      status: 'active',
    },
    {
      user_id: '00000000-0000-0000-0000-000000000002',
      app_id: '00000000-0000-0000-0000-000000000011',
      role: 'user',
      status: 'active',
    },
    {
      user_id: '00000000-0000-0000-0000-000000000002',
      app_id: '00000000-0000-0000-0000-000000000012',
      role: 'user',
      status: 'active',
    },
    {
      user_id: '00000000-0000-0000-0000-000000000003',
      app_id: '00000000-0000-0000-0000-000000000012',
      role: 'user',
      status: 'active',
    },
    {
      user_id: '00000000-0000-0000-0000-000000000004',
      app_id: '00000000-0000-0000-0000-000000000011',
      role: 'admin',
      status: 'active',
    },
    {
      user_id: '00000000-0000-0000-0000-000000000004',
      app_id: '00000000-0000-0000-0000-000000000013',
      role: 'admin',
      status: 'active',
    },
  ];

  for (const access of userAppAccess) {
    const { error } = await supabase
      .from('user_app_access')
      .upsert(access, { onConflict: 'user_id,app_id' });
    if (error) console.error(`Error inserting access:`, error.message);
  }
  console.log('✓ User-app access seeded\n');

  console.log('=== Seed Complete ===\n');
  console.log('Verifying data...\n');

  // Verify
  const { count: userCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });
  const { count: appCount } = await supabase
    .from('apps')
    .select('*', { count: 'exact', head: true });
  const { count: accessCount } = await supabase
    .from('user_app_access')
    .select('*', { count: 'exact', head: true });

  console.log(`Users: ${userCount}`);
  console.log(`Apps: ${appCount}`);
  console.log(`User-App Access: ${accessCount}`);
}

seed().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
