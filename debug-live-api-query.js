#!/usr/bin/env node

// Debug script to test the exact live API query logic
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugLiveAPIQuery() {
  console.log('🔍 Debugging Live API Query Logic...\n');

  const userId = 'd5d7911d-c847-4733-b8b8-d1a1939ff77d';
  const appId = 'e06a3dae-0268-4b2f-96d0-71be22a13f64';

  // Test 1: Check if the user_app_installs record exists
  console.log('1️⃣ Checking user_app_installs record:');
  const { data: installRecord, error: installError } = await supabase
    .from('user_app_installs')
    .select('*')
    .eq('user_id', userId)
    .eq('app_id', appId)
    .eq('is_active', true)
    .single();

  if (installError) {
    console.error('❌ Error fetching install record:', installError);
  } else if (!installRecord) {
    console.error('❌ No install record found');
  } else {
    console.log('✅ Install record found:');
    console.log(`   ID: ${installRecord.id}`);
    console.log(`   User ID: ${installRecord.user_id}`);
    console.log(`   App ID: ${installRecord.app_id}`);
    console.log(`   Active: ${installRecord.is_active}`);
    console.log(`   Installed: ${installRecord.installed_at}`);
  }

  // Test 2: Check if the plugin_marketplace_apps record exists
  console.log('\n2️⃣ Checking plugin_marketplace_apps record:');
  const { data: appRecord, error: appError } = await supabase
    .from('plugin_marketplace_apps')
    .select('*')
    .eq('id', appId)
    .single();

  if (appError) {
    console.error('❌ Error fetching app record:', appError);
  } else if (!appRecord) {
    console.error('❌ No app record found');
  } else {
    console.log('✅ App record found:');
    console.log(`   ID: ${appRecord.id}`);
    console.log(`   Name: ${appRecord.name}`);
    console.log(`   Status: ${appRecord.status}`);
    console.log(`   Active: ${appRecord.is_active}`);
  }

  // Test 3: Test the exact API query step by step
  console.log('\n3️⃣ Testing API query step by step:');
  
  // Step 3a: Basic user_app_installs query
  console.log('   Step 3a: Basic user_app_installs query');
  const { data: basicInstalls, error: basicError } = await supabase
    .from('user_app_installs')
    .select('id, app_id, installed_at, is_active, app_settings')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('installed_at', { ascending: false });

  if (basicError) {
    console.error('❌ Basic query error:', basicError);
  } else {
    console.log(`✅ Basic query successful, found ${basicInstalls?.length || 0} records`);
    basicInstalls?.forEach(install => {
      console.log(`   - App ID: ${install.app_id}, Active: ${install.is_active}`);
    });
  }

  // Step 3b: Test the JOIN with explicit foreign key
  console.log('\n   Step 3b: Testing JOIN with explicit foreign key');
  const { data: joinedInstalls, error: joinedError } = await supabase
    .from('user_app_installs')
    .select(`
      id,
      app_id,
      installed_at,
      is_active,
      app_settings,
      plugin_marketplace_apps!user_app_installs_app_id_fkey (
        id,
        name,
        slug,
        tagline,
        description,
        category,
        icon_url,
        version,
        developer_name,
        install_count
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('installed_at', { ascending: false });

  if (joinedError) {
    console.error('❌ JOIN query error:', joinedError);
    console.error('   Error details:', JSON.stringify(joinedError, null, 2));
  } else {
    console.log(`✅ JOIN query successful, found ${joinedInstalls?.length || 0} records`);
    joinedInstalls?.forEach(install => {
      console.log(`   - App: ${install.plugin_marketplace_apps?.name || 'Unknown'}`);
      console.log(`   - App ID: ${install.app_id}`);
      console.log(`   - App Data: ${JSON.stringify(install.plugin_marketplace_apps, null, 2)}`);
    });
  }

  // Test 4: Check if there are any RLS policies blocking the query
  console.log('\n4️⃣ Checking RLS policies:');
  console.log('   Using service role key, so RLS should be bypassed');
  console.log('   But let\'s verify the query works with different approaches');

  // Test 4a: Try without the explicit foreign key
  console.log('\n   Step 4a: Testing without explicit foreign key');
  const { data: simpleJoin, error: simpleJoinError } = await supabase
    .from('user_app_installs')
    .select(`
      id,
      app_id,
      installed_at,
      is_active,
      app_settings,
      plugin_marketplace_apps (
        id,
        name,
        slug,
        tagline,
        description,
        category,
        icon_url,
        version,
        developer_name,
        install_count
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('installed_at', { ascending: false });

  if (simpleJoinError) {
    console.error('❌ Simple JOIN error:', simpleJoinError);
  } else {
    console.log(`✅ Simple JOIN successful, found ${simpleJoin?.length || 0} records`);
  }

  // Test 5: Check if the issue is with the specific app
  console.log('\n5️⃣ Testing with different app IDs:');
  const { data: allInstalls, error: allInstallsError } = await supabase
    .from('user_app_installs')
    .select('app_id')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (allInstallsError) {
    console.error('❌ Error fetching all installs:', allInstallsError);
  } else {
    console.log(`✅ Found ${allInstalls?.length || 0} total installs for user`);
    allInstalls?.forEach(install => {
      console.log(`   - App ID: ${install.app_id}`);
    });
  }

  // Test 6: Check if the issue is with the foreign key relationship
  console.log('\n6️⃣ Testing foreign key relationship:');
  const { data: fkTest, error: fkError } = await supabase
    .from('user_app_installs')
    .select(`
      id,
      app_id,
      plugin_marketplace_apps!inner (
        id,
        name
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true);

  if (fkError) {
    console.error('❌ Foreign key test error:', fkError);
  } else {
    console.log(`✅ Foreign key test successful, found ${fkTest?.length || 0} records`);
    fkTest?.forEach(install => {
      console.log(`   - App: ${install.plugin_marketplace_apps?.name || 'Unknown'}`);
    });
  }

  // Test 7: Check if the issue is with the specific columns being selected
  console.log('\n7️⃣ Testing with minimal column selection:');
  const { data: minimalTest, error: minimalError } = await supabase
    .from('user_app_installs')
    .select(`
      id,
      app_id,
      plugin_marketplace_apps!user_app_installs_app_id_fkey (
        id,
        name
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true);

  if (minimalError) {
    console.error('❌ Minimal test error:', minimalError);
  } else {
    console.log(`✅ Minimal test successful, found ${minimalTest?.length || 0} records`);
    minimalTest?.forEach(install => {
      console.log(`   - App: ${install.plugin_marketplace_apps?.name || 'Unknown'}`);
    });
  }

  // Test 8: Check if the issue is with the order by clause
  console.log('\n8️⃣ Testing without order by clause:');
  const { data: noOrderTest, error: noOrderError } = await supabase
    .from('user_app_installs')
    .select(`
      id,
      app_id,
      plugin_marketplace_apps!user_app_installs_app_id_fkey (
        id,
        name
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true);

  if (noOrderError) {
    console.error('❌ No order test error:', noOrderError);
  } else {
    console.log(`✅ No order test successful, found ${noOrderTest?.length || 0} records`);
  }

  // Test 9: Check if the issue is with the range/limit
  console.log('\n9️⃣ Testing with range/limit:');
  const { data: rangeTest, error: rangeError } = await supabase
    .from('user_app_installs')
    .select(`
      id,
      app_id,
      plugin_marketplace_apps!user_app_installs_app_id_fkey (
        id,
        name
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .range(0, 49); // Same as API default

  if (rangeError) {
    console.error('❌ Range test error:', rangeError);
  } else {
    console.log(`✅ Range test successful, found ${rangeTest?.length || 0} records`);
  }

  // Test 10: Final comprehensive test with exact API query
  console.log('\n🔟 Final comprehensive test with exact API query:');
  const { data: finalTest, error: finalError } = await supabase
    .from('user_app_installs')
    .select(`
      id,
      app_id,
      installed_at,
      is_active,
      app_settings,
      plugin_marketplace_apps!user_app_installs_app_id_fkey (
        id,
        name,
        slug,
        tagline,
        description,
        category,
        icon_url,
        version,
        developer_name,
        install_count
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('installed_at', { ascending: false })
    .range(0, 49);

  if (finalError) {
    console.error('❌ Final test error:', finalError);
    console.error('   This is the exact error the API should be getting');
  } else {
    console.log(`✅ Final test successful, found ${finalTest?.length || 0} records`);
    if (finalTest?.length > 0) {
      console.log('   The API query should work! Something else is wrong.');
    } else {
      console.log('   The API query returns empty - this matches the live API behavior.');
    }
  }
}

debugLiveAPIQuery().catch(console.error);
