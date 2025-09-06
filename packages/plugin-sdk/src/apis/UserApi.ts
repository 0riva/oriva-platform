/**
 * User API for accessing user information through plugins
 */

import { BaseApi } from '../core/BaseApi';
import { User, ApiResponse } from '../types';

export interface UpdateUserRequest {
  username?: string;
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
}

export interface UserPreferences {
  [key: string]: any;
}

export class UserApi extends BaseApi {
  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    this.requirePermission('user:read');
    return this.get<User>('/api/v1/user/me');
  }

  /**
   * Get user by ID (if plugin has permission)
   */
  async getUser(id: string): Promise<ApiResponse<User>> {
    this.requirePermission('user:read');
    return this.get<User>(`/api/v1/user/${id}`);
  }

  /**
   * Update current user profile
   */
  async updateProfile(updates: UpdateUserRequest): Promise<ApiResponse<User>> {
    this.requirePermission('user:write');
    return this.put<User>('/api/v1/user/me', updates);
  }

  /**
   * Update user avatar
   */
  async updateAvatar(avatarFile: File | Blob): Promise<ApiResponse<{ avatarUrl: string }>> {
    this.requirePermission('user:write');
    
    const formData = new FormData();
    formData.append('avatar', avatarFile);

    return this.post<any>('/api/v1/user/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Get user preferences (plugin-scoped)
   */
  async getPreferences(): Promise<ApiResponse<UserPreferences>> {
    this.requirePermission('user:read');
    return this.get<UserPreferences>(`/api/v1/user/preferences/${this.context.pluginId}`);
  }

  /**
   * Update user preferences (plugin-scoped)
   */
  async updatePreferences(preferences: UserPreferences): Promise<ApiResponse<UserPreferences>> {
    this.requirePermission('user:write');
    return this.put<UserPreferences>(`/api/v1/user/preferences/${this.context.pluginId}`, preferences);
  }

  /**
   * Get a specific preference value
   */
  async getPreference<T = any>(key: string): Promise<T | null> {
    const response = await this.getPreferences();
    return response.data[key] || null;
  }

  /**
   * Set a specific preference value
   */
  async setPreference(key: string, value: any): Promise<ApiResponse<UserPreferences>> {
    const currentPrefs = await this.getPreferences();
    const updatedPrefs = {
      ...currentPrefs.data,
      [key]: value,
    };
    return this.updatePreferences(updatedPrefs);
  }

  /**
   * Delete a specific preference
   */
  async deletePreference(key: string): Promise<ApiResponse<UserPreferences>> {
    const currentPrefs = await this.getPreferences();
    const { [key]: removed, ...updatedPrefs } = currentPrefs.data;
    return this.updatePreferences(updatedPrefs);
  }

  /**
   * Get user activity summary
   */
  async getActivitySummary(): Promise<ApiResponse<{
    entriesCount: number;
    templatesCount: number;
    lastActivity: string;
    joinedAt: string;
  }>> {
    this.requirePermission('user:read');
    return this.get<any>('/api/v1/user/me/activity');
  }

  /**
   * Check if user has specific permissions
   */
  async checkPermissions(permissions: string[]): Promise<ApiResponse<Record<string, boolean>>> {
    this.requirePermission('user:read');
    return this.post<Record<string, boolean>>('/api/v1/user/me/permissions/check', { permissions });
  }

  /**
   * Get user's plugin installations
   */
  async getInstalledPlugins(): Promise<ApiResponse<{
    pluginId: string;
    name: string;
    version: string;
    installedAt: string;
    enabled: boolean;
  }[]>> {
    this.requirePermission('user:read');
    return this.get<any>('/api/v1/user/me/plugins');
  }

  /**
   * Search users (if plugin has permission)
   */
  async searchUsers(query: string, limit: number = 10): Promise<ApiResponse<User[]>> {
    this.requirePermission('user:read');
    
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
    });

    return this.get<User[]>(`/api/v1/users/search?${params.toString()}`);
  }
}