/**
 * Storage API for plugin data persistence
 */

import { BaseApi } from '../core/BaseApi';
import { PluginStorage, ApiResponse } from '../types';

export class StorageApi extends BaseApi {
  /**
   * Get all stored data for the plugin
   */
  async getAll(): Promise<ApiResponse<PluginStorage>> {
    this.requirePermission('storage:read');
    return this.get<PluginStorage>(`/api/v1/storage/${this.context.pluginId}`);
  }

  /**
   * Get a specific value by key
   */
  async get<T = any>(key: string): Promise<T | null> {
    this.requirePermission('storage:read');
    
    try {
      const response = await this.get<{ value: T }>(`/api/v1/storage/${this.context.pluginId}/${key}`);
      return response.data.value;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Set a value for a specific key
   */
  async set<T = any>(key: string, value: T): Promise<ApiResponse<void>> {
    this.requirePermission('storage:write');
    return this.put<void>(`/api/v1/storage/${this.context.pluginId}/${key}`, { value });
  }

  /**
   * Set multiple key-value pairs
   */
  async setMany(data: Record<string, any>): Promise<ApiResponse<void>> {
    this.requirePermission('storage:write');
    return this.put<void>(`/api/v1/storage/${this.context.pluginId}`, data);
  }

  /**
   * Delete a specific key
   */
  async delete(key: string): Promise<ApiResponse<void>> {
    this.requirePermission('storage:write');
    return this.delete<void>(`/api/v1/storage/${this.context.pluginId}/${key}`);
  }

  /**
   * Delete multiple keys
   */
  async deleteMany(keys: string[]): Promise<ApiResponse<void>> {
    this.requirePermission('storage:write');
    return this.post<void>(`/api/v1/storage/${this.context.pluginId}/delete-many`, { keys });
  }

  /**
   * Clear all stored data for the plugin
   */
  async clear(): Promise<ApiResponse<void>> {
    this.requirePermission('storage:write');
    return this.delete<void>(`/api/v1/storage/${this.context.pluginId}`);
  }

  /**
   * Get all keys stored by the plugin
   */
  async keys(): Promise<ApiResponse<string[]>> {
    this.requirePermission('storage:read');
    return this.get<string[]>(`/api/v1/storage/${this.context.pluginId}/keys`);
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    this.requirePermission('storage:read');
    
    try {
      await this.get<any>(`/api/v1/storage/${this.context.pluginId}/${key}`);
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStats(): Promise<ApiResponse<{
    keyCount: number;
    totalSize: number;
    quota: number;
    quotaUsed: number;
  }>> {
    this.requirePermission('storage:read');
    return this.get<any>(`/api/v1/storage/${this.context.pluginId}/stats`);
  }

  /**
   * Increment a numeric value (atomic operation)
   */
  async increment(key: string, delta: number = 1): Promise<ApiResponse<{ value: number }>> {
    this.requirePermission('storage:write');
    return this.post<{ value: number }>(`/api/v1/storage/${this.context.pluginId}/${key}/increment`, { delta });
  }

  /**
   * Decrement a numeric value (atomic operation)
   */
  async decrement(key: string, delta: number = 1): Promise<ApiResponse<{ value: number }>> {
    this.requirePermission('storage:write');
    return this.post<{ value: number }>(`/api/v1/storage/${this.context.pluginId}/${key}/decrement`, { delta });
  }

  /**
   * Append to an array value (atomic operation)
   */
  async push<T = any>(key: string, ...values: T[]): Promise<ApiResponse<{ length: number }>> {
    this.requirePermission('storage:write');
    return this.post<{ length: number }>(`/api/v1/storage/${this.context.pluginId}/${key}/push`, { values });
  }

  /**
   * Remove from an array value (atomic operation)
   */
  async pull<T = any>(key: string, value: T): Promise<ApiResponse<{ length: number }>> {
    this.requirePermission('storage:write');
    return this.post<{ length: number }>(`/api/v1/storage/${this.context.pluginId}/${key}/pull`, { value });
  }

  /**
   * Get and delete a value (atomic operation)
   */
  async pop<T = any>(key: string): Promise<T | null> {
    this.requirePermission('storage:write');
    
    try {
      const response = await this.post<{ value: T }>(`/api/v1/storage/${this.context.pluginId}/${key}/pop`);
      return response.data.value;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Set a value with expiration (TTL in seconds)
   */
  async setWithTTL<T = any>(key: string, value: T, ttl: number): Promise<ApiResponse<void>> {
    this.requirePermission('storage:write');
    return this.put<void>(`/api/v1/storage/${this.context.pluginId}/${key}`, { value, ttl });
  }

  /**
   * Get TTL for a key (returns null if no TTL or key doesn't exist)
   */
  async getTTL(key: string): Promise<number | null> {
    this.requirePermission('storage:read');
    
    try {
      const response = await this.get<{ ttl: number }>(`/api/v1/storage/${this.context.pluginId}/${key}/ttl`);
      return response.data.ttl;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }
}