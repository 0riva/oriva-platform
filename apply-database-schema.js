#!/usr/bin/env node

// Script to apply the complete database schema to fix API logic bugs
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Required environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyDatabaseSchema() {
  console.log('🔧 Applying complete database schema...\n');

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'internal-docs', 'supabase-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Split the schema into individual statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`   ${i + 1}/${statements.length}: Executing statement...`);
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            // Some errors are expected (like table already exists)
            if (error.message.includes('already exists') || 
                error.message.includes('duplicate key') ||
                error.message.includes('relation already exists')) {
              console.log(`   ⚠️  Statement skipped (already exists): ${error.message.substring(0, 100)}...`);
            } else {
              console.error(`   ❌ Error executing statement: ${error.message}`);
            }
          } else {
            console.log(`   ✅ Statement executed successfully`);
          }
        } catch (err) {
          console.error(`   ❌ Exception executing statement: ${err.message}`);
        }
      }
    }

    console.log('\n🔍 Verifying table creation...');
    
    // Check if tables exist
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

    console.log('\n🎉 Database schema application completed!');
    console.log('📋 Next steps:');
    console.log('   1. Run the debug script to test the API logic');
    console.log('   2. Test the API endpoints to ensure they work correctly');
    console.log('   3. Deploy the updated schema to production if needed');

  } catch (error) {
    console.error('❌ Failed to apply database schema:', error);
    process.exit(1);
  }
}

// Alternative approach using direct SQL execution
async function applySchemaDirect() {
  console.log('🔧 Applying database schema using direct SQL execution...\n');

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'internal-docs', 'supabase-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Execute the entire schema at once
    const { error } = await supabase.rpc('exec_sql', { sql: schemaSQL });
    
    if (error) {
      console.error('❌ Error applying schema:', error);
      return false;
    }

    console.log('✅ Database schema applied successfully!');
    return true;

  } catch (error) {
    console.error('❌ Failed to apply schema:', error);
    return false;
  }
}

// Check if we can use direct SQL execution
async function checkDirectSQLSupport() {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    return !error;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🚀 Starting database schema application...\n');
  
  // Check if direct SQL execution is supported
  const supportsDirectSQL = await checkDirectSQLSupport();
  
  if (supportsDirectSQL) {
    console.log('✅ Direct SQL execution supported, using direct method');
    await applySchemaDirect();
  } else {
    console.log('⚠️  Direct SQL execution not supported, using statement-by-statement method');
    await applyDatabaseSchema();
  }
}

main().catch(console.error);
