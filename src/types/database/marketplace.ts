import type { AudienceType } from './entities';

export type ExternalId = `ext_${string}`;

export const isExternalId = (value: string): value is ExternalId => value.startsWith('ext_');

export interface DeveloperApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  permissions: string[];
  usage_count: number;
  last_used_at?: string;
  created_at: string;
}

export interface MarketplaceApp {
  id: string;
  external_id?: ExternalId;
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  category: string;
  icon_url?: string;
  screenshots?: string[];
  version: string;
  pricing_model: string;
  pricing_config?: Record<string, unknown>;
  install_count: number;
  developer_id: string;
  developer_name: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  supported_audience?: AudienceType[];
}
