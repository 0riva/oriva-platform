import type { ApiResponse as CoreApiResponse, ApiSuccessResponse, ApiErrorResponse } from '../http';

export type ApiResponse<T = unknown> = CoreApiResponse<T>;
export type { ApiSuccessResponse, ApiErrorResponse };

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationMeta {
  pagination: PaginationInfo;
}

export type PaginatedResponse<T = unknown> = ApiSuccessResponse<T[]> & {
  meta: PaginationMeta;
};

export type SuccessfulApiResponse<T> = ApiSuccessResponse<T> & { data: T };
