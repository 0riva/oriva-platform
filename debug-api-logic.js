#!/usr/bin/env node

// Comprehensive debug script to identify API logic bugs
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugAPILogic() {
  console.log('🔍 Comprehensive API Logic Debug...\n');

  // Test 1: Check the exact API key being used
  console.log('1️⃣ Testing API Key Authentication:');
  const testApiKey = 'oriva_pk_test_728d35f07d86575f7b3a44d18791ffed';
  
  // Hash the API key like the API does
  const crypto = require('crypto');
  const hashAPIKey = async (key) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');
  };
  
  const keyHash = await hashAPIKey(testApiKey);
  console.log(`   API Key Hash: ${keyHash.substring(0, 20)}...`);
  
  const { data: keyData, error: keyError } = await supabase
    .from('developer_api_keys')
    .select('id, user_id, name, permissions, is_active, usage_count')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single();
  
  if (keyError || !keyData) {
    console.error('❌ API key validation failed:', keyError);
    return;
  }
  
  console.log('✅ API key validated successfully');
  console.log(`   Key ID: ${keyData.id}`);
  console.log(`   User ID: ${keyData.user_id}`);
  console.log(`   Name: ${keyData.name}`);

  // Test 2: Check what user_id the API will use
  console.log('\n2️⃣ API User ID Resolution:');
  const apiUserId = keyData.user_id;
  console.log(`   API will use user_id: ${apiUserId}`);

  // Test 3: Check what's in user_app_installs for this user
  console.log('\n3️⃣ Checking user_app_installs for API user:');
  const { data: userInstalls, error: userInstallsError } = await supabase
    .from('user_app_installs')
    .select('*')
    .eq('user_id', apiUserId);
  
  if (userInstallsError) {
    console.error('❌ Error fetching user_app_installs:', userInstallsError);
  } else {
    console.log(`✅ Found ${userInstalls?.length || 0} installations for API user`);
    userInstalls?.forEach(install => {
      console.log(`   - App ID: ${install.app_id}, Active: ${install.is_active}, Installed: ${install.installed_at}`);
    });
  }

  // Test 4: Check what's in user_app_installs for the user who has the app
  console.log('\n4️⃣ Checking user_app_installs for app owner:');
  const appOwnerUserId = 'd5d7911d-c847-4733-b8b8-d1a1939ff77d';
  const { data: ownerInstalls, error: ownerInstallsError } = await supabase
    .from('user_app_installs')
    .select('*')
    .eq('user_id', appOwnerUserId);
  
  if (ownerInstallsError) {
    console.error('❌ Error fetching owner installs:', ownerInstallsError);
  } else {
    console.log(`✅ Found ${ownerInstalls?.length || 0} installations for app owner`);
    ownerInstalls?.forEach(install => {
      console.log(`   - App ID: ${install.app_id}, Active: ${install.is_active}, Installed: ${install.installed_at}`);
    });
  }

  // Test 5: Test the exact API query with the API user's ID
  console.log('\n5️⃣ Testing API query with API user ID:');
  const { data: apiUserApps, error: apiUserError } = await supabase
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
    .eq('user_id', apiUserId)
    .eq('is_active', true)
    .order('installed_at', { ascending: false });

  if (apiUserError) {
    console.error('❌ API user query error:', apiUserError);
  } else {
    console.log(`✅ API user query successful, found ${apiUserApps?.length || 0} apps`);
    apiUserApps?.forEach(app => {
      console.log(`   - ${app.plugin_marketplace_apps?.name || 'Unknown'} (${app.app_id})`);
    });
  }

  // Test 6: Test the exact API query with the app owner's ID
  console.log('\n6️⃣ Testing API query with app owner ID:');
  const { data: ownerApps, error: ownerError } = await supabase
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
    .eq('user_id', appOwnerUserId)
    .eq('is_active', true)
    .order('installed_at', { ascending: false });

  if (ownerError) {
    console.error('❌ App owner query error:', ownerError);
  } else {
    console.log(`✅ App owner query successful, found ${ownerApps?.length || 0} apps`);
    ownerApps?.forEach(app => {
      console.log(`   - ${app.plugin_marketplace_apps?.name || 'Unknown'} (${app.app_id})`);
    });
  }

  // Test 7: Check if there's a mismatch in the API logic
  console.log('\n7️⃣ API Logic Analysis:');
  console.log(`   API Key User ID: ${apiUserId}`);
  console.log(`   App Owner User ID: ${appOwnerUserId}`);
  console.log(`   Are they the same? ${apiUserId === appOwnerUserId ? 'YES' : 'NO'}`);
  
  if (apiUserId !== appOwnerUserId) {
    console.log('❌ BUG IDENTIFIED: API is filtering by the wrong user ID!');
    console.log('   The API key belongs to a different user than the one who has the app installed.');
    console.log('   This is why the endpoint returns empty data.');
  } else {
    console.log('✅ User IDs match - no bug in user ID filtering');
  }

  // Test 8: Check if the API is using the correct authentication method
  console.log('\n8️⃣ Authentication Method Analysis:');
  console.log('   The /api/v1/marketplace/installed endpoint uses validateAuth middleware');
  console.log('   This supports both API keys and Supabase JWT tokens');
  console.log('   When using an API key, it should filter by the API key owner\'s user_id');
  console.log('   When using a Supabase JWT, it should filter by the JWT user\'s ID');
  
  // Test 9: Check what the Oriva Core dev team should be using
  console.log('\n9️⃣ Solution for Oriva Core Dev Team:');
  console.log('   Option 1: Use a Supabase JWT token for user d5d7911d-c847-4733-b8b8-d1a1939ff77d');
  console.log('   Option 2: Use an API key that belongs to user d5d7911d-c847-4733-b8b8-d1a1939ff77d');
  console.log('   Option 3: Install the app for the current API key user');
  
  // Test 10: Check if there are API keys for the app owner
  console.log('\n🔟 Checking API keys for app owner:');
  const { data: ownerKeys, error: ownerKeysError } = await supabase
    .from('developer_api_keys')
    .select('id, name, user_id, is_active')
    .eq('user_id', appOwnerUserId)
    .eq('is_active', true);
  
  if (ownerKeysError) {
    console.error('❌ Error fetching owner API keys:', ownerKeysError);
  } else {
    console.log(`✅ Found ${ownerKeys?.length || 0} API keys for app owner`);
    ownerKeys?.forEach(key => {
      console.log(`   - ${key.name} (${key.id})`);
    });
  }

  // Test 11: Test the actual API endpoint
  console.log('\n1️⃣1️⃣ Testing actual API endpoint:');
  try {
    const response = await fetch('http://localhost:3001/api/v1/marketplace/installed', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${data.success}`);
    if (data.success) {
      console.log(`   Found ${data.data?.length || 0} installed apps`);
      data.data?.forEach(app => {
        console.log(`   - ${app.app?.name || 'Unknown'} (${app.installationId})`);
      });
    } else {
      console.log(`   Error: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ API endpoint test failed:', error.message);
  }

  // Test 12: Check database table existence
  console.log('\n1️⃣2️⃣ Checking database table existence:');
  const tables = ['developer_api_keys', 'plugin_marketplace_apps', 'user_app_installs', 'plugin_versions'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`   ❌ Table ${table}: ${error.message}`);
      } else {
        console.log(`   ✅ Table ${table}: exists and accessible`);
      }
    } catch (err) {
      console.log(`   ❌ Table ${table}: ${err.message}`);
    }
  }
}

debugAPILogic().catch(console.error);
