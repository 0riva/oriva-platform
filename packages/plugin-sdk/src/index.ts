/**
 * @oriva/plugin-sdk - TypeScript SDK for Oriva Plugin Development
 * 
 * This SDK provides comprehensive APIs for developing plugins for the Oriva platform.
 * It includes type-safe APIs for entries, templates, user management, UI interactions,
 * and plugin storage with proper authentication and permission handling.
 */

// Main SDK class
export { OrivaPluginSDK } from './OrivaPluginSDK';

// Type definitions
export type {
  PluginManifest,
  PluginPermission,
  PluginEntryPoints,
  PluginAssets,
  PluginContext,
  Entry,
  Section,
  Template,
  TemplateSection,
  User,
  PluginStorage,
  NotificationOptions,
  ModalOptions,
  NavigationOptions,
  ApiResponse,
  ApiError,
  PluginConfig,
} from './types';

// API classes (for advanced usage)
export { EntryApi } from './apis/EntryApi';
export { TemplateApi } from './apis/TemplateApi';
export { UserApi } from './apis/UserApi';
export { UiApi } from './apis/UiApi';
export { StorageApi } from './apis/StorageApi';

// Base API class (for extending)
export { BaseApi } from './core/BaseApi';

// Request/Response types for APIs
export type {
  CreateEntryRequest,
  UpdateEntryRequest,
  GetEntriesOptions,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  GetTemplatesOptions,
  UpdateUserRequest,
  UserPreferences,
} from './apis/EntryApi';

// Version
export const VERSION = '1.0.0';

// Utility functions
export function createSDK(context: PluginContext, config?: Partial<PluginConfig>): OrivaPluginSDK {
  return new OrivaPluginSDK(context, config);
}

/**
 * Validate plugin manifest against schema
 */
export function validateManifest(manifest: PluginManifest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!manifest.name) errors.push('Name is required');
  if (!manifest.version) errors.push('Version is required');
  if (!manifest.description) errors.push('Description is required');
  if (!manifest.author?.name) errors.push('Author name is required');

  // Version format validation (semver)
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)?(\+[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)?$/;
  if (manifest.version && !semverRegex.test(manifest.version)) {
    errors.push('Version must be valid semver format');
  }

  // Permissions validation
  if (!Array.isArray(manifest.permissions)) {
    errors.push('Permissions must be an array');
  } else {
    const validPermissions = [
      'entries:read', 'entries:write', 'entries:delete',
      'templates:read', 'templates:write',
      'user:read', 'user:write',
      'ui:notifications', 'ui:modals', 'ui:navigation',
      'storage:read', 'storage:write'
    ];
    
    const invalidPermissions = manifest.permissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      errors.push(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }
  }

  // Platform validation
  const validPlatforms = ['web', 'ios', 'android', 'all'];
  if (manifest.compatibility?.platform && !validPlatforms.includes(manifest.compatibility.platform)) {
    errors.push('Platform must be one of: web, ios, android, all');
  }

  // Entry points validation
  if (manifest.entryPoints) {
    const entryPointPaths = Object.values(manifest.entryPoints).filter(Boolean);
    entryPointPaths.forEach(path => {
      if (typeof path !== 'string' || !path.endsWith('.js') && !path.endsWith('.jsx') && !path.endsWith('.ts') && !path.endsWith('.tsx')) {
        errors.push(`Entry point must be a valid JavaScript/TypeScript file: ${path}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if SDK version is compatible with manifest requirements
 */
export function isVersionCompatible(requiredVersion: string, currentVersion: string = VERSION): boolean {
  // Simple version comparison for now
  // In production, use proper semver comparison
  const required = requiredVersion.split('.').map(Number);
  const current = currentVersion.split('.').map(Number);
  
  // Major version must match
  if (required[0] !== current[0]) return false;
  
  // Minor version must be <= current
  if (required[1] > current[1]) return false;
  
  // Patch version must be <= current if minor versions match
  if (required[1] === current[1] && required[2] > current[2]) return false;
  
  return true;
}

/**
 * Default export for convenience
 */
export default OrivaPluginSDK;