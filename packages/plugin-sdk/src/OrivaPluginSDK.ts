/**
 * Main Oriva Plugin SDK class
 * Entry point for all plugin functionality
 */

import { PluginContext, PluginConfig } from './types';
import { EntryApi } from './apis/EntryApi';
import { TemplateApi } from './apis/TemplateApi';
import { UserApi } from './apis/UserApi';
import { UiApi } from './apis/UiApi';
import { StorageApi } from './apis/StorageApi';

export class OrivaPluginSDK {
  public readonly entries: EntryApi;
  public readonly templates: TemplateApi;
  public readonly user: UserApi;
  public readonly ui: UiApi;
  public readonly storage: StorageApi;
  
  private context: PluginContext;

  constructor(context: PluginContext, config?: Partial<PluginConfig>) {
    this.context = context;
    
    // Validate context
    this.validateContext(context);
    
    // Initialize API modules
    this.entries = new EntryApi(context, config);
    this.templates = new TemplateApi(context, config);
    this.user = new UserApi(context, config);
    this.ui = new UiApi(context, config);
    this.storage = new StorageApi(context, config);
  }

  /**
   * Get the current plugin context
   */
  getContext(): PluginContext {
    return { ...this.context };
  }

  /**
   * Check if the plugin has a specific permission
   */
  hasPermission(permission: string): boolean {
    return this.context.permissions.includes(permission as any);
  }

  /**
   * Get the plugin's version
   */
  getVersion(): string {
    return this.context.version;
  }

  /**
   * Get the plugin's ID
   */
  getPluginId(): string {
    return this.context.pluginId;
  }

  /**
   * Get the current user ID
   */
  getUserId(): string {
    return this.context.userId;
  }

  /**
   * Get all permissions granted to the plugin
   */
  getPermissions(): string[] {
    return [...this.context.permissions];
  }

  /**
   * Check if the plugin is properly initialized
   */
  isInitialized(): boolean {
    return !!(
      this.context.pluginId &&
      this.context.version &&
      this.context.userId &&
      this.context.apiKey &&
      this.context.baseUrl
    );
  }

  /**
   * Validate the plugin context
   */
  private validateContext(context: PluginContext): void {
    const required = ['pluginId', 'version', 'userId', 'apiKey', 'baseUrl'];
    const missing = required.filter(field => !context[field as keyof PluginContext]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required context fields: ${missing.join(', ')}`);
    }

    if (!Array.isArray(context.permissions)) {
      throw new Error('Permissions must be an array');
    }

    // Validate API key format (basic check)
    if (typeof context.apiKey !== 'string' || context.apiKey.length < 10) {
      throw new Error('Invalid API key format');
    }

    // Validate base URL format
    try {
      new URL(context.baseUrl);
    } catch {
      throw new Error('Invalid base URL format');
    }
  }

  /**
   * Create a utility function for checking multiple permissions
   */
  checkPermissions(permissions: string[]): { [permission: string]: boolean } {
    const result: { [permission: string]: boolean } = {};
    permissions.forEach(permission => {
      result[permission] = this.hasPermission(permission);
    });
    return result;
  }

  /**
   * Require multiple permissions or throw error
   */
  requirePermissions(permissions: string[]): void {
    const missing = permissions.filter(permission => !this.hasPermission(permission));
    if (missing.length > 0) {
      throw new Error(`Plugin does not have required permissions: ${missing.join(', ')}`);
    }
  }
}