import type { PostgrestError } from '@supabase/supabase-js';

export const AUDIENCE_TYPES = [
  'public',
  'private',
  'followers',
  'groups',
  'draft'
] as const;
export type AudienceType = typeof AUDIENCE_TYPES[number];

export interface Profile {
  id: string;
  username: string;
  display_name?: string;
  bio?: string;
  location?: string;
  website_url?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  account_id: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  profile_id: string;
  role: string;
  joined_at: string;
  is_active: boolean;
}

export interface Entry {
  id: string;
  title: string;
  content: string;
  profile_id: string;
  created_at: string;
  updated_at: string;
  audience_type: AudienceType;
}

export interface DatabaseQueryResult<T> {
  data: T | null;
  error: PostgrestError | null;
  count?: number | null;
  status?: number;
}
