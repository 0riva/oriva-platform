/**
 * Core type definitions for Oriva Plugin SDK
 */

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: {
    name: string;
    email?: string;
    url?: string;
  };
  permissions: PluginPermission[];
  entryPoints: PluginEntryPoints;
  dependencies?: Record<string, string>;
  assets?: PluginAssets;
  compatibility: {
    platform: 'web' | 'ios' | 'android' | 'all';
    minVersion: string;
  };
}

export type PluginPermission = 
  | 'entries:read'
  | 'entries:write'
  | 'entries:delete'
  | 'templates:read'
  | 'templates:write'
  | 'user:read'
  | 'user:write'
  | 'ui:notifications'
  | 'ui:modals'
  | 'ui:navigation'
  | 'storage:read'
  | 'storage:write';

export interface PluginEntryPoints {
  main?: string;
  timeline?: string;
  settings?: string;
  modal?: string;
}

export interface PluginAssets {
  icon?: string;
  screenshots?: string[];
  css?: string[];
  js?: string[];
}

export interface PluginContext {
  pluginId: string;
  version: string;
  userId: string;
  permissions: PluginPermission[];
  apiKey: string;
  baseUrl: string;
}

export interface Entry {
  id: string;
  title: string;
  content: string;
  sections: Section[];
  template?: Template;
  audience: 'public' | 'private' | 'shared';
  status: 'draft' | 'scheduled' | 'published';
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface Section {
  id: string;
  type: 'text' | 'heading' | 'body';
  content: string;
  order: number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category: string;
  sections: TemplateSection[];
  isBuiltIn: boolean;
  creator?: string;
  rating?: number;
  usageCount: number;
}

export interface TemplateSection {
  id: string;
  type: 'text' | 'heading' | 'body';
  placeholder: string;
  content?: string;
  order: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  website?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PluginStorage {
  [key: string]: any;
}

export interface NotificationOptions {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  actions?: {
    label: string;
    action: () => void;
  }[];
}

export interface ModalOptions {
  title: string;
  content: React.ComponentType | string;
  size?: 'small' | 'medium' | 'large';
  closable?: boolean;
  actions?: {
    label: string;
    variant?: 'primary' | 'secondary' | 'danger';
    action: () => void;
  }[];
}

export interface NavigationOptions {
  screen: string;
  params?: Record<string, any>;
  replace?: boolean;
}

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  error?: string;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

export interface PluginConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
  retries?: number;
}