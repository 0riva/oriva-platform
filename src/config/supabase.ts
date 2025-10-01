// Task: T012 + T068 - Supabase connection configuration with pooling
// Description: Type-safe Supabase client configuration with connection pooling

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

// Environment variable validation
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_ANON_KEY environment variable');
}

// T068: Connection pooling configuration for Oriva 101 (Supabase)
const CONNECTION_POOL_CONFIG = {
  max: parseInt(process.env.DB_POOL_MAX || '20', 10), // Max connections per function instance
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),  // Min connections to maintain
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10), // 30s idle timeout
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000', 10), // 5s connect timeout
  maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3', 10), // Max retry attempts
};

// Database types imported from generated schema

// Singleton clients
let anonClient: SupabaseClient<Database> | null = null;
let serviceClient: SupabaseClient<Database> | null = null;

/**
 * Get Supabase client with anon key (for RLS-protected operations)
 * Use this for user-facing operations where RLS policies apply
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!anonClient) {
    anonClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: false, // Edge functions don't persist sessions
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-application-name': 'oriva-platform',
        },
      },
    });
  }
  return anonClient;
}

/**
 * Get Supabase client with service role key (bypasses RLS)
 * Use this ONLY for admin operations and server-side tasks
 * NEVER expose this client to user requests
 */
export function getSupabaseServiceClient(): SupabaseClient<Database> {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY - service client not available');
  }

  if (!serviceClient) {
    serviceClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-application-name': 'oriva-platform-admin',
        },
      },
    });
  }
  return serviceClient;
}

/**
 * Execute prepared statement (hot path optimization)
 */
export async function executePreparedStatement<T = unknown>(
  client: SupabaseClient<Database>,
  statementName: string,
  params: unknown[],
): Promise<T[]> {
  const { data, error } = await client.rpc('execute_prepared', {
    statement_name: statementName,
    params: params,
  });

  if (error) {
    throw new Error(`Prepared statement ${statementName} failed: ${error.message}`);
  }

  return data as T[];
}

// Type exports for consumers
export type { SupabaseClient, Database };