// Task: T012 + T068 - Supabase connection configuration with pooling
// Description: Type-safe Supabase client configuration with connection pooling

import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

// Database types (will be generated from Supabase CLI)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          oriva_user_id: string;
          email: string;
          preferences: Record<string, unknown>;
          subscription_tier: 'free' | 'premium' | 'enterprise';
          data_retention_days: number;
          created_at: string;
          updated_at: string;
          last_active_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      apps: {
        Row: {
          id: string;
          app_id: string;
          display_name: string;
          domain: 'dating' | 'career' | 'health' | 'finance' | 'relationships' | 'general';
          personality_schema_id: string | null;
          knowledge_base_ids: string[];
          is_active: boolean;
          requires_subscription: boolean;
          description: string | null;
          icon_url: string | null;
          app_store_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['apps']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['apps']['Insert']>;
      };
      conversations: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          app_id: string;
          title: string | null;
          message_count: number;
          created_at: string;
          last_message_at: string;
          closed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at' | 'last_message_at'>;
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: 'user' | 'assistant';
          content: string;
          model: string | null;
          confidence_score: number | null;
          intimacy_code_reference: string | null;
          generation_time_ms: number | null;
          tokens_used: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
      knowledge_bases: {
        Row: {
          id: string;
          kb_id: string;
          title: string;
          description: string | null;
          app_ids: string[];
          owner_org: string;
          version: string;
          parent_kb_id: string | null;
          entry_count: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['knowledge_bases']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['knowledge_bases']['Insert']>;
      };
      knowledge_entries: {
        Row: {
          id: string;
          knowledge_base_id: string;
          title: string;
          content: string;
          category: string | null;
          tags: string[];
          section_number: number | null;
          vector_store_id: string | null;
          metadata: Record<string, unknown>;
          access_count: number;
          last_accessed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['knowledge_entries']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['knowledge_entries']['Insert']>;
      };
      personality_schemas: {
        Row: {
          id: string;
          schema_id: string;
          version: string;
          layer: 'base' | 'overlay';
          parent_schema_id: string | null;
          schema: Record<string, unknown>;
          status: 'draft' | 'testing' | 'active' | 'archived';
          rollout_percentage: number;
          ab_test_group: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          activated_at: string | null;
          archived_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['personality_schemas']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['personality_schemas']['Insert']>;
      };
      user_progress: {
        Row: {
          id: string;
          user_id: string;
          app_id: string;
          progress_data: Record<string, unknown>;
          milestones_reached: string[];
          current_focus_area: string | null;
          total_conversations: number;
          total_messages: number;
          started_at: string;
          last_updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_progress']['Row'], 'id' | 'started_at' | 'last_updated_at'>;
        Update: Partial<Database['public']['Tables']['user_progress']['Insert']>;
      };
      user_memories: {
        Row: {
          id: string;
          user_id: string;
          app_id: string;
          conversation_id: string | null;
          memory_type: 'conversation_context' | 'user_preference' | 'milestone' | 'insight';
          content: string;
          importance: number;
          relevance_decay_rate: number;
          created_at: string;
          last_accessed_at: string | null;
          expires_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['user_memories']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['user_memories']['Insert']>;
      };
    };
  };
}

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