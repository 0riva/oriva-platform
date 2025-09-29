import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseQueryResult } from '../types/database/entities';

export const toQueryResult = <T>(
  data: T | null,
  error: PostgrestError | null,
  count?: number | null,
  status?: number
): DatabaseQueryResult<T> => ({
  data,
  error,
  count: count ?? null,
  status
});

export const runSingle = async <T>(
  query: PromiseLike<{ data: T | null; error: PostgrestError | null; status: number }>
): Promise<DatabaseQueryResult<T>> => {
  const { data, error, status } = await query;
  return toQueryResult(data, error, null, status);
};

export const runMany = async <T>(
  query: PromiseLike<{ data: T[] | null; error: PostgrestError | null; count: number | null; status: number }>
): Promise<DatabaseQueryResult<T[]>> => {
  const { data, error, count, status } = await query;
  return toQueryResult(data, error, count, status);
};

export const incrementUsage = async (
  client: SupabaseClient,
  keyId: string,
  usageCount: number
): Promise<void> => {
  await client
    .from('developer_api_keys')
    .update({
      usage_count: usageCount + 1,
      last_used_at: new Date().toISOString()
    })
    .eq('id', keyId);
};
