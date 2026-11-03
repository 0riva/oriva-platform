/**
 * Zod validation middleware
 * Integrates Zod schema validation with existing error handling
 */

import { z, ZodSchema } from 'zod';

/**
 * Format Zod validation errors into structured API response
 */
export function formatZodErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : 'unknown',
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Validate request body, query params, and path params
 * Throws validationError if validation fails
 * Returns validated data if successful
 */
export function validateRequestData<T extends ZodSchema>(schema: T, data: any): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    // Format error as expected by validationError middleware
    const errorDetails = formatZodErrors(result.error);
    const errorMessage = errorDetails.map((e) => `${e.field}: ${e.message}`).join('; ');

    throw new ValidationError(errorMessage, errorDetails);
  }

  return result.data;
}

/**
 * Custom validation error class
 * Integrates with existing error-handler middleware
 */
export class ValidationError extends Error {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
  readonly details: Array<{ field: string; message: string; code: string }>;

  constructor(
    message: string,
    details: Array<{ field: string; message: string; code: string }> = []
  ) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

/**
 * Validate multiple parts of a request at once
 * Useful for validating body, query, and params together
 *
 * @example
 * const validatedData = validateRequest({
 *   body: UserCreateSchema,
 *   query: PaginationSchema.optional(),
 *   params: { userId: z.string().uuid() }
 * }, {
 *   body: req.body,
 *   query: req.query,
 *   params: req.params
 * });
 */
export function validateRequest<T extends Record<string, ZodSchema>>(
  schemas: T,
  data: Record<string, any>
): { [K in keyof T]: z.infer<T[K]> } {
  const validated: any = {};

  for (const [key, schema] of Object.entries(schemas)) {
    const result = (schema as ZodSchema).safeParse(data[key]);

    if (!result.success) {
      const errorDetails = formatZodErrors(result.error).map((e) => ({
        ...e,
        field: `${key}.${e.field}`,
      }));
      const errorMessage = errorDetails.map((e) => `${e.field}: ${e.message}`).join('; ');

      throw new ValidationError(errorMessage, errorDetails);
    }

    validated[key] = result.data;
  }

  return validated;
}

/**
 * Safe parsing without throwing
 * Useful for optional fields or graceful degradation
 */
export function trySafeValidate<T extends ZodSchema>(
  schema: T,
  data: any
): { success: boolean; data?: z.infer<T>; error?: z.ZodError } {
  const result = schema.safeParse(data);
  return {
    success: result.success,
    data: result.success ? result.data : undefined,
    error: result.success ? undefined : result.error,
  };
}
