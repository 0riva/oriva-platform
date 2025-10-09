import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function executeSql(sql: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return response.json();
}

async function seed() {
  console.log('\n=== Seeding Database ===\n');

  const seedPath = path.join(__dirname, '../supabase/seed.sql');
  const seedSQL = fs.readFileSync(seedPath, 'utf-8');

  console.log('Executing seed.sql...\n');

  try {
    const result = await executeSql(seedSQL);
    console.log('✓ Seed data applied successfully!\n');
    console.log('Result:', result);
  } catch (error: any) {
    if (error.message.includes('function') && error.message.includes('does not exist')) {
      console.log('exec_sql function not available, trying direct approach...\n');

      // Execute INSERT statements individually
      const statements = seedSQL
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--') && s !== '' && s.includes('INSERT'));

      console.log(`Found ${statements.length} INSERT statements\n`);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];

        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ query: stmt }),
          });

          if (response.ok) {
            console.log(`✓ Statement ${i + 1}/${statements.length}`);
          } else {
            const error = await response.text();
            console.error(`✗ Statement ${i + 1}: ${error}`);
          }
        } catch (err) {
          console.error(`✗ Statement ${i + 1}: ${err}`);
        }
      }
    } else {
      console.error('Error:', error.message);
    }
  }

  // Verify using direct queries
  console.log('\n=== Verification ===\n');

  const checkSQL = fs.readFileSync('/tmp/check_data.sql', 'utf-8');

  try {
    const result = await executeSql(checkSQL);
    console.log('Database counts:', result);
  } catch (error: any) {
    console.error('Verification error:', error.message);
  }
}

seed().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
