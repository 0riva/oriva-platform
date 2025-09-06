/**
 * Template API for managing Oriva templates through plugins
 */

import { BaseApi } from '../core/BaseApi';
import { Template, TemplateSection, ApiResponse } from '../types';

export interface CreateTemplateRequest {
  name: string;
  description: string;
  icon?: string;
  category: string;
  sections: Omit<TemplateSection, 'id'>[];
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {
  id: string;
}

export interface GetTemplatesOptions {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'usageCount' | 'rating';
  sortOrder?: 'asc' | 'desc';
  includeBuiltIn?: boolean;
}

export class TemplateApi extends BaseApi {
  /**
   * Get templates with filtering and pagination
   */
  async getTemplates(options: GetTemplatesOptions = {}): Promise<ApiResponse<Template[]>> {
    this.requirePermission('templates:read');
    
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    return this.get<Template[]>(`/api/v1/templates?${params.toString()}`);
  }

  /**
   * Get a specific template by ID
   */
  async getTemplate(id: string): Promise<ApiResponse<Template>> {
    this.requirePermission('templates:read');
    return this.get<Template>(`/api/v1/templates/${id}`);
  }

  /**
   * Create a new template
   */
  async createTemplate(template: CreateTemplateRequest): Promise<ApiResponse<Template>> {
    this.requirePermission('templates:write');
    return this.post<Template>('/api/v1/templates', template);
  }

  /**
   * Update an existing template
   */
  async updateTemplate(template: UpdateTemplateRequest): Promise<ApiResponse<Template>> {
    this.requirePermission('templates:write');
    
    const { id, ...updateData } = template;
    return this.put<Template>(`/api/v1/templates/${id}`, updateData);
  }

  /**
   * Delete a template (only custom templates)
   */
  async deleteTemplate(id: string): Promise<ApiResponse<void>> {
    this.requirePermission('templates:write');
    return this.delete<void>(`/api/v1/templates/${id}`);
  }

  /**
   * Duplicate a template
   */
  async duplicateTemplate(id: string, name?: string): Promise<ApiResponse<Template>> {
    this.requirePermission('templates:write');
    return this.post<Template>(`/api/v1/templates/${id}/duplicate`, { name });
  }

  /**
   * Get template categories
   */
  async getCategories(): Promise<ApiResponse<{ id: string; name: string; description: string }[]>> {
    this.requirePermission('templates:read');
    return this.get<any>('/api/v1/templates/categories');
  }

  /**
   * Search templates using full-text search
   */
  async searchTemplates(query: string, options: Omit<GetTemplatesOptions, 'search'> = {}): Promise<ApiResponse<Template[]>> {
    this.requirePermission('templates:read');
    
    const searchOptions = { ...options, search: query };
    return this.getTemplates(searchOptions);
  }

  /**
   * Get popular templates (most used)
   */
  async getPopularTemplates(limit: number = 10): Promise<ApiResponse<Template[]>> {
    this.requirePermission('templates:read');
    return this.getTemplates({ 
      limit, 
      sortBy: 'usageCount', 
      sortOrder: 'desc' 
    });
  }

  /**
   * Get highly rated templates
   */
  async getTopRatedTemplates(limit: number = 10): Promise<ApiResponse<Template[]>> {
    this.requirePermission('templates:read');
    return this.getTemplates({ 
      limit, 
      sortBy: 'rating', 
      sortOrder: 'desc' 
    });
  }

  /**
   * Rate a template
   */
  async rateTemplate(id: string, rating: number): Promise<ApiResponse<{ averageRating: number; ratingCount: number }>> {
    this.requirePermission('templates:write');
    
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    
    return this.post<any>(`/api/v1/templates/${id}/rate`, { rating });
  }

  /**
   * Get template usage statistics
   */
  async getTemplateStats(id: string): Promise<ApiResponse<{
    usageCount: number;
    averageRating: number;
    ratingCount: number;
    recentUsage: { date: string; count: number }[];
  }>> {
    this.requirePermission('templates:read');
    return this.get<any>(`/api/v1/templates/${id}/stats`);
  }

  /**
   * Add a section to a template
   */
  async addSection(templateId: string, section: Omit<TemplateSection, 'id'>): Promise<ApiResponse<TemplateSection>> {
    this.requirePermission('templates:write');
    return this.post<TemplateSection>(`/api/v1/templates/${templateId}/sections`, section);
  }

  /**
   * Update a section in a template
   */
  async updateSection(templateId: string, sectionId: string, section: Partial<TemplateSection>): Promise<ApiResponse<TemplateSection>> {
    this.requirePermission('templates:write');
    return this.put<TemplateSection>(`/api/v1/templates/${templateId}/sections/${sectionId}`, section);
  }

  /**
   * Delete a section from a template
   */
  async deleteSection(templateId: string, sectionId: string): Promise<ApiResponse<void>> {
    this.requirePermission('templates:write');
    return this.delete<void>(`/api/v1/templates/${templateId}/sections/${sectionId}`);
  }

  /**
   * Reorder sections in a template
   */
  async reorderSections(templateId: string, sectionIds: string[]): Promise<ApiResponse<TemplateSection[]>> {
    this.requirePermission('templates:write');
    return this.put<TemplateSection[]>(`/api/v1/templates/${templateId}/sections/reorder`, { sectionIds });
  }
}