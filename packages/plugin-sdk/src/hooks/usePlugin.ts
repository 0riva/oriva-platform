/**
 * React hooks for Oriva Plugin SDK
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { OrivaPluginSDK } from '../OrivaPluginSDK';
import { Entry, Template, User, PluginStorage, ApiError } from '../types';

export interface UsePluginOptions {
  onError?: (error: ApiError) => void;
  autoRetry?: boolean;
  retryDelay?: number;
}

/**
 * Hook for managing plugin SDK instance
 */
export function usePlugin(sdk: OrivaPluginSDK, options: UsePluginOptions = {}) {
  const [isInitialized, setIsInitialized] = useState(sdk.isInitialized());
  const [permissions, setPermissions] = useState(sdk.getPermissions());
  const { onError } = options;

  const handleError = useCallback((error: ApiError) => {
    // Log error through callback for proper error handling
    onError?.(error);
  }, [onError]);

  return {
    sdk,
    isInitialized,
    permissions,
    hasPermission: useCallback((permission: string) => sdk.hasPermission(permission), [sdk]),
    handleError,
  };
}

/**
 * Hook for managing entries with CRUD operations
 */
export function useEntries(sdk: OrivaPluginSDK, options: UsePluginOptions = {}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { handleError } = usePlugin(sdk, options);

  const fetchEntries = useCallback(async (filters = {}) => {
    if (!sdk.hasPermission('entries:read')) {
      const permissionError: ApiError = {
        message: 'Missing permission: entries:read',
        code: 'PERMISSION_DENIED',
      };
      setError(permissionError);
      handleError(permissionError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await sdk.entries.getEntries(filters);
      setEntries(response.data);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      handleError(apiError);
    } finally {
      setLoading(false);
    }
  }, [sdk, handleError]);

  const createEntry = useCallback(async (entryData: any) => {
    if (!sdk.hasPermission('entries:write')) {
      const permissionError: ApiError = {
        message: 'Missing permission: entries:write',
        code: 'PERMISSION_DENIED',
      };
      handleError(permissionError);
      throw permissionError;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await sdk.entries.createEntry(entryData);
      setEntries(prev => [response.data, ...prev]);
      return response.data;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      handleError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [sdk, handleError]);

  const updateEntry = useCallback(async (id: string, updates: any) => {
    if (!sdk.hasPermission('entries:write')) {
      const permissionError: ApiError = {
        message: 'Missing permission: entries:write',
        code: 'PERMISSION_DENIED',
      };
      handleError(permissionError);
      throw permissionError;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await sdk.entries.updateEntry({ id, ...updates });
      setEntries(prev => prev.map(entry => entry.id === id ? response.data : entry));
      return response.data;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      handleError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [sdk, handleError]);

  const deleteEntry = useCallback(async (id: string) => {
    if (!sdk.hasPermission('entries:delete')) {
      const permissionError: ApiError = {
        message: 'Missing permission: entries:delete',
        code: 'PERMISSION_DENIED',
      };
      handleError(permissionError);
      throw permissionError;
    }

    setLoading(true);
    setError(null);

    try {
      await sdk.entries.deleteEntry(id);
      setEntries(prev => prev.filter(entry => entry.id !== id));
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      handleError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [sdk, handleError]);

  return {
    entries,
    loading,
    error,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    refresh: fetchEntries,
  };
}

/**
 * Hook for managing templates
 */
export function useTemplates(sdk: OrivaPluginSDK, options: UsePluginOptions = {}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { handleError } = usePlugin(sdk, options);

  const fetchTemplates = useCallback(async (filters = {}) => {
    if (!sdk.hasPermission('templates:read')) {
      const permissionError: ApiError = {
        message: 'Missing permission: templates:read',
        code: 'PERMISSION_DENIED',
      };
      setError(permissionError);
      handleError(permissionError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await sdk.templates.getTemplates(filters);
      setTemplates(response.data);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      handleError(apiError);
    } finally {
      setLoading(false);
    }
  }, [sdk, handleError]);

  const createTemplate = useCallback(async (templateData: any) => {
    if (!sdk.hasPermission('templates:write')) {
      const permissionError: ApiError = {
        message: 'Missing permission: templates:write',
        code: 'PERMISSION_DENIED',
      };
      handleError(permissionError);
      throw permissionError;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await sdk.templates.createTemplate(templateData);
      setTemplates(prev => [response.data, ...prev]);
      return response.data;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      handleError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [sdk, handleError]);

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    createTemplate,
    refresh: fetchTemplates,
  };
}

/**
 * Hook for managing current user information
 */
export function useUser(sdk: OrivaPluginSDK, options: UsePluginOptions = {}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { handleError } = usePlugin(sdk, options);

  const fetchUser = useCallback(async () => {
    if (!sdk.hasPermission('user:read')) {
      const permissionError: ApiError = {
        message: 'Missing permission: user:read',
        code: 'PERMISSION_DENIED',
      };
      setError(permissionError);
      handleError(permissionError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await sdk.user.getCurrentUser();
      setUser(response.data);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      handleError(apiError);
    } finally {
      setLoading(false);
    }
  }, [sdk, handleError]);

  const updateProfile = useCallback(async (updates: any) => {
    if (!sdk.hasPermission('user:write')) {
      const permissionError: ApiError = {
        message: 'Missing permission: user:write',
        code: 'PERMISSION_DENIED',
      };
      handleError(permissionError);
      throw permissionError;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await sdk.user.updateProfile(updates);
      setUser(response.data);
      return response.data;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      handleError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [sdk, handleError]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    loading,
    error,
    updateProfile,
    refresh: fetchUser,
  };
}

/**
 * Hook for managing plugin storage with automatic sync
 */
export function useStorage<T = any>(
  sdk: OrivaPluginSDK,
  key: string,
  defaultValue?: T,
  options: UsePluginOptions = {}
) {
  const [value, setValue] = useState<T | null>(defaultValue || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { handleError } = usePlugin(sdk, options);

  const fetchValue = useCallback(async () => {
    if (!sdk.hasPermission('storage:read')) {
      const permissionError: ApiError = {
        message: 'Missing permission: storage:read',
        code: 'PERMISSION_DENIED',
      };
      setError(permissionError);
      handleError(permissionError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const storedValue = await sdk.storage.get<T>(key);
      setValue(storedValue !== null ? storedValue : defaultValue || null);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      handleError(apiError);
    } finally {
      setLoading(false);
    }
  }, [sdk, key, defaultValue, handleError]);

  const updateValue = useCallback(async (newValue: T) => {
    if (!sdk.hasPermission('storage:write')) {
      const permissionError: ApiError = {
        message: 'Missing permission: storage:write',
        code: 'PERMISSION_DENIED',
      };
      handleError(permissionError);
      throw permissionError;
    }

    setLoading(true);
    setError(null);

    try {
      await sdk.storage.set(key, newValue);
      setValue(newValue);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      handleError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [sdk, key, handleError]);

  const deleteValue = useCallback(async () => {
    if (!sdk.hasPermission('storage:write')) {
      const permissionError: ApiError = {
        message: 'Missing permission: storage:write',
        code: 'PERMISSION_DENIED',
      };
      handleError(permissionError);
      throw permissionError;
    }

    setLoading(true);
    setError(null);

    try {
      await sdk.storage.delete(key);
      setValue(defaultValue || null);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      handleError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [sdk, key, defaultValue, handleError]);

  useEffect(() => {
    fetchValue();
  }, [fetchValue]);

  return {
    value,
    loading,
    error,
    setValue: updateValue,
    deleteValue,
    refresh: fetchValue,
  };
}

/**
 * Hook for managing UI notifications
 */
export function useNotifications(sdk: OrivaPluginSDK, options: UsePluginOptions = {}) {
  const { handleError } = usePlugin(sdk, options);

  const showNotification = useCallback(async (notificationOptions: any) => {
    if (!sdk.hasPermission('ui:notifications')) {
      const permissionError: ApiError = {
        message: 'Missing permission: ui:notifications',
        code: 'PERMISSION_DENIED',
      };
      handleError(permissionError);
      throw permissionError;
    }

    try {
      return await sdk.ui.showNotification(notificationOptions);
    } catch (err) {
      const apiError = err as ApiError;
      handleError(apiError);
      throw apiError;
    }
  }, [sdk, handleError]);

  const showToast = useCallback(async (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    return showNotification({
      title: '',
      message,
      type,
      duration: 3000,
    });
  }, [showNotification]);

  return {
    showNotification,
    showToast,
  };
}

/**
 * Hook for async operations with loading state
 */
export function useAsyncOperation<T extends (...args: any[]) => Promise<any>>(
  operation: T,
  options: UsePluginOptions = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { onError } = options;

  const execute = useCallback(async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    setLoading(true);
    setError(null);

    try {
      const result = await operation(...args);
      return result;
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError);
      onError?.(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [operation, onError]);

  return {
    execute,
    loading,
    error,
    clearError: useCallback(() => setError(null), []),
  };
}