/**
 * UI API for plugin interface interactions
 */

import { BaseApi } from '../core/BaseApi';
import { NotificationOptions, ModalOptions, NavigationOptions, ApiResponse } from '../types';

export class UiApi extends BaseApi {
  /**
   * Show a notification to the user
   */
  async showNotification(options: NotificationOptions): Promise<ApiResponse<{ id: string }>> {
    this.requirePermission('ui:notifications');
    
    const notification = {
      ...options,
      type: options.type || 'info',
      duration: options.duration || 5000,
    };

    return this.post<{ id: string }>('/api/v1/ui/notifications', notification);
  }

  /**
   * Hide a specific notification
   */
  async hideNotification(id: string): Promise<ApiResponse<void>> {
    this.requirePermission('ui:notifications');
    return this.delete<void>(`/api/v1/ui/notifications/${id}`);
  }

  /**
   * Show a modal dialog
   */
  async showModal(options: ModalOptions): Promise<ApiResponse<{ id: string; result?: any }>> {
    this.requirePermission('ui:modals');
    
    const modal = {
      ...options,
      size: options.size || 'medium',
      closable: options.closable !== false,
    };

    return this.post<{ id: string; result?: any }>('/api/v1/ui/modals', modal);
  }

  /**
   * Close a specific modal
   */
  async closeModal(id: string, result?: any): Promise<ApiResponse<void>> {
    this.requirePermission('ui:modals');
    return this.post<void>(`/api/v1/ui/modals/${id}/close`, { result });
  }

  /**
   * Navigate to a specific screen
   */
  async navigate(options: NavigationOptions): Promise<ApiResponse<void>> {
    this.requirePermission('ui:navigation');
    return this.post<void>('/api/v1/ui/navigate', options);
  }

  /**
   * Go back in navigation history
   */
  async goBack(): Promise<ApiResponse<void>> {
    this.requirePermission('ui:navigation');
    return this.post<void>('/api/v1/ui/navigate/back');
  }

  /**
   * Open a URL in external browser or in-app browser
   */
  async openUrl(url: string, external: boolean = false): Promise<ApiResponse<void>> {
    this.requirePermission('ui:navigation');
    return this.post<void>('/api/v1/ui/open-url', { url, external });
  }

  /**
   * Show a confirmation dialog
   */
  async showConfirm(options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
  }): Promise<ApiResponse<{ confirmed: boolean }>> {
    this.requirePermission('ui:modals');
    
    const confirmOptions = {
      ...options,
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      destructive: options.destructive || false,
    };

    return this.post<{ confirmed: boolean }>('/api/v1/ui/confirm', confirmOptions);
  }

  /**
   * Show an alert dialog
   */
  async showAlert(options: {
    title: string;
    message: string;
    buttonText?: string;
    type?: 'info' | 'warning' | 'error' | 'success';
  }): Promise<ApiResponse<void>> {
    this.requirePermission('ui:modals');
    
    const alertOptions = {
      ...options,
      buttonText: options.buttonText || 'OK',
      type: options.type || 'info',
    };

    return this.post<void>('/api/v1/ui/alert', alertOptions);
  }

  /**
   * Show a prompt dialog for text input
   */
  async showPrompt(options: {
    title: string;
    message: string;
    placeholder?: string;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
    multiline?: boolean;
  }): Promise<ApiResponse<{ value: string | null }>> {
    this.requirePermission('ui:modals');
    
    const promptOptions = {
      ...options,
      confirmText: options.confirmText || 'OK',
      cancelText: options.cancelText || 'Cancel',
      multiline: options.multiline || false,
    };

    return this.post<{ value: string | null }>('/api/v1/ui/prompt', promptOptions);
  }

  /**
   * Show a toast message (temporary notification)
   */
  async showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): Promise<ApiResponse<void>> {
    return this.showNotification({
      title: '',
      message,
      type,
      duration: 3000,
    }).then(() => ({ data: undefined, success: true }));
  }

  /**
   * Set the page title (for web platforms)
   */
  async setTitle(title: string): Promise<ApiResponse<void>> {
    this.requirePermission('ui:navigation');
    return this.post<void>('/api/v1/ui/title', { title });
  }

  /**
   * Add a custom menu item to the app's menu
   */
  async addMenuItem(options: {
    id: string;
    label: string;
    icon?: string;
    location: 'main' | 'user' | 'entry' | 'template';
    action: string;
  }): Promise<ApiResponse<void>> {
    this.requirePermission('ui:navigation');
    return this.post<void>('/api/v1/ui/menu-items', options);
  }

  /**
   * Remove a custom menu item
   */
  async removeMenuItem(id: string): Promise<ApiResponse<void>> {
    this.requirePermission('ui:navigation');
    return this.delete<void>(`/api/v1/ui/menu-items/${id}`);
  }

  /**
   * Trigger haptic feedback (mobile platforms)
   */
  async hapticFeedback(type: 'light' | 'medium' | 'heavy' | 'selection' | 'impact' = 'light'): Promise<ApiResponse<void>> {
    this.requirePermission('ui:notifications');
    return this.post<void>('/api/v1/ui/haptic', { type });
  }

  /**
   * Show loading indicator
   */
  async showLoading(message?: string): Promise<ApiResponse<{ id: string }>> {
    this.requirePermission('ui:modals');
    return this.post<{ id: string }>('/api/v1/ui/loading', { message });
  }

  /**
   * Hide loading indicator
   */
  async hideLoading(id: string): Promise<ApiResponse<void>> {
    this.requirePermission('ui:modals');
    return this.delete<void>(`/api/v1/ui/loading/${id}`);
  }
}