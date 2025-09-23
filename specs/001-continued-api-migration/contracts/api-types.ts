// TypeScript API Contracts for Oriva Platform Migration
// Phase 1 Design Output

// Base API Response Structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Paginated Response Structure
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta?: {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

// Error Response Structure
export interface ErrorResponse {
  success: false;
  error: string;
  details?: string[];
  timestamp?: string;
}

// Authentication Context
export interface ApiKeyInfo {
  id: string;
  userId: string;
  name: string;
  permissions: string[];
  usageCount: number;
  authType: 'api_key' | 'supabase_auth';
}

// Request Extensions
export interface AuthenticatedRequest extends Express.Request {
  apiKey?: string;
  keyInfo?: ApiKeyInfo;
}

// User Profile Types
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

// Group Types
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

// Entry Types
export interface Entry {
  id: string;
  title: string;
  content: string;
  profile_id: string;
  created_at: string;
  updated_at: string;
  audience_type: string;
}

// Marketplace App Types
export interface MarketplaceApp {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  category: string;
  icon_url?: string;
  screenshots?: string[];
  version: string;
  pricing_model: string;
  pricing_config?: any;
  install_count: number;
  developer_id: string;
  developer_name: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// API Key Management Types
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

// Middleware Types
export type ApiMiddleware = (
  req: AuthenticatedRequest,
  res: Express.Response,
  next: Express.NextFunction
) => void | Promise<void>;

// Database Query Result Types
export interface DatabaseQueryResult<T> {
  data: T | null;
  error: any;
  count?: number;
}