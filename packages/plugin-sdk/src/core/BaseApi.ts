/**
 * Base API client for Oriva Plugin SDK
 * Handles authentication, rate limiting, and error handling
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, ApiError, PluginConfig, PluginContext } from '../types';

export class BaseApi {
  protected client: AxiosInstance;
  protected context: PluginContext;

  constructor(context: PluginContext, config?: Partial<PluginConfig>) {
    this.context = context;
    
    this.client = axios.create({
      baseURL: context.baseUrl,
      timeout: config?.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Plugin-ID': context.pluginId,
        'X-Plugin-Version': context.version,
        'Authorization': `Bearer ${context.apiKey}`,
      },
    });

    this.setupInterceptors(config?.retries || 3);
  }

  private setupInterceptors(maxRetries: number) {
    // Request interceptor for logging and rate limiting
    this.client.interceptors.request.use(
      (config) => {
        console.debug(`[Plugin SDK] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        // Request error - reject to be handled by caller
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling and retries
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error) => {
        const config = error.config;
        
        // Retry logic for network errors and 5xx responses
        if (
          config &&
          !config._retry &&
          config._retryCount < maxRetries &&
          (error.code === 'NETWORK_ERROR' || 
           (error.response?.status >= 500 && error.response?.status < 600))
        ) {
          config._retryCount = (config._retryCount || 0) + 1;
          config._retry = true;
          
          // Exponential backoff
          const delay = Math.pow(2, config._retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return this.client(config);
        }

        return Promise.reject(this.transformError(error));
      }
    );
  }

  private transformError(error: any): ApiError {
    if (error.response) {
      // Server responded with error status
      return {
        message: error.response.data?.message || 'Request failed',
        code: error.response.data?.code,
        status: error.response.status,
        details: error.response.data,
      };
    } else if (error.request) {
      // Network error
      return {
        message: 'Network error - please check your connection',
        code: 'NETWORK_ERROR',
        details: error.message,
      };
    } else {
      // Other error
      return {
        message: error.message || 'Unknown error occurred',
        code: 'UNKNOWN_ERROR',
        details: error,
      };
    }
  }

  protected async request<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.request<ApiResponse<T>>(config);
      return response.data;
    } catch (error) {
      throw error as ApiError;
    }
  }

  protected get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  protected post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  protected put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  protected patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  protected delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  /**
   * Check if the plugin has the required permission
   */
  protected hasPermission(permission: string): boolean {
    return this.context.permissions.includes(permission as any);
  }

  /**
   * Ensure the plugin has the required permission or throw error
   */
  protected requirePermission(permission: string): void {
    if (!this.hasPermission(permission)) {
      throw new Error(`Plugin does not have required permission: ${permission}`);
    }
  }
}