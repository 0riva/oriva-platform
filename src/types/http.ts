export type ApiErrorResponse = {
  ok: false;
  success?: false; // legacy flag, optional for compatibility
  error: string;
  message: string;
  code?: string;
  details?: string[]; // Optional to avoid exposing internal details for security
};

export type ApiSuccessResponse<T> = {
  ok: true;
  success?: true; // legacy flag, optional for compatibility
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
