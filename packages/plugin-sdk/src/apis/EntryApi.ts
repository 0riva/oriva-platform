/**
 * Entry API for managing Oriva entries through plugins
 */

import { BaseApi } from '../core/BaseApi';
import { Entry, Section, ApiResponse } from '../types';

export interface CreateEntryRequest {
  title: string;
  content?: string;
  sections?: Omit<Section, 'id'>[];
  templateId?: string;
  audience?: 'public' | 'private' | 'shared';
  status?: 'draft' | 'scheduled' | 'published';
}

export interface UpdateEntryRequest extends Partial<CreateEntryRequest> {
  id: string;
}

export interface GetEntriesOptions {
  page?: number;
  limit?: number;
  status?: 'draft' | 'scheduled' | 'published' | 'all';
  audience?: 'public' | 'private' | 'shared' | 'all';
  search?: string;
  templateId?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export class EntryApi extends BaseApi {
  /**
   * Get entries with filtering and pagination
   */
  async getEntries(options: GetEntriesOptions = {}): Promise<ApiResponse<Entry[]>> {
    this.requirePermission('entries:read');
    
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    return this.get<Entry[]>(`/api/v1/entries?${params.toString()}`);
  }

  /**
   * Get a specific entry by ID
   */
  async getEntry(id: string): Promise<ApiResponse<Entry>> {
    this.requirePermission('entries:read');
    return this.get<Entry>(`/api/v1/entries/${id}`);
  }

  /**
   * Create a new entry
   */
  async createEntry(entry: CreateEntryRequest): Promise<ApiResponse<Entry>> {
    this.requirePermission('entries:write');
    
    const entryData = {
      ...entry,
      status: entry.status || 'draft',
      audience: entry.audience || 'private',
    };

    return this.post<Entry>('/api/v1/entries', entryData);
  }

  /**
   * Update an existing entry
   */
  async updateEntry(entry: UpdateEntryRequest): Promise<ApiResponse<Entry>> {
    this.requirePermission('entries:write');
    
    const { id, ...updateData } = entry;
    return this.put<Entry>(`/api/v1/entries/${id}`, updateData);
  }

  /**
   * Delete an entry
   */
  async deleteEntry(id: string): Promise<ApiResponse<void>> {
    this.requirePermission('entries:delete');
    return this.delete<void>(`/api/v1/entries/${id}`);
  }

  /**
   * Add a section to an entry
   */
  async addSection(entryId: string, section: Omit<Section, 'id'>): Promise<ApiResponse<Section>> {
    this.requirePermission('entries:write');
    return this.post<Section>(`/api/v1/entries/${entryId}/sections`, section);
  }

  /**
   * Update a section in an entry
   */
  async updateSection(entryId: string, sectionId: string, section: Partial<Section>): Promise<ApiResponse<Section>> {
    this.requirePermission('entries:write');
    return this.put<Section>(`/api/v1/entries/${entryId}/sections/${sectionId}`, section);
  }

  /**
   * Delete a section from an entry
   */
  async deleteSection(entryId: string, sectionId: string): Promise<ApiResponse<void>> {
    this.requirePermission('entries:write');
    return this.delete<void>(`/api/v1/entries/${entryId}/sections/${sectionId}`);
  }

  /**
   * Reorder sections in an entry
   */
  async reorderSections(entryId: string, sectionIds: string[]): Promise<ApiResponse<Section[]>> {
    this.requirePermission('entries:write');
    return this.put<Section[]>(`/api/v1/entries/${entryId}/sections/reorder`, { sectionIds });
  }

  /**
   * Publish an entry (change status to published)
   */
  async publishEntry(id: string): Promise<ApiResponse<Entry>> {
    this.requirePermission('entries:write');
    return this.patch<Entry>(`/api/v1/entries/${id}/publish`);
  }

  /**
   * Archive an entry (soft delete)
   */
  async archiveEntry(id: string): Promise<ApiResponse<Entry>> {
    this.requirePermission('entries:write');
    return this.patch<Entry>(`/api/v1/entries/${id}/archive`);
  }

  /**
   * Search entries using full-text search
   */
  async searchEntries(query: string, options: Omit<GetEntriesOptions, 'search'> = {}): Promise<ApiResponse<Entry[]>> {
    this.requirePermission('entries:read');
    
    const searchOptions = { ...options, search: query };
    return this.getEntries(searchOptions);
  }

  /**
   * Get entry statistics for the current user
   */
  async getEntryStats(): Promise<ApiResponse<{
    total: number;
    published: number;
    drafts: number;
    scheduled: number;
  }>> {
    this.requirePermission('entries:read');
    return this.get<any>('/api/v1/entries/stats');
  }
}