import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cbzgvlkizkdfjmbrosav.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA0MTAyMCwiZXhwIjoyMDczNjE3MDIwfQ.1fltuMIW9yQpsLBoeAeO3jw1uwBl2bL58VphLTBaAUs';

async function setup() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  
  const sqlStatements = [
    // Organizations table
    `CREATE TABLE IF NOT EXISTS travel_hub.organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        logo_url TEXT,
        website TEXT,
        description TEXT,
        settings JSONB DEFAULT '{}',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    // Organization memberships table
    `CREATE TABLE IF NOT EXISTS travel_hub.organization_memberships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        organization_id UUID NOT NULL REFERENCES travel_hub.organizations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('admin', 'org_admin', 'concierge_agent', 'viewer')),
        status TEXT DEFAULT 'active',
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, organization_id)
    )`
  ];
  
  for (const sql of sqlStatements) {
    console.log('Executing:', sql.substring(0, 60) + '...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Result:', data);
    }
  }
}

setup();
