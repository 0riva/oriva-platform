/**
 * Query Parameter Utility Functions
 * Shared helpers for parsing and normalizing Express query parameters.
 */

export const toNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toStringParam = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : Array.isArray(value) ? (value[0] ?? fallback) : fallback;

export const getLimit = (value: unknown, fallback: number, max?: number): number => {
  const parsed = toNumber(value, fallback);
  const normalized = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return max ? Math.min(normalized, max) : normalized;
};

export const getOffset = (value: unknown, fallback: number): number => {
  const parsed = toNumber(value, fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
